

export const MIN_SPAWN_LEN = 8;

const GRID_CELL_M = 150;

export function mulberry32(seed) {
	let a = seed | 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function buildLaneGraph(data) {
	const src = (data && data.lanes) || [];
	const nodes = [];
	const indexByKey = new Map();
	const stats = {
		lanes: src.length,
		drivable: 0,
		spawnable: 0,
		edges: 0,
		deadEnds: 0,
		droppedDeadLink: 0,
		totalMetres: 0,
		spawnMetres: 0,

		reversed: (data && data.stats && data.stats.reversed) || 0,
	};

	for (const lane of src) {
		const p = lane.p;
		if (!p || p.length < 2) continue;
		const n = p.length;
		const pts = new Float32Array(n * 3);
		const cum = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			pts[i * 3] = p[i][0];
			pts[i * 3 + 1] = p[i][1];
			pts[i * 3 + 2] = p[i][2];

			if (i > 0) {
				cum[i] = cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][2] - p[i - 1][2]);
			}
		}
		const length = cum[n - 1];
		if (!(length > 0)) continue;
		stats.drivable++;
		stats.totalMetres += length;
		indexByKey.set(`${lane.r}:${lane.l}`, nodes.length);
		nodes.push({
			roadId: lane.r,
			laneId: lane.l,
			widthM: lane.w || 3.2,

			speedLimit: lane.v || 0,
			pts,
			cum,
			length,
			exits: [],

			inBox: lane.in === undefined ? true : !!lane.in,

		});
	}

	for (let i = 0; i < src.length; i++) {
		const from = indexByKey.get(`${src[i].r}:${src[i].l}`);
		if (from === undefined) continue;
		for (const [rid, lid] of src[i].n || []) {
			const to = indexByKey.get(`${rid}:${lid}`);
			if (to === undefined) {
				stats.droppedDeadLink++;
				continue;
			}
			nodes[from].exits.push(to);
			stats.edges++;
		}
	}
	for (const n of nodes) if (!n.exits.length) stats.deadEnds++;

	const spawn = [];
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i].length >= MIN_SPAWN_LEN && nodes[i].exits.length && nodes[i].inBox) spawn.push(i);
	}
	const spawnCum = new Float32Array(spawn.length);
	let acc = 0;
	for (let i = 0; i < spawn.length; i++) {
		acc += nodes[spawn[i]].length;
		spawnCum[i] = acc;
	}
	stats.spawnable = spawn.length;
	stats.spawnMetres = acc;

	return {
		nodes,
		spawn,
		spawnCum,
		grid: buildSpawnGrid(nodes, spawn),
		stats,
		indexByKey,

		halfM: (data && data.half_m) || Infinity,
	};
}

function buildSpawnGrid(nodes, spawn) {
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	for (const i of spawn) {
		const p = nodes[i].pts;
		for (let k = 0; k < p.length; k += 3) {
			if (p[k] < minX) minX = p[k];
			if (p[k] > maxX) maxX = p[k];
			if (p[k + 2] < minZ) minZ = p[k + 2];
			if (p[k + 2] > maxZ) maxZ = p[k + 2];
		}
	}
	if (!Number.isFinite(minX)) {
		return { cell: GRID_CELL_M, minX: 0, minZ: 0, cols: 1, rows: 1, buckets: [[]] };
	}
	const cols = Math.max(1, Math.ceil((maxX - minX) / GRID_CELL_M) + 1);
	const rows = Math.max(1, Math.ceil((maxZ - minZ) / GRID_CELL_M) + 1);
	const buckets = Array.from({ length: cols * rows }, () => []);
	for (const i of spawn) {
		const p = nodes[i].pts;
		let last = -1;
		for (let k = 0; k < p.length; k += 3) {
			const c = Math.min(cols - 1, Math.max(0, Math.floor((p[k] - minX) / GRID_CELL_M)));
			const r = Math.min(rows - 1, Math.max(0, Math.floor((p[k + 2] - minZ) / GRID_CELL_M)));
			const b = r * cols + c;

			if (b !== last) {
				if (!buckets[b].includes(i)) buckets[b].push(i);
				last = b;
			}
		}
	}
	return { cell: GRID_CELL_M, minX, minZ, cols, rows, buckets };
}

export function sampleLane(node, s) {
	const n = node.cum.length;
	const t = Math.max(0, Math.min(node.length, s));

	let lo = 1;
	let hi = n - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (node.cum[mid] < t) lo = mid + 1;
		else hi = mid;
	}
	const i = lo;
	const seg = node.cum[i] - node.cum[i - 1];
	const f = seg > 1e-9 ? (t - node.cum[i - 1]) / seg : 0;
	const ax = node.pts[(i - 1) * 3];
	const ay = node.pts[(i - 1) * 3 + 1];
	const az = node.pts[(i - 1) * 3 + 2];
	const bx = node.pts[i * 3];
	const by = node.pts[i * 3 + 1];
	const bz = node.pts[i * 3 + 2];
	return {
		x: ax + (bx - ax) * f,
		y: ay + (by - ay) * f,
		z: az + (bz - az) * f,
		heading: Math.atan2(bx - ax, bz - az),
	};
}

export function pickExit(graph, node, rand) {
	const e = graph.nodes[node].exits;
	if (!e.length) return -1;
	return e[Math.min(e.length - 1, Math.floor(rand() * e.length))];
}

export function pickSpawnNear(graph, x, z, radius, rand) {
	const g = graph.grid;
	const c0 = Math.max(0, Math.floor((x - radius - g.minX) / g.cell));
	const c1 = Math.min(g.cols - 1, Math.floor((x + radius - g.minX) / g.cell));
	const r0 = Math.max(0, Math.floor((z - radius - g.minZ) / g.cell));
	const r1 = Math.min(g.rows - 1, Math.floor((z + radius - g.minZ) / g.cell));

	const seen = new Set();
	const near = [];
	let weight = 0;
	for (let r = r0; r <= r1; r++) {
		for (let c = c0; c <= c1; c++) {
			for (const i of g.buckets[r * g.cols + c]) {
				if (seen.has(i)) continue;
				seen.add(i);
				near.push(i);
				weight += graph.nodes[i].length;
			}
		}
	}
	if (weight <= 0) return -1;
	let draw = rand() * weight;
	for (const i of near) {
		draw -= graph.nodes[i].length;
		if (draw <= 0) return i;
	}
	return near[near.length - 1];
}

export function buildSpawnField(graph) {
	const g = graph.grid;
	const near = [];

	const cum = [];
	const seen = new Set();
	let builtCol = NaN;
	let builtRow = NaN;
	let builtRadius = NaN;

	return {
		get size() {
			return near.length;
		},
		update(x, z, radius) {

			const col = Math.floor((x - g.minX) / g.cell);
			const row = Math.floor((z - g.minZ) / g.cell);
			if (col === builtCol && row === builtRow && radius === builtRadius) return;
			builtCol = col;
			builtRow = row;
			builtRadius = radius;

			const c0 = Math.max(0, Math.floor((x - radius - g.minX) / g.cell));
			const c1 = Math.min(g.cols - 1, Math.floor((x + radius - g.minX) / g.cell));
			const r0 = Math.max(0, Math.floor((z - radius - g.minZ) / g.cell));
			const r1 = Math.min(g.rows - 1, Math.floor((z + radius - g.minZ) / g.cell));
			near.length = 0;
			cum.length = 0;
			seen.clear();
			let weight = 0;
			for (let r = r0; r <= r1; r++) {
				for (let c = c0; c <= c1; c++) {
					for (const i of g.buckets[r * g.cols + c]) {
						if (seen.has(i)) continue;
						seen.add(i);
						near.push(i);
						weight += graph.nodes[i].length;
						cum.push(weight);
					}
				}
			}
		},
		pick(rand) {
			const n = near.length;
			if (!n) return -1;
			const weight = cum[n - 1];
			if (weight <= 0) return -1;
			const draw = rand() * weight;

			let lo = 0;
			let hi = n - 1;
			while (lo < hi) {
				const mid = (lo + hi) >> 1;
				if (cum[mid] < draw) lo = mid + 1;
				else hi = mid;
			}
			return near[lo];
		},
	};
}
