

import * as THREE from 'three';

export const WATER_NUDGE_M = 0.20;

const HORIZON_M = 8000;

const WATER_COLOR = 0x21506e;

const INNER_EPS_M = 0.25;

const BUCKETS = 64;

function prepare(ring) {
	let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
	for (const [x, z] of ring) {
		if (x < x0) x0 = x;
		if (x > x1) x1 = x;
		if (z < z0) z0 = z;
		if (z > z1) z1 = z;
	}
	const span = (z1 - z0) || 1;
	const buckets = Array.from({ length: BUCKETS }, () => []);
	const band = (z) => Math.min(BUCKETS - 1,
		Math.max(0, Math.floor((z - z0) / span * BUCKETS)));
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = ring[i], b = ring[j];
		const lo = band(Math.min(a[1], b[1]));
		const hi = band(Math.max(a[1], b[1]));
		for (let k = lo; k <= hi; k++) buckets[k].push(a[0], a[1], b[0], b[1]);
	}
	return {
		bounds: [x0, z0, x1, z1],
		buckets: buckets.map((b) => Float64Array.from(b)),
		z0, span,
	};
}

function inPrepared(x, z, prep) {
	const [x0, z0, x1, z1] = prep.bounds;
	if (x < x0 || x > x1 || z < z0 || z > z1) return false;
	const index = Math.min(BUCKETS - 1,
		Math.max(0, Math.floor((z - prep.z0) / prep.span * BUCKETS)));
	const edges = prep.buckets[index];
	let inside = false;
	for (let i = 0; i < edges.length; i += 4) {
		const ax = edges[i], az = edges[i + 1], bx = edges[i + 2], bz = edges[i + 3];
		if ((az > z) !== (bz > z)
			&& x < (bx - ax) * (z - az) / (bz - az + 1e-30) + ax) {
			inside = !inside;
		}
	}
	return inside;
}

export async function loadWaterRings(meta, href) {
	const file = meta && meta.water && meta.water.file;
	if (!file) return null;
	const response = await fetch(href);
	if (!response.ok) return null;
	const document = await response.json();
	for (const polygon of document.polygons || []) {
		polygon.prep = prepare(polygon.outer);
		polygon.holePreps = (polygon.holes || []).map(prepare);
	}
	return document;
}

function isWet(x, z, rings) {
	for (const polygon of rings.polygons) {
		if (!inPrepared(x, z, polygon.prep)) continue;
		let inHole = false;
		for (const hole of polygon.holePreps) {
			if (inPrepared(x, z, hole)) { inHole = true; break; }
		}
		if (!inHole) return true;
	}
	return false;
}

export function dropCoverInWater(root, rings) {
	if (!rings || !rings.polygons || !rings.polygons.length) return 0;
	let dropped = 0;

	root.traverse((object) => {
		if (!object.isMesh || !object.geometry) return;
		const geometry = object.geometry;
		const position = geometry.getAttribute('position');
		if (!position) return;
		const array = position.array;
		const index = geometry.index;
		const count = index ? index.count : position.count;
		const read = index ? (i) => index.getX(i) : (i) => i;

		const kept = [];
		let hit = 0;
		for (let t = 0; t < count; t += 3) {
			const a = read(t), b = read(t + 1), c = read(t + 2);
			const cx = (array[a * 3] + array[b * 3] + array[c * 3]) / 3;
			const cz = (array[a * 3 + 2] + array[b * 3 + 2] + array[c * 3 + 2]) / 3;
			if (isWet(cx, cz, rings)) { hit++; continue; }
			kept.push(a, b, c);
		}
		if (hit) {
			dropped += hit;
			geometry.setIndex(kept);
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
		}
	});
	return dropped;
}

export function waterLevel(meta) {
	if (meta && meta.water && typeof meta.water.y === 'number') {
		return { y: meta.water.y + WATER_NUDGE_M, source: 'sidecar' };
	}
	const zref = (meta && typeof meta.zref === 'number') ? meta.zref : 0;
	return { y: -zref + WATER_NUDGE_M, source: 'zref (assumes surface_z 0)' };
}

function buildRingGeometry(rings, { base = 0, filter = null, holesFor = null } = {}) {
	const pos = [];
	let polys = 0;
	let holes = 0;
	let tris = 0;

	const toV2 = (ring) => {
		const pts = ring.map(([x, z]) => new THREE.Vector2(x, z));

		if (pts.length > 1) {
			const a = pts[0];
			const b = pts[pts.length - 1];
			if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) pts.pop();
		}
		return pts;
	};

	for (const polygon of rings.polygons || []) {
		if (filter && !filter(polygon)) continue;
		const outer = toV2(polygon.outer || []);
		if (outer.length < 3) continue;

		const dy = (typeof polygon.y === 'number') ? polygon.y - base : 0;

		if (THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
		const inner = [];
		const honourHoles = holesFor ? !!holesFor(polygon) : false;
		if (honourHoles) {
			for (const hole of polygon.holes || []) {
				const h = toV2(hole);
				if (h.length < 3) continue;
				if (!THREE.ShapeUtils.isClockWise(h)) h.reverse();
				inner.push(h);
			}
		}
		let faces;
		try {
			faces = THREE.ShapeUtils.triangulateShape(outer, inner);
		} catch (err) {

			console.warn('[water] ring failed to triangulate, skipped:', err);
			continue;
		}
		const verts = outer.concat(...inner);
		for (const face of faces) {
			for (const index of face) {
				const v = verts[index];
				if (!v) continue;

				pos.push(v.x, dy, v.y);
			}
			tris++;
		}
		polys++;
		holes += inner.length;
	}

	if (!pos.length) return null;
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.computeVertexNormals();
	geo.computeBoundingBox();
	geo.computeBoundingSphere();
	geo.userData.stats = { polys, holes, tris };
	return geo;
}

export function createWater(scene, meta, rings) {
	const level = waterLevel(meta);

	const geometry = new THREE.PlaneGeometry(1, 1);
	const material = new THREE.MeshStandardMaterial({
		color: WATER_COLOR, roughness: 0.25, metalness: 0.1,

		side: THREE.DoubleSide,

	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.rotation.x = -Math.PI / 2;
	mesh.position.y = level.y;
	mesh.name = 'water';

	setSheetOpacity(material, mesh, 1.0);

	mesh.userData.drivable = false;
	scene.add(mesh);

	let holeMode = 'smart';
	const holesFor = (polygon) => {
		if (holeMode === 'all') return true;
		if (holeMode === 'none') return false;
		return !polygon.river;
	};

	const servedByPlane = (polygon) =>
		typeof polygon.y !== 'number' || Math.abs(polygon.y - level.y) <= INNER_EPS_M;

	let ringGeo = null;
	let ringMesh = null;
	let innerMesh = null;
	let innerCount = 0;

	function buildRings() {
		for (const old of [ringMesh, innerMesh]) {
			if (!old) continue;
			scene.remove(old);
			old.geometry.dispose();
		}
		ringMesh = null;
		innerMesh = null;
		ringGeo = null;
		innerCount = 0;
		if (!rings) return;

		ringGeo = buildRingGeometry(rings, { base: level.y, holesFor });
		if (ringGeo) {
			ringMesh = new THREE.Mesh(ringGeo, material);
			ringMesh.position.y = level.y;
			ringMesh.name = 'water-rings';
			ringMesh.userData.drivable = false;
			scene.add(ringMesh);
		}

		const inner = (rings.polygons || []).filter((p) => !servedByPlane(p));
		innerCount = inner.length;
		if (inner.length) {
			const geo = buildRingGeometry(rings, {
				base: level.y, holesFor, filter: (p) => !servedByPlane(p),
			});
			if (geo) {
				innerMesh = new THREE.Mesh(geo, material);
				innerMesh.position.y = level.y;
				innerMesh.name = 'water-inner';

				innerMesh.userData.drivable = false;
				scene.add(innerMesh);
			}
			;
		}
	}
	buildRings();

	let kind = 'plane';
	let visible = true;

	function applyKind() {
		mesh.visible = visible && kind === 'plane';
		if (ringMesh) ringMesh.visible = visible && kind === 'rings';

		if (innerMesh) innerMesh.visible = visible && kind === 'plane';
	}

	let report = `sheet at y=${level.y.toFixed(2)} from ${level.source}`;

	function fit() {

		const box = new THREE.Box3();
		for (const child of scene.children) {

			if (child === mesh || child === ringMesh || child === innerMesh) continue;
			const b = new THREE.Box3().setFromObject(child);
			if (b.isEmpty()) continue;
			box.union(b);
		}
		if (box.isEmpty()) return;
		const sx = box.max.x - box.min.x + 2 * HORIZON_M;
		const sz = box.max.z - box.min.z + 2 * HORIZON_M;

		mesh.scale.set(sx, sz, 1);
		mesh.position.x = (box.min.x + box.max.x) / 2;
		mesh.position.z = (box.min.z + box.max.z) / 2;
		const s = ringGeo && ringGeo.userData.stats;
		const inner = innerCount
			? ` + ${innerCount} inner body(ies) at their own height`
			: '';
		report = kind === 'rings'
			? `${s.polys} mapped polygon(s), ${s.holes} hole(s), `
				+ `${s.tris.toLocaleString()} triangles at y=${level.y.toFixed(2)}, `
				+ `placed from ${level.source} — edge is the RING, not the terrain grid`
			: `${Math.round(sx)} x ${Math.round(sz)} m plane at y=`
				+ `${mesh.position.y.toFixed(2)}, placed from ${level.source}`
				+ ' — edge is wherever the terrain crosses it, at 10 m' + inner;
		applyKind();
		;
	}

	applyKind();

	return {
		mesh,
		fit,
		get report() { return report; },
		get visible() { return visible; },
		setVisible(on) { visible = !!on; applyKind(); },
		setOpacity(x) {
			setSheetOpacity(material, mesh, x);
			if (ringMesh) ringMesh.renderOrder = mesh.renderOrder;
			if (innerMesh) innerMesh.renderOrder = mesh.renderOrder;
		},
		get opacity() { return material.opacity; },
		get material() { return material; },

		get kind() { return kind; },
		get hasRings() { return !!ringMesh; },
		setKind(k) { kind = (k === 'rings' && ringMesh) ? 'rings' : 'plane'; fit(); },

		get innerCount() { return innerCount; },

		get holeMode() { return holeMode; },
		setHoles(m) {
			holeMode = (m === 'all' || m === 'none') ? m : 'smart';
			buildRings();

			applyKind();
			fit();
		},
	};
}

function setSheetOpacity(material, mesh, x) {
	const o = Math.max(0, Math.min(1, Number(x)));
	const clear = o < 1;
	material.opacity = o;
	material.transparent = clear;
	material.depthWrite = !clear;

	mesh.renderOrder = clear ? 1 : 0;
	material.needsUpdate = true;
	return o;
}
