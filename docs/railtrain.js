

export const TRAIN = {
	headwayS: 90,
	speedMS: 15,
	accelMS2: 1.0,
	brakeMS2: 1.2,
	dwellS: 20,
	vehicles: 2,
	sectionsPerVehicle: 3,
	sectionM: 12.2,
	gapM: 0.5,
	widthM: 2.65,
	heightM: 3.8,
	floorM: 0.35,
};

const JOIN_M = 1.5;
const PLATFORM_REACH_M = 15;
const MIN_ROUTE_M = 300;
const SKIP_SERVICE = new Set(['crossover', 'siding', 'yard', 'spur']);

function length2(a, b) {
	return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function dirOf(p, q) {
	const d = length2(p, q) || 1;
	return [(q[0] - p[0]) / d, (q[1] - p[1]) / d];
}

export function buildRoutes(data) {
	const pieces = [];
	for (const t of data.tracks || []) {
		if (SKIP_SERVICE.has(t.service)) continue;
		if (!t.xyz || t.xyz.length < 2) continue;
		pieces.push({ id: t.id, pts: t.xyz, tunnel: false });
	}

	const ends = pieces.flatMap((p) => [p.pts[0], p.pts[p.pts.length - 1]]);
	let waiting = (data.tunnels || []).slice();
	for (let progress = true; progress && waiting.length;) {
		progress = false;
		waiting = waiting.filter((tn) => {
			const z = tn.ends.map((e) => {
				let best = null, bd = Infinity;
				for (const q of ends) {
					const d = length2(e, q);
					if (d < bd) { bd = d; best = q; }
				}
				return best && bd < JOIN_M ? best[2] : null;
			});
			const known = z.find((v) => v !== null);
			if (known === undefined) return true;
			const pts = tn.ends.map((e, i) => [e[0], e[1], z[i] !== null ? z[i] : known]);
			pieces.push({ id: tn.id, tunnel: true, pts });
			ends.push(pts[0], pts[1]);
			progress = true;
			return false;
		});
	}

	const endpoints = [];
	pieces.forEach((p, i) => {
		endpoints.push({ piece: i, head: true, xy: p.pts[0] });
		endpoints.push({ piece: i, head: false, xy: p.pts[p.pts.length - 1] });
	});
	const meets = (e) => endpoints.filter((o) => o.piece !== e.piece && length2(o.xy, e.xy) < JOIN_M);

	const oriented = (e) => {
		const pts = pieces[e.piece].pts;
		return e.head ? pts : pts.slice().reverse();
	};

	const walk = (start) => {
		const used = new Set([start.piece]);
		const seq = [{ piece: start.piece, pts: oriented(start) }];
		for (;;) {
			const last = seq[seq.length - 1].pts;
			const tail = { xy: last[last.length - 1], piece: seq[seq.length - 1].piece };
			const n = last.length;
			const heading = dirOf(last[Math.max(0, n - 3)], last[n - 1]);
			let best = null, bestDot = 0.8;
			for (const o of meets(tail)) {
				if (used.has(o.piece)) continue;
				const pts = oriented(o);
				const d = dirOf(pts[0], pts[Math.min(2, pts.length - 1)]);
				const dot = heading[0] * d[0] + heading[1] * d[1];
				if (dot > bestDot) { bestDot = dot; best = { piece: o.piece, pts }; }
			}
			if (!best) break;
			used.add(best.piece);
			seq.push(best);
		}
		return seq;
	};

	const candidates = [];
	for (const e of endpoints) {
		if (meets(e).length) continue;
		const seq = walk(e);
		const pts = [], tunnelRanges = [];
		let s = 0;
		for (const part of seq) {
			const startS = s;
			part.pts.forEach((p, i) => {
				if (pts.length && i === 0) return;
				if (pts.length) s += length2(pts[pts.length - 1], p);
				pts.push(p);
			});
			if (pieces[part.piece].tunnel) tunnelRanges.push([startS, s]);
		}
		if (s < MIN_ROUTE_M) continue;
		candidates.push({ pieces: seq.map((q) => q.piece), pts, length: s, tunnelRanges });
	}
	candidates.sort((a, b) => b.length - a.length);
	const routes = [];
	for (const c of candidates) {
		const mine = new Set(c.pieces);
		const clash = routes.some((r) => {
			const shared = r.pieces.filter((p) => mine.has(p)).length;
			return shared / Math.min(r.pieces.length, c.pieces.length) > 0.3;
		});
		if (!clash) routes.push(c);
	}

	const reverse = (r) => {
		r.pts.reverse();
		r.tunnelRanges = r.tunnelRanges.map(([a, b]) => [r.length - b, r.length - a]);
	};
	for (const r of routes) {
		const i = Math.floor(r.pts.length / 2);
		const p = r.pts[i], d = dirOf(r.pts[Math.max(0, i - 2)], r.pts[Math.min(r.pts.length - 1, i + 2)]);
		let best = null, bd = 40;
		for (const o of routes) {
			if (o === r) continue;
			for (const q of o.pts) {
				const dist = length2(p, q);
				if (dist < bd) { bd = dist; best = q; }
			}
		}
		if (!best) continue;
		const side = d[0] * (best[1] - p[1]) - d[1] * (best[0] - p[0]);
		if (side < 0) reverse(r);
	}
	for (const r of routes) {
		r.s = [0];
		for (let i = 1; i < r.pts.length; i++) r.s.push(r.s[i - 1] + length2(r.pts[i - 1], r.pts[i]));
		r.stops = [];
		for (const pl of data.platforms || []) {
			let best = Infinity, at = 0;
			for (let i = 0; i < r.pts.length; i++) {
				const d = length2(r.pts[i], pl.centroid);
				if (d < best) { best = d; at = r.s[i]; }
			}
			if (best < PLATFORM_REACH_M) r.stops.push({ s: at, platform: pl.id });
		}
		r.stops.sort((a, b) => a.s - b.s);

		r.stops = r.stops.filter((st, i) => i === 0 || st.s - r.stops[i - 1].s > 60);
	}
	return routes;
}

export function sampleRoute(r, s) {
	const { s: S, pts } = r;
	if (s <= 0) return pts[0];
	if (s >= r.length) return pts[pts.length - 1];
	let lo = 0, hi = S.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (S[mid] <= s) lo = mid; else hi = mid;
	}
	const t = (s - S[lo]) / ((S[hi] - S[lo]) || 1);
	const a = pts[lo], b = pts[hi];
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function simulateTrip(r, dials = TRAIN) {
	const trainM = dials.vehicles * dials.sectionsPerVehicle * (dials.sectionM + dials.gapM);
	const dt = 0.25;

	const stops = r.stops.map((st) => st.s + trainM / 2).filter((s) => s > 0 && s < r.length + trainM);
	const table = [];
	let s = 0, v = dials.speedMS, dwell = 0, next = 0;
	for (let t = 0; t < 3600; t += dt) {
		table.push(s);
		if (s > r.length + trainM) break;
		if (dwell > 0) {
			dwell -= dt;
			if (dwell <= 0) next++;
			continue;
		}
		const target = next < stops.length ? stops[next] : Infinity;
		const toGo = target - s;
		if (toGo <= v * v / (2 * dials.brakeMS2) + 0.05) {
			v = Math.max(0, v - dials.brakeMS2 * dt);
			if (v === 0 || toGo <= 0.05) {
				s = Math.min(s, target);
				v = 0;
				dwell = dials.dwellS;
				continue;
			}
		} else {
			v = Math.min(dials.speedMS, v + dials.accelMS2 * dt);
		}
		s += v * dt;
	}
	return { dt, table, duration: table.length * dt, trainM };
}

export function buildRailTrains(THREE, scene, data, dials = TRAIN) {
	const routes = buildRoutes(data);
	if (!routes.length) return null;
	const group = new THREE.Group();
	group.name = 'rail-trains';
	scene.add(group);

	const L = dials.sectionM, W = dials.widthM, H = dials.heightM;
	const bodyGeo = new THREE.BoxGeometry(W, H, L);
	const bandGeo = new THREE.BoxGeometry(W + 0.04, 1.0, L - 0.6);
	const skirtGeo = new THREE.BoxGeometry(W + 0.03, 0.7, L - 0.3);
	const stripeGeo = new THREE.BoxGeometry(W + 0.05, 0.18, L - 0.5);
	const white = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.45, metalness: 0.1 });
	const glass = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.2, metalness: 0.3 });
	const blue = new THREE.MeshStandardMaterial({ color: 0x1d4f9c, roughness: 0.5 });
	const yellow = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.5 });
	const makeSection = () => {
		const g = new THREE.Group();
		const add = (geo, mat, y) => {
			const m = new THREE.Mesh(geo, mat);
			m.position.y = y;
			m.castShadow = true;
			g.add(m);
		};
		add(bodyGeo, white, H / 2);
		add(bandGeo, glass, H * 0.62);
		add(skirtGeo, blue, 0.35);
		add(stripeGeo, yellow, 0.8);
		g.visible = false;
		group.add(g);
		return g;
	};

	const nSections = dials.vehicles * dials.sectionsPerVehicle;
	const lanes = routes.map((r, i) => {
		const trip = simulateTrip(r, dials);
		const slots = Math.ceil(trip.duration / dials.headwayS) + 1;
		const trains = Array.from({ length: slots }, () => Array.from({ length: nSections }, makeSection));
		return { r, trip, trains, offset: (i * dials.headwayS) / Math.max(2, routes.length) };
	});

	const inTunnel = (r, s) => r.tunnelRanges.some(([a, b]) => s >= a && s <= b);
	const fwd = new THREE.Vector3();

	function place(sec, r, sCentre) {
		if (sCentre < 0 || sCentre > r.length || inTunnel(r, sCentre)) {
			sec.visible = false;
			return;
		}
		const a = sampleRoute(r, sCentre - L / 2 + 1.5);
		const b = sampleRoute(r, sCentre + L / 2 - 1.5);
		sec.position.set((a[0] + b[0]) / 2, (a[2] + b[2]) / 2 + dials.floorM, -(a[1] + b[1]) / 2);
		fwd.set(b[0], b[2] + dials.floorM, -b[1]);
		sec.lookAt(fwd);
		sec.visible = true;
	}

	let clock = 0;

	function watch(x, y, reachM = 8) {
		const hits = [];
		for (const lane of lanes) {
			const { r, trip } = lane;
			let best = Infinity, at = 0;
			for (let i = 0; i < r.pts.length - 1; i++) {
				const a = r.pts[i], b = r.pts[i + 1];
				const dx = b[0] - a[0], dy = b[1] - a[1];
				const len2 = dx * dx + dy * dy || 1;
				const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
				const d = Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
				if (d < best) { best = d; at = r.s[i] + t * (r.s[i + 1] - r.s[i]); }
			}
			if (best > reachM) continue;
			let arrive = -1, clear = -1;
			for (let i = 0; i < trip.table.length; i++) {
				if (arrive < 0 && trip.table[i] >= at) arrive = i * trip.dt;
				if (trip.table[i] - trip.trainM >= at) { clear = i * trip.dt; break; }
			}
			if (arrive < 0) continue;
			if (clear < 0) clear = trip.duration;
			hits.push({ lane, arrive, clear });
		}
		if (!hits.length) return null;
		return {
			routes: hits.length,

			eta(leadS, tailS) {
				let soonest = Infinity;
				for (const { lane, arrive, clear } of hits) {
					const t = clock + lane.offset;
					const newest = Math.floor(t / dials.headwayS);

					for (let k = -1; k < lane.trains.length; k++) {
						const tripT = t - (newest - k) * dials.headwayS;
						if (tripT < arrive - leadS || tripT > clear + tailS) continue;
						soonest = Math.min(soonest, Math.max(0, arrive - tripT));
					}
				}
				return soonest;
			},
		};
	}

	return {
		group,
		routes,
		watch,
		report: `${routes.length} route(s) `
			+ routes.map((r) => `${Math.round(r.length)} m/${r.stops.length} stop(s)`).join(', ')
			+ `, a train every ${dials.headwayS} s`,
		update(dt) {
			clock += Math.min(dt, 0.1);
			for (const lane of lanes) {
				const { r, trip, trains } = lane;
				const t = clock + lane.offset;
				const newest = Math.floor(t / dials.headwayS);
				trains.forEach((sections, k) => {
					const tripT = t - (newest - k) * dials.headwayS;
					const f = tripT / trip.dt;
					const idx = Math.floor(f);
					if (tripT < 0 || idx >= trip.table.length - 1) {
						for (const sec of sections) sec.visible = false;
						return;
					}

					const front = trip.table[idx] + (trip.table[idx + 1] - trip.table[idx]) * (f - idx);
					sections.forEach((sec, j) => {
						place(sec, r, front - L / 2 - j * (L + dials.gapM));
					});
				});
			}
		},

		probe() {
			const out = [];
			group.children.forEach((g) => {
				if (g.visible) out.push([+g.position.x.toFixed(1), +g.position.y.toFixed(1), +g.position.z.toFixed(1)]);
			});
			return { clock: +clock.toFixed(1), visible: out.length, first: out.slice(0, 3) };
		},
	};
}
