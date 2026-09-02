

import * as THREE from './vendor/three.module.js';
import { bodyGeometry, carPaint } from './npctraffic.js';

const FILL = 0.5;

const SIT_M = 0.02;

function mulberry32(a) {
	return function () {
		a |= 0; a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export async function buildGarageCars(src, opts = {}) {
	const fill = Math.min(1, Math.max(0, opts.fill === undefined ? FILL : opts.fill));
	let data = null;
	try {
		const res = await fetch(src);
		if (!res.ok) return null;
		data = await res.json();
	} catch (err) {

		return null;
	}
	const sites = (data && data.sites) || [];
	if (!sites.length) return null;

	const chosen = [];
	const rand = mulberry32(0x9e3779b9);
	for (const site of sites) {
		for (const bay of site.bays || []) {
			if (rand() < fill) chosen.push(bay);
		}
	}
	if (!chosen.length) return null;

	const geo = bodyGeometry();
	const mat = new THREE.MeshStandardMaterial({
		color: 0xffffff, roughness: 0.55, metalness: 0.12,

		vertexColors: false,
	});
	const mesh = new THREE.InstancedMesh(geo, mat, chosen.length);
	mesh.castShadow = false;
	mesh.receiveShadow = false;

	mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
	mesh.frustumCulled = true;

	const m = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const up = new THREE.Vector3(0, 1, 0);
	const pos = new THREE.Vector3();
	const one = new THREE.Vector3(1, 1, 1);
	const paint = new THREE.Color();
	const paintRand = mulberry32(0x85ebca6b);
	chosen.forEach((bay, i) => {

		const f = bay.f || [1, 0];
		q.setFromAxisAngle(up, Math.atan2(f[0], f[1]));
		pos.set(bay.b[0], bay.b[1] + SIT_M, bay.b[2]);
		m.compose(pos, q, one);
		mesh.setMatrixAt(i, m);
		mesh.setColorAt(i, carPaint(paintRand(), paint));
	});
	mesh.instanceMatrix.needsUpdate = true;
	if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

	const group = new THREE.Group();
	group.name = 'garage-cars';
	group.add(mesh);
	const total = sites.reduce((n, s) => n + (s.bays || []).length, 0);
	return {
		group,

		footprints: sites.map((s) => s.rect).filter(Boolean),
		materials: [mat],
		count: chosen.length,
		report: `${chosen.length.toLocaleString()} parked in `
			+ `${total.toLocaleString()} bays across ${sites.length} garage(s), `
			+ `${Math.round(fill * 100)}% fill — seeded, none of them drove in`,
	};
}
