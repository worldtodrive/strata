

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { buildSpawnField, mulberry32, pickExit, sampleLane } from './npcgraph.js';

export const TRAFFIC = {

	on: true,

	count: 260,

	speedMin: 0.75,
	speedMax: 1.15,

	limitFallback: 13.4,

	spawnRadius: 900,

	headwayM: 5.5,

	edgeM: 40,

	colourVariety: 1,

	shadows: true,

	lampGlow: 1,
};

export const MAX_NPCS = 4000;

const RECYCLE_FACTOR = 1.8;

const SPAWN_MIN_M = 45;

export const DEFAULT_HEADWAY_M = 5.5;

const HALO_MIN_PX = 3;

const HALO_SIZE_M = 1.1;

const HALO_FADE_NEAR = 6;
const HALO_FADE_FAR = 35;

const FACE_OFF = -0.20;
const FACE_FULL = 0.28;

function facingRamp(cosTheta) {
	const u = (cosTheta - FACE_OFF) / (FACE_FULL - FACE_OFF);
	if (u <= 0) return 0;
	if (u >= 1) return 1;
	return u * u * (3 - 2 * u);
}

const MAX_HOPS_PER_TICK = 8;

const MAX_DT = 0.1;

function frac(x) {
	return x - Math.floor(x);
}

export function carPaint(t, out = new THREE.Color(), variety = TRAFFIC.colourVariety) {
	const v = Math.min(1, Math.max(0, variety));
	return out.setHSL(frac(t), (0.18 + frac(t * 37.7) * 0.22) * v, 0.32 + frac(t * 91.3) * 0.3);
}

const HEAD_COLOUR = new THREE.Color(0.85, 0.56, 0.14);
const TAIL_COLOUR = new THREE.Color(0.34, 0.02, 0.01);
const BRAKE_COLOUR = new THREE.Color(1.0, 0.07, 0.03);

const CAR_W = 1.02;
const CAR_L = 2.24;

export function bodyGeometry() {
	const parts = [];
	const body = new THREE.BoxGeometry(CAR_W, 0.36, CAR_L);
	body.translate(0, 0.28, 0);
	parts.push(body);

	const cabin = new THREE.BoxGeometry(CAR_W * 0.82, 0.30, CAR_L * 0.46);
	cabin.translate(0, 0.58, -0.10);
	parts.push(cabin);
	const merged = mergeGeometries(parts, false);
	for (const p of parts) p.dispose();
	if (!merged) throw new Error('npc car geometry failed to merge');
	merged.computeVertexNormals();
	return merged;
}

function bulbPair(face, y, halfX, size) {
	const depth = size * 0.6;

	const z = face + Math.sign(face) * (depth * 0.5 - 0.01);
	const parts = [];
	for (const sx of [-1, 1]) {
		const b = new THREE.BoxGeometry(size * 1.5, size, depth);
		b.translate(sx * halfX, y, z);
		parts.push(b);
	}
	const merged = mergeGeometries(parts, false);
	for (const p of parts) p.dispose();
	if (!merged) throw new Error('npc bulb geometry failed to merge');
	return merged;
}

function lampMaterial() {
	return new THREE.MeshBasicMaterial({
		color: 0xffffff,
		blending: THREE.AdditiveBlending,
		transparent: true,
		depthWrite: false,
		toneMapped: true,
	});
}

function haloTexture(size = 128, core = 0.02, falloff = 3.4) {
	const data = new Uint8Array(size * size * 4);
	const c = (size - 1) / 2;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const r = Math.hypot(x - c, y - c) / c;
			let a = 0;
			if (r <= core) a = 1;
			else if (r < 1) a = Math.pow(1 - (r - core) / (1 - core), falloff);
			const o = (y * size + x) * 4;
			data[o] = 255;
			data[o + 1] = 255;
			data[o + 2] = 255;
			data[o + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
		}
	}
	const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	tex.minFilter = THREE.LinearFilter;
	tex.magFilter = THREE.LinearFilter;
	tex.needsUpdate = true;
	return tex;
}

function haloLampMaterial(map, minPx) {
	const mat = new THREE.PointsMaterial({
		map,
		size: HALO_SIZE_M,
		sizeAttenuation: true,
		vertexColors: true,
		blending: THREE.AdditiveBlending,
		transparent: true,
		depthWrite: false,
		toneMapped: true,
	});
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.npcHaloMinPx = minPx;
		shader.vertexShader = shader.vertexShader
			.replace('uniform float scale;', 'uniform float scale;\nuniform float npcHaloMinPx;')
			.replace(
				'#include <logdepthbuf_vertex>',
				'gl_PointSize = max( gl_PointSize, npcHaloMinPx );\n\t#include <logdepthbuf_vertex>',
			);
	};

	mat.customProgramCacheKey = () => 'npc-halo-minpx';
	return mat;
}

function haloGeometry() {
	const g = new THREE.BufferGeometry();
	const pos = new THREE.BufferAttribute(new Float32Array(MAX_NPCS * 3), 3);
	const col = new THREE.BufferAttribute(new Float32Array(MAX_NPCS * 3), 3);
	pos.setUsage(THREE.DynamicDrawUsage);
	col.setUsage(THREE.DynamicDrawUsage);
	g.setAttribute('position', pos);
	g.setAttribute('color', col);

	g.setDrawRange(0, 0);
	return g;
}

export function buildNpcTraffic(scene, graph, opts = {}) {
	if (!graph.spawn.length) return null;
	const seed = opts.seed !== undefined ? opts.seed : 0x5f3a;
	const hold = opts.hold || null;
	const pass = opts.pass || null;

	const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.12 });
	const mesh = new THREE.InstancedMesh(bodyGeometry(), bodyMat, MAX_NPCS);
	mesh.name = 'npc-traffic';
	mesh.castShadow = true;
	mesh.receiveShadow = true;

	const headMat = lampMaterial();

	const tailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });

	const heads = new THREE.InstancedMesh(bulbPair(CAR_L / 2, 0.30, 0.34, 0.13), headMat, MAX_NPCS);
	const tails = new THREE.InstancedMesh(bulbPair(-CAR_L / 2, 0.34, 0.37, 0.12), tailMat, MAX_NPCS);
	heads.name = 'npc-headlights';
	tails.name = 'npc-taillights';

	const haloTex = haloTexture();
	const haloMinPx = { value: HALO_MIN_PX };
	const headHaloMat = haloLampMaterial(haloTex, haloMinPx);
	const tailHaloMat = haloLampMaterial(haloTex, haloMinPx);
	const headHalo = new THREE.Points(haloGeometry(), headHaloMat);
	const tailHalo = new THREE.Points(haloGeometry(), tailHaloMat);
	headHalo.name = 'npc-headlight-halos';
	tailHalo.name = 'npc-taillight-halos';

	headHalo.frustumCulled = false;
	tailHalo.frustumCulled = false;
	headHalo.castShadow = false;
	tailHalo.castShadow = false;

	const glowGroup = new THREE.Group();
	glowGroup.name = 'npc-glow';
	glowGroup.add(heads, headHalo, tailHalo);
	scene.add(mesh, glowGroup, tails);

	for (const m of [mesh, heads, tails]) {
		m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

		m.frustumCulled = false;
	}
	heads.castShadow = false;
	tails.castShadow = false;

	const rand = mulberry32(seed);

	const paintRand = mulberry32(seed ^ 0x5bd1e995);
	const cars = [];
	for (let i = 0; i < MAX_NPCS; i++) {
		cars.push({
			node: -1,
			s: 0,

			pace: 1,

			speed: TRAFFIC.limitFallback,
			braking: false,
			want: 0,

			lat: 0,
			latRate: 0,

			cooldown: 0,
		});

		mesh.setColorAt(i, carPaint(paintRand()));
		heads.setColorAt(i, HEAD_COLOUR);
		tails.setColorAt(i, TAIL_COLOUR);
	}
	for (const m of [mesh, heads, tails]) if (m.instanceColor) m.instanceColor.needsUpdate = true;

	const m4 = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const pos = new THREE.Vector3();
	const one = new THREE.Vector3(1, 1, 1);
	const zero = new THREE.Vector3(0, 0, 0);
	const UP = new THREE.Vector3(0, 1, 0);
	const tailC = new THREE.Color();

	const headPos = headHalo.geometry.attributes.position.array;
	const headCol = headHalo.geometry.attributes.color.array;
	const tailPos = tailHalo.geometry.attributes.position.array;
	const tailCol = tailHalo.geometry.attributes.color.array;

	const lowestOn = new Map();

	const byNode = new Map();

	const field = buildSpawnField(graph);

	const laneSpeed = (car, node) => {
		const lim = graph.nodes[node].speedLimit || TRAFFIC.limitFallback;
		return Math.max(1.5, lim * car.pace);
	};

	if (pass && pass.setLaneSpeed) pass.setLaneSpeed(laneSpeed);

	const place = (car, focus) => {
		for (let tries = 0; tries < 4; tries++) {
			const n = field.pick(rand);
			if (n < 0) break;
			const node = graph.nodes[n];
			const s = rand() * node.length;
			const p = sampleLane(node, s);
			if (Math.hypot(p.x - focus.x, p.z - focus.z) < SPAWN_MIN_M) continue;

			const low = lowestOn.get(n);
			if (low !== undefined && Math.abs(low - s) < TRAFFIC.headwayM) continue;
			car.node = n;
			car.s = s;
			car.braking = false;
			car.lat = 0;
			car.latRate = 0;
			car.cooldown = 0;
			car.pace = TRAFFIC.speedMin + rand() * Math.max(0, TRAFFIC.speedMax - TRAFFIC.speedMin);
			car.speed = laneSpeed(car, n);
			return;
		}
		car.node = -1;
	};

	const applyNight = (night) => {
		const k = Math.max(0, Math.min(1, night));
		glowGroup.visible = k > 0.02;
		headMat.color.setScalar(k);
		headHaloMat.color.setScalar(k);
		tailHaloMat.color.setScalar(k);

	};

	const update = (dt, focus, timeS = 0, night = 1) => {

		if (!TRAFFIC.on) {

			mesh.count = 0;
			heads.count = 0;
			tails.count = 0;
			headHalo.geometry.setDrawRange(0, 0);
			tailHalo.geometry.setDrawRange(0, 0);
			return;
		}
		applyNight(night);

		const nightK = Math.max(0, Math.min(1, night));
		const step = Math.min(dt, MAX_DT);
		const want = Math.max(0, Math.min(MAX_NPCS, Math.floor(TRAFFIC.count)));

		field.update(focus.x, focus.z, TRAFFIC.spawnRadius);
		const recycleR2 = (TRAFFIC.spawnRadius * RECYCLE_FACTOR) ** 2;

		const gap = Math.max(0, TRAFFIC.headwayM);

		const edge = graph.halfM + Math.max(0, TRAFFIC.edgeM);

		byNode.clear();
		lowestOn.clear();
		for (let i = 0; i < want; i++) {
			if (cars[i].node < 0) place(cars[i], focus);
			const n = cars[i].node;
			if (n < 0) continue;
			const list = byNode.get(n);
			if (list) list.push(i);
			else byNode.set(n, [i]);
			const low = lowestOn.get(n);
			if (low === undefined || cars[i].s < low) lowestOn.set(n, cars[i].s);
		}

		for (const [node, list] of byNode) {
			list.sort((a, b) => cars[b].s - cars[a].s);

			let aheadS = Infinity;
			if (hold) {
				const stop = hold.stopS[node];
				if (stop >= 0 && !hold.mayGo(node, timeS)) aheadS = stop + gap;
			}
			for (const i of list) {
				const c = cars[i];
				const desired = c.s + c.speed * step;
				const cap = aheadS - gap;
				if (desired > cap) {

					c.want = Math.max(c.s, cap);
					c.braking = true;
				} else {
					c.want = desired;
					c.braking = false;
				}
				aheadS = c.want;
			}
		}

		if (pass) pass.update(cars, byNode, want, step, gap);

		let drawn = 0;

		let litHead = 0;
		let litTail = 0;
		const park = () => {
			m4.compose(zero, q.identity(), zero);
			mesh.setMatrixAt(drawn, m4);
			heads.setMatrixAt(drawn, m4);
			tails.setMatrixAt(drawn, m4);
			drawn++;
		};

		for (let i = 0; i < want; i++) {
			const car = cars[i];
			if (car.node < 0) {

				park();
				continue;
			}

			let s = car.want;
			let hops = 0;
			while (s > graph.nodes[car.node].length && hops++ < MAX_HOPS_PER_TICK) {
				const next = pickExit(graph, car.node, rand);
				if (next < 0) {
					car.node = -1;
					break;
				}

				const low = lowestOn.get(next);
				if (low !== undefined && low < gap) {
					s = graph.nodes[car.node].length;
					car.braking = true;
					break;
				}
				s -= graph.nodes[car.node].length;
				car.node = next;

				car.speed = laneSpeed(car, next);

				car.lat = 0;
			}

			if (car.node >= 0) {
				const node = graph.nodes[car.node];
				const p = sampleLane(node, Math.min(s, node.length));
				const dx = p.x - focus.x;
				const dz = p.z - focus.z;

				if (dx * dx + dz * dz > recycleR2) car.node = -1;
				else if (Math.abs(p.x) > edge || Math.abs(p.z) > edge) car.node = -1;
				else car.s = s;
			}
			if (car.node < 0) {
				place(car, focus);
				if (car.node < 0) {
					park();
					continue;
				}
			}

			const node = graph.nodes[car.node];
			const p = sampleLane(node, Math.min(car.s, node.length));

			const sinH = Math.sin(p.heading);
			const cosH = Math.cos(p.heading);
			pos.set(p.x + cosH * car.lat, p.y, p.z - sinH * car.lat);
			q.setFromAxisAngle(UP, p.heading);
			m4.compose(pos, q, one);
			mesh.setMatrixAt(drawn, m4);
			heads.setMatrixAt(drawn, m4);
			tails.setMatrixAt(drawn, m4);

			tailC.copy(car.braking ? BRAKE_COLOUR : TAIL_COLOUR);
			tails.setColorAt(drawn, tailC);
			drawn++;

			const dx = p.x - focus.x;
			const dz = p.z - focus.z;
			const d = Math.hypot(dx, dz);
			if (d <= HALO_FADE_NEAR) continue;

			const t = Math.min(1, (d - HALO_FADE_NEAR) / (HALO_FADE_FAR - HALO_FADE_NEAR));
			const fade = t * t * (3 - 2 * t) * nightK * Math.max(0, TRAFFIC.lampGlow);
			if (fade <= 0) continue;

			const inv = 1 / d;

			const away = (sinH * dx + cosH * dz) * inv;
			const headFade = fade * facingRamp(-away);
			const tailFade = fade * facingRamp(away);

			if (headFade > 0) {
				const o = litHead * 3;
				headPos[o] = pos.x + sinH * (CAR_L / 2);
				headPos[o + 1] = p.y + 0.30;
				headPos[o + 2] = pos.z + cosH * (CAR_L / 2);
				headCol[o] = HEAD_COLOUR.r * headFade;
				headCol[o + 1] = HEAD_COLOUR.g * headFade;
				headCol[o + 2] = HEAD_COLOUR.b * headFade;
				litHead++;
			}
			if (tailFade > 0) {
				const o = litTail * 3;
				tailPos[o] = pos.x - sinH * (CAR_L / 2);
				tailPos[o + 1] = p.y + 0.34;
				tailPos[o + 2] = pos.z - cosH * (CAR_L / 2);

				tailCol[o] = tailC.r * tailFade;
				tailCol[o + 1] = tailC.g * tailFade;
				tailCol[o + 2] = tailC.b * tailFade;
				litTail++;
			}
		}

		mesh.count = drawn;
		heads.count = drawn;
		tails.count = drawn;
		mesh.instanceMatrix.needsUpdate = true;
		heads.instanceMatrix.needsUpdate = true;
		tails.instanceMatrix.needsUpdate = true;
		if (tails.instanceColor) tails.instanceColor.needsUpdate = true;
		headHalo.geometry.setDrawRange(0, litHead);
		tailHalo.geometry.setDrawRange(0, litTail);

		headHalo.geometry.attributes.position.needsUpdate = true;
		headHalo.geometry.attributes.color.needsUpdate = true;
		tailHalo.geometry.attributes.position.needsUpdate = true;
		tailHalo.geometry.attributes.color.needsUpdate = true;
	};

	const s = graph.stats;
	const perCar = s.spawnMetres / Math.max(1, TRAFFIC.count);
	const report =
		`${TRAFFIC.count} NPC cars on ${s.spawnable.toLocaleString()} spawnable lanes `
		+ `(${(s.spawnMetres / 1000).toFixed(1)} km of ${(s.totalMetres / 1000).toFixed(1)} km) — `
		+ `one every ${perCar >= 1000 ? `${(perCar / 1000).toFixed(2)} km` : `${Math.round(perCar)} m`} of lane · `
		+ `${s.edges.toLocaleString()} lane edges, ${s.deadEnds} dead ends`
		+ (s.reversed ? ` · ⚠️ ${s.reversed} lanes reversed for travel_dir` : '')
		+ `, ${TRAFFIC.headwayM} m headway, ${TRAFFIC.spawnRadius} m radius, 5 draw calls`;

	return {
		mesh,
		glowGroup,
		materials: [bodyMat],
		cars,
		graph,
		update,
		setBodyShadows(on) {
			mesh.castShadow = on;
		},
		repaint() {

			const stream = mulberry32(seed ^ 0x5bd1e995);
			const c = new THREE.Color();
			for (let i = 0; i < MAX_NPCS; i++) mesh.setColorAt(i, carPaint(stream(), c));
			if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
		},
		respeed() {
			const spread = Math.max(0, TRAFFIC.speedMax - TRAFFIC.speedMin);

			for (const car of cars) {
				car.pace = TRAFFIC.speedMin + rand() * spread;
				if (car.node >= 0) car.speed = laneSpeed(car, car.node);
			}
		},
		report,
	};
}
