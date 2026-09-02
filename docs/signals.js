

import * as THREE from 'three';

const CONTROL = import(`./signalcontrol.js${new URL(import.meta.url).search}`);

const FAN_PITCH = 1.45;

const ARM_WIDTH_FACTOR = 0.7;

const MIN_ARM_M = 0.5;

const FAN_MERGE_M = 1.0;

const FAN_MERGE_YAW = 0.20;

const FAN_MERGE_Y_M = 0.60;

function lampRadius(g) {
	return (g.lamp_diameter * g.head_width_m) / 2;
}

export async function buildSignals(url, opts = {}) {
	const { DEFAULT_TIMING, dominantBearing, retime } = await CONTROL;
	const t0 = performance.now();
	const res = await fetch(url);
	if (!res.ok) return null;
	const data = await res.json();
	const heads = data.heads || [];
	if (!heads.length || !(data.controllers || []).length) return null;

	const g = data.geometry;
	const p = data.palette;
	const lit = p.lit.map((c) => new THREE.Color(c[0], c[1], c[2]));

	const unlitDay = lit.map((c) => c.clone().multiplyScalar(p.unlit_factor));
	const nightFactor = p.unlit_night_factor !== undefined
		? p.unlit_night_factor : p.unlit_factor;
	const unlitNight = lit.map((c) => c.clone().multiplyScalar(nightFactor));
	const unlit = unlitDay.map((c) => c.clone());
	function mixUnlit(t) {
		for (let k = 0; k < 3; k++) unlit[k].copy(unlitDay[k]).lerp(unlitNight[k], t);
	}

	const acc = data.controllers.map(() => ({ x: 0, z: 0, n: 0 }));
	for (const h of heads) {
		const a = acc[h[0]];
		if (!a) continue;
		a.x += h[2]; a.z += h[4]; a.n++;
	}
	const sites = acc.map((a) => (a.n ? { x: a.x / a.n, z: a.z / a.n } : { x: 0, z: 0 }));
	const bearing = dominantBearing(heads.map((h) => h[5]));
	const timing = { ...DEFAULT_TIMING, bearingRad: bearing };
	const controllers = opts.upstream
		? data.controllers
		: retime(data.controllers, timing, sites);

	const groups = [];
	for (let i = 0; i < heads.length; i++) {
		const h = heads[i];
		let hit = null;
		for (const cand of groups) {

			if (Math.abs(cand.y - h[3]) > FAN_MERGE_Y_M) continue;
			let dyaw = Math.abs(cand.yaw - h[5]) % (Math.PI * 2);
			if (dyaw > Math.PI) dyaw = Math.PI * 2 - dyaw;
			if (dyaw > FAN_MERGE_YAW) continue;
			if (Math.hypot(cand.x - h[2], cand.z - h[4]) > FAN_MERGE_M) continue;
			hit = cand;
			break;
		}
		if (!hit) {
			hit = { x: h[2], y: h[3], z: h[4], yaw: h[5], at: i, idx: [] };
			groups.push(hit);
		}
		hit.idx.push(i);
	}

	const n = heads.length;

	const place = new Array(n);
	const gantries = [];
	for (const gantry of groups) {
		const grp = gantry.idx;

		const h0 = heads[gantry.at];
		const [, , hx, hy, hz, yaw, roadY, mastX, mastZ] = h0;
		let dx = hx - mastX;
		let dz = hz - mastZ;
		let reach = Math.hypot(dx, dz);

		if (reach < 1e-6) {
			dx = -Math.sin(yaw); dz = -Math.cos(yaw); reach = 0;
		} else {
			dx /= reach; dz /= reach;
		}
		const pitch = FAN_PITCH * g.head_width_m;
		let far = reach;
		for (let j = 0; j < grp.length; j++) {
			const t = (j - (grp.length - 1) / 2) * pitch;
			place[grp[j]] = { x: hx + dx * t, y: hy, z: hz + dz * t, yaw };
			far = Math.max(far, reach + t);
		}
		gantries.push({ mastX, mastZ, roadY, headY: hy, reach: far, dx, dz });
	}

	const unitBox = new THREE.BoxGeometry(1, 1, 1);
	const housingGeom = new THREE.BoxGeometry(g.head_depth_m, g.head_height_m, g.head_width_m);

	const lampGeom = new THREE.CircleGeometry(lampRadius(g), 14).rotateY(Math.PI / 2);

	const mastMat = new THREE.MeshStandardMaterial({
		color: new THREE.Color(p.mast[0], p.mast[1], p.mast[2]),
		roughness: 0.7, metalness: 0.1,
	});
	const housingMat = new THREE.MeshStandardMaterial({
		color: new THREE.Color(p.housing[0], p.housing[1], p.housing[2]),
		roughness: 0.85, metalness: 0.0,
	});

	const lampMat = new THREE.MeshBasicMaterial({ toneMapped: false });

	const withMast = data.mast !== false;
	const poles = new THREE.InstancedMesh(unitBox, mastMat, withMast ? gantries.length : 0);
	const arms = new THREE.InstancedMesh(unitBox, mastMat, withMast ? gantries.length : 0);
	const housings = new THREE.InstancedMesh(housingGeom, housingMat, n);
	const lamps = new THREE.InstancedMesh(lampGeom, lampMat, n * 3);
	lamps.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 9), 3);

	const dummy = new THREE.Object3D();

	const lampY = [g.head_height_m / 3, 0, -g.head_height_m / 3];
	const lampX = g.head_depth_m / 2 + g.lamp_proud_m;

	for (let i = 0; i < n; i++) {
		const q = place[i];
		const cos = Math.cos(q.yaw), sin = Math.sin(q.yaw);

		dummy.position.set(q.x, q.y, q.z);
		dummy.rotation.set(0, q.yaw, 0);
		dummy.scale.set(1, 1, 1);
		dummy.updateMatrix();
		housings.setMatrixAt(i, dummy.matrix);

		dummy.rotation.set(0, q.yaw, 0);
		for (let k = 0; k < 3; k++) {
			dummy.position.set(q.x + lampX * cos, q.y + lampY[k], q.z - lampX * sin);
			dummy.updateMatrix();
			lamps.setMatrixAt(i * 3 + k, dummy.matrix);
			unlit[k].toArray(lamps.instanceColor.array, (i * 3 + k) * 3);
		}
	}

	if (withMast) {
		for (let i = 0; i < gantries.length; i++) {
			const t = gantries[i];

			const armY = t.headY + g.head_height_m / 2;
			const topY = armY + g.mast_overshoot_m;
			dummy.rotation.set(0, 0, 0);
			dummy.position.set(t.mastX, (t.roadY + topY) / 2, t.mastZ);
			dummy.scale.set(g.mast_width_m, Math.max(topY - t.roadY, 0.1), g.mast_width_m);
			dummy.updateMatrix();
			poles.setMatrixAt(i, dummy.matrix);

			const reach = Math.max(t.reach, 0.01);
			const ex = t.mastX + t.dx * reach, ez = t.mastZ + t.dz * reach;
			dummy.position.set((ex + t.mastX) / 2, armY, (ez + t.mastZ) / 2);
			dummy.rotation.set(0, Math.atan2(-t.dz, t.dx), 0);
			dummy.scale.set(t.reach < MIN_ARM_M ? 0.001 : reach,
				g.mast_width_m * ARM_WIDTH_FACTOR, g.mast_width_m * ARM_WIDTH_FACTOR);
			dummy.updateMatrix();
			arms.setMatrixAt(i, dummy.matrix);
		}
	}

	const group = new THREE.Group();
	group.name = 'Signals';
	let triangles = 0;
	for (const mesh of [poles, arms, housings, lamps]) {
		if (!mesh.count) continue;

		mesh.frustumCulled = false;
		mesh.instanceMatrix.needsUpdate = true;
		const idx = mesh.geometry.index;
		triangles += (idx ? idx.count / 3 : mesh.geometry.attributes.position.count / 3) * mesh.count;
		group.add(mesh);
	}

	const prog = controllers.map((c) => {
		const ends = [];
		let sum = 0;
		for (const [duration] of c.phases) { sum += duration; ends.push(sum); }
		return { ...c, ends };
	});
	const byController = prog.map(() => []);
	heads.forEach((h, i) => byController[h[0]].push(i));

	const phase = new Int32Array(prog.length).fill(-1);
	const unknown = new Set();
	const rate = data.rate || 1;
	let clock = 0;

	function phaseIndex(c) {
		const ctl = prog[c];
		if (!ctl) return -1;
		const cycle = ctl.cycle_s;
		if (!(cycle > 0)) return -1;
		const t = (((clock + ctl.offset) % cycle) + cycle) % cycle;
		let index = 0;
		while (index < ctl.ends.length - 1 && t >= ctl.ends[index]) index++;
		return index;
	}

	function apply(force) {
		let dirty = false;
		for (let c = 0; c < prog.length; c++) {
			const ctl = prog[c];
			const index = phaseIndex(c);
			if (index < 0) continue;
			if (index === phase[c] && !force) continue;
			phase[c] = index;
			dirty = true;

			const state = ctl.phases[index][1];
			const colours = lamps.instanceColor.array;
			for (const h of byController[c]) {
				const link = heads[h][1];
				const ch = link >= 0 && link < state.length ? state[link] : null;
				const on = ch === null ? null : data.lamps[ch];
				if (!on && !unknown.has(ch)) {

					unknown.add(ch);
					console.warn(`[signals] no lamp rule for state '${ch}' — the file's`
						+ ' `lamps` table does not cover it');
				}
				for (let k = 0; k < 3; k++) {
					const colour = on && on[k] ? lit[k] : unlit[k];
					colour.toArray(colours, (h * 3 + k) * 3);
				}
			}
		}
		if (dirty) lamps.instanceColor.needsUpdate = true;
	}

	let painted = 0;
	function setNight(level) {
		const t = Math.max(0, Math.min(1, level || 0));
		if (Math.abs(t - painted) < 0.02) return;
		painted = t;
		mixUnlit(t);
		apply(true);
	}
	apply(true);

	const longest = longestRed(prog, heads);
	const report = `${n} heads on ${prog.length} controllers, ${groups.length} gantries`
		+ `${opts.upstream ? ', UPSTREAM timing' : ', retimed'}`
		+ ` — median longest red ${longest.toFixed(0)} s`;
	;

	return {
		group,
		heads: n,
		gantries: groups.length,
		triangles: Math.round(triangles),
		controllers: prog,
		report,
		medianLongestRed: longest,

		heads,

		get timeS() { return clock; },

		stateOf(c) {
			const index = phaseIndex(c);
			if (index < 0) return null;
			return prog[c].phases[index][1];
		},

		setNight,

		update(dt) {
			if (!group.visible) return;
			clock += dt * rate;
			apply(false);
		},
	};
}

function longestRed(prog, heads) {
	const out = [];
	for (const h of heads) {
		const c = prog[h[0]];
		if (!c || !c.phases.length) continue;
		const link = h[1];
		const seq = c.phases.map(([dur, s]) => [dur, link < s.length ? s[link] : 'r']);
		let best = 0;
		for (let start = 0; start < seq.length; start++) {
			let run = 0;
			for (let k = 0; k < seq.length; k++) {
				const [dur, ch] = seq[(start + k) % seq.length];
				if (ch === 'G' || ch === 'g') break;
				run += dur;
			}
			best = Math.max(best, run);
		}
		out.push(Math.min(best, c.cycle_s));
	}
	if (!out.length) return 0;
	out.sort((a, b) => a - b);
	return out[Math.floor(out.length / 2)];
}
