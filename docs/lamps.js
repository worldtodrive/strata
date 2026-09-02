

import * as THREE from './vendor/three.module.js';

const POLE_COLOR = 0x3a3f47;

const HALO_M = {

	junction: 3.8,
	highway: 3.4,
	arterial: 2.8,
	carpark: 3.0,
	bridge: 2.6,
	residential: 2.2,
	park: 1.6,

	garage: 1.1,

	rooftop: 1.5,
};

const HALO_GAIN = 0.34;

const CEILING_FAMILIES = new Set(['garage']);

const PAN = { w: 1.15, h: 0.09, d: 0.34 };

const HEAD_GAIN = 1.6;

function haloTexture(N = 64) {
	const data = new Uint8Array(N * N * 4);
	for (let j = 0; j < N; j += 1) {
		for (let i = 0; i < N; i += 1) {
			const x = (i + 0.5) / N - 0.5;
			const y = (j + 0.5) / N - 0.5;
			const r = Math.min(1, Math.hypot(x, y) * 2);
			const t = 1 - r * r;
			const c = (j * N + i) * 4;
			data[c] = 255;
			data[c + 1] = 255;
			data[c + 2] = 255;
			data[c + 3] = Math.round(Math.max(0, t * t) * 255);
		}
	}
	const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
	tex.magFilter = THREE.LinearFilter;
	tex.minFilter = THREE.LinearFilter;
	tex.needsUpdate = true;
	return tex;
}

function merge(parts) {
	const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
	let n = 0;
	for (const g of flat) n += g.getAttribute('position').count;
	const pos = new Float32Array(n * 3);
	const nor = new Float32Array(n * 3);
	let at = 0;
	for (const g of flat) {
		const p = g.getAttribute('position');
		const q = g.getAttribute('normal');
		pos.set(p.array, at * 3);
		if (q) nor.set(q.array, at * 3);
		at += p.count;
	}
	const out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	out.computeBoundingSphere();
	return out;
}

function frustum(n, r0, r1, h, open = true) {
	const g = new THREE.CylinderGeometry(r1, r0, h, n, 1, open);
	g.rotateY(Math.PI / n);
	g.translate(0, h / 2, 0);
	return g;
}

const LANTERN = {
	glassH: 0.62,
	glassBot: 0.30,
	glassTop: 0.19,
	capH: 0.30,
	capOver: 1.32,
	finialH: 0.26,
	skirtH: 0.13,
};

function lanternFrame(spec) {
	const L = LANTERN;
	const y0 = spec.pole;
	const parts = [];

	const skirt = frustum(4, L.glassBot * 1.28, L.glassBot, L.skirtH, true);
	skirt.translate(0, y0, 0);
	parts.push(skirt);

	const cap = frustum(4, L.glassTop * L.capOver, L.glassTop * 0.16, L.capH, true);
	cap.translate(0, y0 + L.skirtH + L.glassH, 0);
	parts.push(cap);

	const finial = frustum(4, 0.075, 0.012, L.finialH, false);
	finial.translate(0, y0 + L.skirtH + L.glassH + L.capH, 0);
	parts.push(finial);
	return parts;
}

const POLE_ROOT_M = 1.1;

function poleGeometry(spec) {
	const parts = [];
	const h = spec.pole + POLE_ROOT_M;
	const shaft = new THREE.CylinderGeometry(spec.poleR * 0.6, spec.poleR, h, 6, 1, true);
	shaft.translate(0, spec.pole - h / 2, 0);
	parts.push(shaft);
	if (spec.arm > 0) {
		const arm = new THREE.CylinderGeometry(0.05, 0.065, spec.arm, 5, 1, true);
		arm.rotateZ(Math.PI / 2);
		arm.translate(spec.arm / 2, spec.pole + 0.12, 0);
		parts.push(arm);
	} else {

		const collar = new THREE.CylinderGeometry(spec.poleR * 1.5, spec.poleR * 0.9, 0.22, 6);
		collar.translate(0, spec.pole - 0.11, 0);
		parts.push(collar);

		for (const g of lanternFrame(spec)) parts.push(g);
	}
	return merge(parts);
}

function headGeometry(spec) {
	if (spec.arm > 0) {

		const head = new THREE.BoxGeometry(0.62, 0.15, 0.3);
		head.translate(spec.arm, spec.pole + 0.02, 0);
		return head;
	}

	const L = LANTERN;
	const glass = frustum(4, L.glassBot, L.glassTop, L.glassH, true);
	glass.translate(0, spec.pole + L.skirtH, 0);
	return glass;
}

const BEAM_DROP_M = 0.55;

function bracketGeometry() {
	const g = new THREE.BoxGeometry(1, 0.3, 0.22);
	g.translate(0.5, -BEAM_DROP_M, 0);
	return g;
}

function headLocal(spec) {
	return spec.arm > 0
		? [spec.arm, spec.pole + 0.02, 0]

		: [0, spec.pole + LANTERN.skirtH + LANTERN.glassH * 0.5, 0];
}

function triCount(g) {
	return (g.index ? g.index.count : g.getAttribute('position').count) / 3;
}

export async function buildLamps(url, opts = {}) {
	const res = await fetch(url, { cache: 'no-store' });
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	const fleet = await res.json();
	if (!fleet || !fleet.lamps || !fleet.lamps.length) return null;

	const group = new THREE.Group();
	group.name = 'lamps';
	const halo = haloTexture();
	const families = {};
	let triangles = 0;

	const byType = {};
	for (const lamp of fleet.lamps) (byType[lamp.t] || (byType[lamp.t] = [])).push(lamp);

	const m = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const up = new THREE.Vector3(0, 1, 0);
	const pos = new THREE.Vector3();
	const one = new THREE.Vector3(1, 1, 1);

	for (const [name, rows] of Object.entries(byType)) {
		const raw = fleet.types[name];
		if (!raw) continue;

		const spec = raw.pole > 0 ? raw : { ...raw, pole: raw.mount };

		const ceiling = CEILING_FAMILIES.has(name);
		const poleGeo = ceiling
			? new THREE.BoxGeometry(PAN.w * 0.55, 0.04, PAN.d * 0.55)
			: poleGeometry(spec);
		const headGeo = ceiling
			? new THREE.BoxGeometry(PAN.w, PAN.h, PAN.d)
			: headGeometry(spec);
		if (ceiling) {

			poleGeo.translate(0, -0.02, 0);
			headGeo.translate(0, -0.04 - PAN.h / 2, 0);
		}

		const poleMat = new THREE.MeshStandardMaterial({
			color: POLE_COLOR, roughness: 0.72, metalness: 0.35,
		});

		const headMat = new THREE.MeshBasicMaterial({
			color: 0x000000, toneMapped: true, fog: true,
		});

		const poles = new THREE.InstancedMesh(poleGeo, poleMat, rows.length);
		const heads = new THREE.InstancedMesh(headGeo, headMat, rows.length);

		const braced = rows.filter((r) => (r.k || 0) > 0);
		const beams = braced.length
			? new THREE.InstancedMesh(bracketGeometry(), poleMat, braced.length)
			: null;
		if (beams) {
			beams.name = `lamp-beam-${name}`;
			beams.castShadow = false;
			beams.receiveShadow = true;
		}
		poles.name = `lamp-pole-${name}`;
		heads.name = `lamp-head-${name}`;
		poles.castShadow = false;
		heads.castShadow = false;

		poles.receiveShadow = true;
		heads.receiveShadow = false;

		const [hx, hy, hz] = headLocal(spec);
		const haloPos = new Float32Array(rows.length * 3);
		const haloCol = new Float32Array(rows.length * 3);

		let bi = 0;
		const beamScale = new THREE.Vector3();
		const shortPole = new THREE.Vector3();
		const headDrop = new THREE.Vector3();
		rows.forEach((lamp, i) => {
			q.setFromAxisAngle(up, lamp.y);
			pos.set(lamp.b[0], lamp.b[1], lamp.b[2]);
			m.compose(pos, q, one);

			const f = (lamp.m || 0) > 0 ? lamp.m / spec.pole : 1;
			if (f < 1) {
				shortPole.set(1, f, 1);
				m.compose(pos, q, shortPole);
				poles.setMatrixAt(i, m);
				headDrop.set(pos.x, pos.y + (f - 1) * (spec.pole + 0.12), pos.z);
				m.compose(headDrop, q, one);
				heads.setMatrixAt(i, m);
				m.compose(pos, q, one);
			} else {
				poles.setMatrixAt(i, m);
				heads.setMatrixAt(i, m);
			}

			if (beams && (lamp.k || 0) > 0) {
				beamScale.set(lamp.k, 1, 1);
				m.compose(pos, q, beamScale);
				beams.setMatrixAt(bi, m);
				bi += 1;
				m.compose(pos, q, one);
			}

			const c = Math.cos(lamp.y);
			const s = Math.sin(lamp.y);
			haloPos[i * 3] = lamp.b[0] + hx * c + hz * s;
			haloPos[i * 3 + 1] = lamp.b[1] + hy;
			haloPos[i * 3 + 2] = lamp.b[2] - hx * s + hz * c;
		});
		poles.instanceMatrix.needsUpdate = true;
		heads.instanceMatrix.needsUpdate = true;
		poles.computeBoundingSphere();
		heads.computeBoundingSphere();
		if (beams) {
			beams.instanceMatrix.needsUpdate = true;
			beams.computeBoundingSphere();
		}

		const haloGeo = new THREE.BufferGeometry();
		haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(haloPos, 3));
		haloGeo.setAttribute('color', new THREE.Float32BufferAttribute(haloCol, 3));
		haloGeo.computeBoundingSphere();

		const haloMat = new THREE.PointsMaterial({
			color: 0x000000,
			map: halo,
			size: HALO_M[name] || 2.4,
			sizeAttenuation: true,
			vertexColors: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			transparent: true,
			toneMapped: true,
			fog: true,
		});
		const halos = new THREE.Points(haloGeo, haloMat);
		halos.name = `lamp-halo-${name}`;
		halos.frustumCulled = true;

		group.add(poles, heads, halos);
		if (beams) group.add(beams);
		triangles += (triCount(poleGeo) + triCount(headGeo)) * rows.length
			+ (beams ? 12 * braced.length : 0);
		families[name] = {
			spec, rows, poles, heads, halos, beams, headMat, haloMat, poleMat,
			tint: new THREE.Color(spec.tint),
		};
	}

	let mode = opts.mode || 'orb';
	let night = 0;

	let daylight = !!opts.daylight;

	function apply() {
		const on = mode === 'off' ? 0 : night;

		group.visible = daylight || on > 0.004;
		for (const f of Object.values(families)) {
			f.headMat.color.copy(f.tint).multiplyScalar(on * HEAD_GAIN);
			f.haloMat.color.copy(f.tint).multiplyScalar(on * HALO_GAIN);

			f.halos.visible = on > 0.004;
		}
	}
	apply();

	return {
		group,
		fleet,
		families,
		lamps: fleet.lamps,
		types: fleet.types,
		kernel: fleet.kernel,
		byType: fleet.by_type,
		triangles,

		get mode() { return mode; },
		set mode(v) { mode = v; apply(); },

		get daylight() { return daylight; },
		set daylight(v) { daylight = !!v; apply(); },

		setNight(v) {
			if (Math.abs(v - night) < 1e-4) return;
			night = v;
			apply();
		},
		dispose() {
			for (const f of Object.values(families)) {
				f.poles.geometry.dispose();
				f.heads.geometry.dispose();
				f.halos.geometry.dispose();
				if (f.beams) f.beams.geometry.dispose();
				f.poleMat.dispose();
				f.headMat.dispose();
				f.haloMat.dispose();
			}
			halo.dispose();
		},
	};
}
