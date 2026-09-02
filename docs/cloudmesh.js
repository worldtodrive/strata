

import * as THREE from 'three';

const DEFAULT_MAX_RADIUS_M = 4200;

export const CLOUD_ALTITUDE_M = 1000;

export const CLOUD_SPREAD_M = 230;

export const CLOUD_SPREAD_DOWN = 0.72;

const TARGET_CELL_M = 730;

const SHAPES = 7;

const CLUSTERS = 4;

const PER_MESH = 96;

const CLUMP_CELLS = 3;

const CLUMP_AMT = 0.3;

const HORIZON_CROWD = 0.95;

const CROWD_MAX = 0.95;

const DIST_GAIN = 0;

const RIM_FADE = 0.05;

const RIM_COLOR_FADE = 0.12;

const PLACE_STEP_FRAC = 0.0625;

const HORIZON_SINK = 0.67;

const GREY_BIAS = 1.8;

const GREY_DEPTH = 0.42;

const GREY_NEUTRALISE = 0.75;

const SWAY_M = 90;
const SWAY_PERIOD_S = 170;

const MAX_INSTANCES = 620;

function hash01(x, y, seed) {
	let h = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)
		^ Math.imul(seed + 1, 83492791)) >>> 0;
	h ^= h >>> 16;
	h = Math.imul(h, 0x7feb352d);
	h ^= h >>> 15;
	return (h >>> 0) / 4294967296;
}

function clumpNoise(gx, gz) {
	const fx = gx / CLUMP_CELLS;
	const fz = gz / CLUMP_CELLS;
	const ix = Math.floor(fx);
	const iz = Math.floor(fz);
	let tx = fx - ix;
	let tz = fz - iz;
	tx = tx * tx * (3 - 2 * tx);
	tz = tz * tz * (3 - 2 * tz);
	const a = hash01(ix, iz, 91);
	const b = hash01(ix + 1, iz, 91);
	const c = hash01(ix, iz + 1, 91);
	const d = hash01(ix + 1, iz + 1, 91);
	const top = a + (b - a) * tx;
	const bot = c + (d - c) * tx;
	return top + (bot - top) * tz;
}

function clusterOf(gx, gz) {
	const ix = Math.floor(gx / CLUMP_CELLS);
	const iz = Math.floor(gz / CLUMP_CELLS);
	return Math.floor(hash01(ix, iz, 97) * CLUSTERS) % CLUSTERS;
}

function buildCloudShape(seed, flatten = 1) {
	const lumps = 4 + Math.floor(hash01(seed, 0, 11) * 4);
	const rLo = 62 + hash01(seed, 0, 13) * 40;
	const rHi = rLo * (1.5 + hash01(seed, 0, 17) * 0.9);

	const thick = (0.52 + hash01(seed, 0, 71) * 0.26) * flatten;
	const spread = 1.15 + hash01(seed, 0, 19) * 0.85;

	const pos = [];
	const v = new THREE.Vector3();
	for (let i = 0; i < lumps; i++) {
		const r = rLo + hash01(seed, i, 21) * (rHi - rLo);
		const u = lumps > 1 ? i / (lumps - 1) : 0.5;
		const t = (u - 0.5) * 2;
		const ox = t * rHi * spread + (hash01(seed, i, 31) - 0.5) * r * 0.7;

		const oy = (hash01(seed, i, 41) - 0.5) * r * 0.5 - Math.abs(t) * r * 0.28;
		const oz = (hash01(seed, i, 51) - 0.5) * r * 1.3
			+ (hash01(seed, i, 61) - 0.5) * rHi * 0.3;
		const geo = new THREE.IcosahedronGeometry(r, 0);
		const p = geo.getAttribute('position');
		for (let k = 0; k < p.count; k++) {
			v.fromBufferAttribute(p, k);
			pos.push(v.x + ox, v.y * thick + oy, v.z + oz);
		}
		geo.dispose();
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	g.computeBoundingSphere();
	return g;
}

const SHADE_GLSL =   `
	float cloudUp = clamp(vCloudUp * 0.5 + 0.5, 0.0, 1.0);
	float cloudK = mix(1.0, cloudUp, uShade);
	diffuseColor.rgb *= mix(uShadow, vec3(1.0), cloudK);
	// AERIAL PERSPECTIVE. Distance is not a size cue on a field of randomly-sized objects: a
	// small cloud near and a big one far subtend the same angle, so at equal contrast the eye has
	// nothing to rank them by. Contrast falling with range is the cue real skies use, and it is
	// what makes the deck read as curving away rather than as a flat ceiling of equal lumps.
	diffuseColor.rgb = mix(diffuseColor.rgb, uHaze, vCloudFar * uHazeAmt);
	// ⭐⭐ AND THEN, IN THE LAST BAND ONLY, ALL THE WAY TO THE SKY. See RIM_COLOR_FADE. This
	// runs AFTER the haze on purpose: the haze is a partial, style-tinted recession that must
	// still read as cloud, and this is the terminal one that must read as nothing. Ordering
	// them the other way would let the haze pull a fully-faded cloud back OUT of the sky.
	diffuseColor.rgb = mix(diffuseColor.rgb, uSky, vRim);
`;

export function createCloudMesh(opts = {}) {

	const maxRadius = opts.maxRadius || DEFAULT_MAX_RADIUS_M;

	const RADIUS_CELLS = Math.max(3, Math.round(maxRadius / TARGET_CELL_M));
	const CELL_M = maxRadius / RADIUS_CELLS;

	const object = new THREE.Group();
	object.name = 'LowPolyClouds';

	object.matrixAutoUpdate = false;

	const uniforms = {
		uShade: { value: 0.85 },
		uShadow: { value: new THREE.Color(0.55, 0.58, 0.66) },
		uHaze: { value: new THREE.Color(0.8, 0.85, 0.9) },

		uHazeAmt: { value: 0.8 },
		uFadeNear: { value: maxRadius * 0.35 },
		uFadeFar: { value: maxRadius * 0.95 },

		uSky: { value: new THREE.Color(0.8, 0.85, 0.9) },
		uRim: { value: RADIUS_CELLS * (maxRadius / RADIUS_CELLS) },
		uRimFrom: { value: RADIUS_CELLS * (maxRadius / RADIUS_CELLS) * (1 - RIM_COLOR_FADE) },
	};

	const material = new THREE.MeshStandardMaterial({
		color: 0xffffff,
		roughness: 1.0,
		metalness: 0.0,
		flatShading: true,
		fog: false,
	});
	material.onBeforeCompile = (shader) => {
		for (const k in uniforms) shader.uniforms[k] = uniforms[k];
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', `#include <common>
				varying float vCloudUp;
				varying float vCloudFar;
				varying float vRim;
				uniform float uFadeNear;
				uniform float uFadeFar;
				uniform float uRim;
				uniform float uRimFrom;`)

			.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
				vCloudUp = objectNormal.y;`)

			.replace('#include <project_vertex>', `#include <project_vertex>
				vCloudFar = clamp((-mvPosition.z - uFadeNear) / max(uFadeFar - uFadeNear, 1.0),
					0.0, 1.0);
				vec3 cloudOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
				float cloudPlan = length(cloudOrigin.xz - cameraPosition.xz);
				vRim = clamp((cloudPlan - uRimFrom) / max(uRim - uRimFrom, 1.0), 0.0, 1.0);`);
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', `#include <common>
				varying float vCloudUp;
				varying float vCloudFar;
				varying float vRim;
				uniform float uShade;
				uniform vec3 uShadow;
				uniform vec3 uHaze;
				uniform float uHazeAmt;
				uniform vec3 uSky;`)
			.replace('#include <color_fragment>', `#include <color_fragment>
				${SHADE_GLSL}`);
	};

	material.customProgramCacheKey = () => 'lowpolycloud';

	let thickness = opts.thickness || 0.65;

	const shapes = [];
	for (let i = 0; i < SHAPES; i++) shapes.push(buildCloudShape(i * 977 + 5, thickness));

	const meshes = [];
	for (let i = 0; i < CLUSTERS * SHAPES; i++) {
		const geo = shapes[i % SHAPES];
		const per = PER_MESH;
		const m = new THREE.InstancedMesh(geo, material, per);
		m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(per * 3), 3);
		m.count = 0;

		m.frustumCulled = false;
		m.castShadow = false;
		m.receiveShadow = false;
		meshes.push(m);
		object.add(m);
	}

	function rebuildShapes() {
		for (let i = 0; i < SHAPES; i++) {
			const geo = buildCloudShape(i * 977 + 5, thickness);
			shapes[i].dispose();
			shapes[i] = geo;
		}

		for (let i = 0; i < meshes.length; i++) meshes[i].geometry = shapes[i % SHAPES];
	}

	const dummy = new THREE.Object3D();
	const tint = new THREE.Color();
	let cover = 0;
	let altitude = CLOUD_ALTITUDE_M;
	let spread = opts.spread || CLOUD_SPREAD_M;

	let sizeScale = opts.sizeScale || 0.85;
	let horizonSink = opts.horizonSink === undefined ? HORIZON_SINK : opts.horizonSink;
	let clumpAmt = opts.clumpAmt === undefined ? CLUMP_AMT : opts.clumpAmt;

	let greyAmount = opts.greyAmount === undefined ? 0 : opts.greyAmount;

	let litR = 1;
	let litG = 1;
	let litB = 1;
	let litPlacedAt = -1;

	let distGain = opts.distGain === undefined ? DIST_GAIN : opts.distGain;
	let horizonCrowd = opts.horizonCrowd === undefined ? HORIZON_CROWD : opts.horizonCrowd;
	let lastX = Infinity;
	let lastZ = Infinity;
	let lastCover = -1;
	let drawn = 0;

	let windX = 0;
	let windZ = 1;
	const t0 = performance.now();

	function place(eyeX, eyeZ) {
		const cx = Math.round(eyeX / CELL_M);
		const cz = Math.round(eyeZ / CELL_M);

		const rim = RADIUS_CELLS * CELL_M;
		const fadeFrom = rim * (1 - RIM_FADE);
		for (const m of meshes) m.count = 0;
		drawn = 0;
		if (cover <= 0) return;

		for (let dz = -RADIUS_CELLS; dz <= RADIUS_CELLS && drawn < MAX_INSTANCES; dz++) {
			for (let dx = -RADIUS_CELLS; dx <= RADIUS_CELLS && drawn < MAX_INSTANCES; dx++) {
				const gx = cx + dx;
				const gz = cz + dz;
				const cdx = gx * CELL_M - eyeX;
				const cdz = gz * CELL_M - eyeZ;

				if (cdx * cdx + cdz * cdz > (rim + CELL_M) * (rim + CELL_M)) continue;

				const clump = 1 + clumpAmt * (clumpNoise(gx, gz) * 2 - 1);

				const cellFar = Math.min(1, Math.hypot(cdx, cdz) / rim);

				const crowd = 1 + horizonCrowd * cellFar * cellFar;
				if (hash01(gx, gz, 3) > Math.min(CROWD_MAX, cover * clump * crowd)) continue;

				const which = Math.floor(hash01(gx, gz, 7) * SHAPES) % SHAPES;

				const mesh = meshes[clusterOf(gx, gz) * SHAPES + which];
				if (mesh.count >= mesh.instanceMatrix.count) continue;

				const px = (gx + (hash01(gx, gz, 13) - 0.5) * 0.8) * CELL_M;
				const pz = (gz + (hash01(gx, gz, 17) - 0.5) * 0.8) * CELL_M;

				const dist = Math.hypot(px - eyeX, pz - eyeZ);
				if (dist > rim) continue;
				const far = dist / rim;

				const h1 = hash01(gx, gz, 19) - 0.5;
				const h2 = hash01(gx, gz, 41) - 0.5;

				const lean = (CLOUD_SPREAD_DOWN - 0.5) * 2;

				const sinkRate = horizonSink * (0.75 + hash01(gx, gz, 53) * 0.5);
				const sink = 1 - Math.min(0.92, sinkRate) * far * far;
				const py = (altitude + ((h1 + h2) * 0.62 - lean * 0.5) * spread) * sink;

				dummy.position.set(px, py, pz);

				dummy.rotation.set(0, hash01(gx, gz, 23) * Math.PI * 2, 0);

				let s = (0.77 + hash01(gx, gz, 29) * 0.46) * sizeScale;

				if (distGain !== 0) s *= 1 + distGain * far;

				if (dist > fadeFrom) {
					const t = (dist - fadeFrom) / (rim - fadeFrom);
					s *= 1 - t * t * (3 - 2 * t);
					if (s < 0.04) continue;
				}
				dummy.scale.set(s, s, s);
				dummy.updateMatrix();
				mesh.setMatrixAt(mesh.count, dummy.matrix);

				const w = (hash01(gx, gz, 37) - 0.5) * 0.05;

				const g = Math.pow(hash01(gx, gz, 43), GREY_BIAS) * greyAmount;
				const b = (0.88 + hash01(gx, gz, 31) * 0.12) * (1 - GREY_DEPTH * g);

				const k = g * GREY_NEUTRALISE;
				const litMin = Math.min(litR, litG, litB);
				tint.setRGB(
					Math.max(0, b * (1 - k * (1 - litMin / Math.max(litR, 1e-4))) + w),
					Math.max(0, b * (1 - k * (1 - litMin / Math.max(litG, 1e-4)))),
					Math.max(0, b * (1 - k * (1 - litMin / Math.max(litB, 1e-4))) - w));
				tint.toArray(mesh.instanceColor.array, mesh.count * 3);

				mesh.count++;
				drawn++;
			}
		}
		for (const m of meshes) {
			m.instanceMatrix.needsUpdate = true;
			m.instanceColor.needsUpdate = true;
		}
	}

	return {
		object,
		get drawn() { return drawn; },

		set cover(v) { cover = Math.max(0, Math.min(1, v)); },
		get cover() { return cover; },

		setWind(dx, dz) {
			const l = Math.hypot(dx, dz) || 1;
			windX = dx / l;
			windZ = dz / l;
		},
		set altitude(v) { altitude = v; lastX = Infinity; },
		get altitude() { return altitude; },

		set sizeScale(v) { sizeScale = Math.max(0.2, v); lastX = Infinity; },
		get sizeScale() { return sizeScale; },

		set thickness(v) {
			const next = Math.max(0.5, Math.min(1.5, Number(v) || 1));
			if (next === thickness) return;
			thickness = next;
			rebuildShapes();
		},
		get thickness() { return thickness; },

		set spread(v) { spread = Math.max(0, v); lastX = Infinity; },
		get spread() { return spread; },

		set horizonSink(v) { horizonSink = Math.max(0, Math.min(0.85, Number(v) || 0)); lastX = Infinity; },
		get horizonSink() { return horizonSink; },

		set clumpAmt(v) { clumpAmt = Math.max(0, Math.min(0.9, Number(v) || 0)); lastX = Infinity; },
		get clumpAmt() { return clumpAmt; },

		set horizonCrowd(v) {
			const next = Math.max(0, Math.min(2, Number(v) || 0));
			if (next === horizonCrowd) return;
			horizonCrowd = next;
			lastX = Infinity;
		},
		get horizonCrowd() { return horizonCrowd; },

		set distGain(v) {
			const next = Math.max(0, Math.min(1.5, Number(v) || 0));
			if (next === distGain) return;
			distGain = next;
			lastX = Infinity;
		},
		get distGain() { return distGain; },

		set greyAmount(v) {
			const next = Math.max(0, Math.min(1, Number(v) || 0));
			if (next === greyAmount) return;
			greyAmount = next;
			lastX = Infinity;
		},
		get greyAmount() { return greyAmount; },

		set hazeAmount(v) { uniforms.uHazeAmt.value = Math.max(0, Math.min(1, Number(v) || 0)); },
		get hazeAmount() { return uniforms.uHazeAmt.value; },

		set shade(v) { uniforms.uShade.value = Math.max(0, Math.min(1, v)); },
		get shade() { return uniforms.uShade.value; },

		setPalette(lit, dark, haze, skyColor) {
			material.color.copy(lit);
			litR = lit.r;
			litG = lit.g;
			litB = lit.b;

			if (greyAmount > 0) {
				const mn = Math.min(litR, litG, litB);
				const mx = Math.max(litR, litG, litB);
				const satNow = mx > 0 ? (mx - mn) / mx : 0;
				if (Math.abs(satNow - litPlacedAt) > 0.02) {
					litPlacedAt = satNow;
					lastX = Infinity;
				}
			}

			const lum = Math.max(0.0001, 0.2126 * lit.r + 0.7152 * lit.g + 0.0722 * lit.b);
			uniforms.uShadow.value.setRGB(
				Math.min(1, dark.r / lum), Math.min(1, dark.g / lum), Math.min(1, dark.b / lum));
			uniforms.uHaze.value.copy(haze);

			uniforms.uSky.value.copy(skyColor || haze);
		},

		set rimFade(v) {
			const w = Math.max(0, Math.min(0.6, Number(v) || 0));
			uniforms.uRimFrom.value = uniforms.uRim.value * (1 - w);
		},
		get rimFade() {
			return 1 - uniforms.uRimFrom.value / uniforms.uRim.value;
		},

		update(eyeX, eyeZ) {

			const t = (performance.now() - t0) / 1000;

			for (let c = 0; c < CLUSTERS; c++) {

				const period = SWAY_PERIOD_S * (0.7 + c * 0.22);
				const phase = c * 1.7;
				const a = Math.sin((t / period) * Math.PI * 2 + phase) * SWAY_M;
				for (let k = 0; k < SHAPES; k++) {
					meshes[c * SHAPES + k].position.set(windX * a, 0, windZ * a);
				}
			}
			if (cover === lastCover
				&& Math.abs(eyeX - lastX) < CELL_M * PLACE_STEP_FRAC
				&& Math.abs(eyeZ - lastZ) < CELL_M * PLACE_STEP_FRAC) return;
			lastX = eyeX;
			lastZ = eyeZ;
			lastCover = cover;
			place(eyeX, eyeZ);
		},

		dispose() {
			for (const g of shapes) g.dispose();
			material.dispose();
		},
	};
}
