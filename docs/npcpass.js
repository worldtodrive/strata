

import { sampleLane } from './npcgraph.js';

export const PASSING = {
	on: true,

	clearAheadM: 28,

	clearBehindM: 14,

	gainM: 18,

	cooldownS: 3.0,

	blendS: 1.1,

	returnClearM: 46,
};

const MIN_PASS_SPEED = 3.0;

const MIN_ROOM_M = 22;

function buildNeighbours(graph) {
	const byRoad = new Map();
	for (let i = 0; i < graph.nodes.length; i++) {
		const r = graph.nodes[i].roadId;
		const list = byRoad.get(r);
		if (list) list.push(i);
		else byRoad.set(r, [i]);
	}

	let pairs = 0;
	let disagreed = 0;
	for (const n of graph.nodes) {
		n.left = -1;
		n.right = -1;
	}
	for (const [, list] of byRoad) {
		if (list.length < 2) continue;
		for (const a of list) {
			const na = graph.nodes[a];
			for (const b of list) {
				if (a === b) continue;
				const nb = graph.nodes[b];

				if (Math.sign(na.laneId) !== Math.sign(nb.laneId)) continue;
				if (Math.abs(na.laneId - nb.laneId) !== 1) continue;

				const sa = na.length * 0.5;
				const pa = sampleLane(na, sa);
				const pb = sampleLane(nb, nb.length * 0.5);
				const dx = pb.x - pa.x;
				const dz = pb.z - pa.z;
				const side = dx * Math.cos(pa.heading) - dz * Math.sin(pa.heading);

				if (Math.abs(side) < na.widthM * 0.5) {
					disagreed++;
					continue;
				}
				if (side > 0) na.right = b;
				else na.left = b;
				pairs++;
			}
		}
	}
	return { pairs, disagreed };
}

export function buildNpcPass(graph) {
	const adj = buildNeighbours(graph);

	let withLeft = 0;
	let withAny = 0;
	for (const n of graph.nodes) {
		if (n.left >= 0) withLeft++;
		if (n.left >= 0 || n.right >= 0) withAny++;
	}

	const stats = { passes: 0, returns: 0, blocked: 0 };

	let laneSpeedFn = null;

	const clear = (cars, list, s, self, ahead, behind) => {
		if (!list) return true;
		for (const i of list) {
			if (i === self) continue;
			const d = cars[i].s - s;
			if (d >= 0 ? d < ahead : -d < behind) return false;
		}
		return true;
	};

	const leaderAhead = (cars, list, s, self) => {
		let best = Infinity;
		if (!list) return best;
		for (const i of list) {
			if (i === self) continue;
			const d = cars[i].s - s;
			if (d > 0 && d < best) best = d;
		}
		return best;
	};

	const mapStation = (from, to, s) => {
		const f = from.length > 1e-6 ? s / from.length : 0;
		return Math.max(0, Math.min(to.length, f * to.length));
	};

	const commit = (car, idx, byNode, fromIdx, toIdx, toLeft) => {
		const from = graph.nodes[fromIdx];
		const to = graph.nodes[toIdx];
		const s = mapStation(from, to, car.s);

		car.lat = (toLeft ? 1 : -1) * (from.widthM + to.widthM) * 0.5;
		car.latRate = Math.abs(car.lat) / Math.max(0.05, PASSING.blendS);
		car.node = toIdx;
		car.s = s;
		car.want = s;
		car.cooldown = PASSING.cooldownS;
		car.braking = false;
		if (laneSpeedFn) car.speed = laneSpeedFn(car, toIdx);

		const old = byNode.get(fromIdx);
		if (old) {
			const k = old.indexOf(idx);
			if (k >= 0) old.splice(k, 1);
		}
		const list = byNode.get(toIdx);
		if (list) list.push(idx);
		else byNode.set(toIdx, [idx]);
	};

	const update = (cars, byNode, want, step, gap) => {
		if (!PASSING.on) return;
		for (let i = 0; i < want; i++) {
			const car = cars[i];

			if (car.lat !== 0) {
				const d = (car.latRate || 1) * step;
				car.lat = car.lat > 0 ? Math.max(0, car.lat - d) : Math.min(0, car.lat + d);
			}
			if (car.cooldown > 0) car.cooldown -= step;
			if (car.node < 0) continue;

			const node = graph.nodes[car.node];
			if (car.cooldown > 0) continue;

			if (car.lat !== 0) continue;
			if (node.length - car.s < MIN_ROOM_M) continue;

			if (car.braking && car.speed > MIN_PASS_SPEED && node.left >= 0) {
				const to = node.left;
				const s = mapStation(node, graph.nodes[to], car.s);
				const list = byNode.get(to);
				if (clear(cars, list, s, i, PASSING.clearAheadM, PASSING.clearBehindM)) {

					const mine = leaderAhead(cars, byNode.get(car.node), car.s, i);
					const theirs = leaderAhead(cars, list, s, i);
					if (theirs > mine + PASSING.gainM) {
						commit(car, i, byNode, car.node, to, true);
						stats.passes++;
						continue;
					}
				}
				stats.blocked++;
				continue;
			}

			if (!car.braking && node.right >= 0) {
				const to = node.right;
				const s = mapStation(node, graph.nodes[to], car.s);
				const list = byNode.get(to);
				if (clear(cars, list, s, i, PASSING.returnClearM, PASSING.clearBehindM)) {
					commit(car, i, byNode, car.node, to, false);
					stats.returns++;
				}
			}
		}
	};

	const report = `${adj.pairs.toLocaleString()} adjacent-lane pairs on ${withAny.toLocaleString()} lanes `
		+ `(${withLeft.toLocaleString()} with a lane to overtake into, `
		+ `${(100 * withAny / Math.max(1, graph.nodes.length)).toFixed(1)}% of the graph)`
		+ (adj.disagreed ? ` · ${adj.disagreed} pairs rejected as not laterally offset` : '');

	return {
		update,

		setLaneSpeed(fn) { laneSpeedFn = fn; },
		stats,
		report,
		withLeft,
		withAny,
		pairs: adj.pairs,
	};
}
