

import { isGo } from './signalcontrol.js';

const STOP_SETBACK_M = 1.6;

const MATCH_RADIUS_M = 0.5;

const CELL_M = 4;

export function buildSignalHold(graph, signals) {
	if (!signals || !signals.heads || !signals.heads.length) return null;

	const cells = new Map();
	const key = (x, z) => `${Math.floor(x / CELL_M)}:${Math.floor(z / CELL_M)}`;
	for (let i = 0; i < graph.nodes.length; i++) {
		const p = graph.nodes[i].pts;
		const e = p.length - 3;
		const k = key(p[e], p[e + 2]);
		const list = cells.get(k);
		if (list) list.push(i);
		else cells.set(k, [i]);
	}

	const stopS = new Float32Array(graph.nodes.length).fill(-1);

	const byNode = new Map();
	let matched = 0;
	let unmatched = 0;

	for (const h of signals.heads) {
		const ctl = h[0] | 0;
		const link = h[1] | 0;
		const hx = h[2];
		const hz = h[4];
		let best = -1;
		let bestD = MATCH_RADIUS_M;
		const cx = Math.floor(hx / CELL_M);
		const cz = Math.floor(hz / CELL_M);
		for (let dz = -1; dz <= 1; dz++) {
			for (let dx = -1; dx <= 1; dx++) {
				const list = cells.get(`${cx + dx}:${cz + dz}`);
				if (!list) continue;
				for (const i of list) {
					const p = graph.nodes[i].pts;
					const e = p.length - 3;
					const d = Math.hypot(p[e] - hx, p[e + 2] - hz);
					if (d < bestD) {
						bestD = d;
						best = i;
					}
				}
			}
		}
		if (best < 0) {
			unmatched++;
			continue;
		}
		matched++;

		stopS[best] = Math.max(0, graph.nodes[best].length - STOP_SETBACK_M);
		const list = byNode.get(best);
		if (list) list.push([ctl, link]);
		else byNode.set(best, [[ctl, link]]);
	}

	if (!matched) return null;

	const mayGo = (node) => {

		if (signals.group && !signals.group.visible) return true;
		const list = byNode.get(node);
		if (!list) return true;
		for (const [ctl, link] of list) {
			const state = signals.stateOf(ctl);
			if (state === null) return true;
			const ch = link >= 0 && link < state.length ? state[link] : null;
			if (ch === null) return true;
			if (isGo(ch)) return true;
		}
		return false;
	};

	const report = `${matched} of ${signals.heads.length} heads mapped to `
		+ `${byNode.size.toLocaleString()} controlled lanes`
		+ (unmatched ? ` · ⚠️ ${unmatched} matched no lane within ${MATCH_RADIUS_M} m` : '')
		+ `, ${STOP_SETBACK_M} m setback`;

	return { stopS, mayGo, report, controlled: byNode.size, matched, unmatched };
}
