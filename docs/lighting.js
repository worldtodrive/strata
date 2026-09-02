

const MOON_PRESET_FLOOR = 0.90;

import * as THREE from 'three';

const SKY = import(`./sky.js${new URL(import.meta.url).search}`);

const CLOUDMESH = import(`./cloudmesh.js${new URL(import.meta.url).search}`);

const DOME_R = 9000;

export const SHADOW_LEVELS = [
	{ id: 'performance', label: 'performance', radius: 200, map: 2048 },
	{ id: 'balanced', label: 'balanced', radius: 140, map: 4096 },
	{ id: 'sharp', label: 'sharp', radius: 120, map: 8192 },
];
const DEFAULT_SHADOW = 'balanced';

const STAR_N = 1400;

const STAR_SIZE = 4;

const DOME_VERT = `
varying vec3 vDir;
void main() {
	vDir = normalize(position);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const DOME_FRAG = `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 ground;
uniform vec3 band;
uniform float bandAmt;
varying vec3 vDir;

const float BAND_CENTER = 0.2000;
const float BAND_EDGE = 0.9500;

const float BAND_SAT = 0.30;

float skyBandWeight(float h) {
	if (h <= 0.0) return 0.0;
	return smoothstep(0.0, BAND_CENTER, h) * (1.0 - smoothstep(BAND_CENTER, BAND_EDGE, h));
}

void main() {
	float h = normalize(vDir).y;
	vec3 col;
	if (h < 0.0) {

		col = mix(horizon, ground, clamp(-h * 3.0, 0.0, 1.0));
	} else {

		col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 1.4));

		float sat = 1.0 + BAND_SAT * clamp(bandAmt, 0.0, 1.0)
			* pow(clamp(h, 0.0, 1.0), 1.4);
		float grey = dot(col, vec3(0.2126, 0.7152, 0.0722));
		col = clamp(mix(vec3(grey), col, sat), 0.0, 1.0);
	}

	float b = skyBandWeight(h);
	col = mix(col, band, clamp(b * bandAmt, 0.0, 1.0));
	gl_FragColor = vec4(col, 1.0);
}`;

function puffTexture(size = 512) {
	let s = 0x9e3779b9;
	const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
	const a = new Float32Array(size * size);

	const stamp = (cx, cy, r) => {
		const r2 = r * r;
		const y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
		const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r);
		for (let y = y0; y <= y1; y++) {
			const wy = ((y % size) + size) % size;
			const dy = y - cy;
			for (let x = x0; x <= x1; x++) {
				const dx = x - cx;
				const d2 = dx * dx + dy * dy;
				if (d2 > r2) continue;
				const t = 1 - Math.sqrt(d2) / r;
				const wx = ((x % size) + size) % size;
				const i = wy * size + wx;

				const v = t * t * (3 - 2 * t);
				if (v > a[i]) a[i] = v;
			}
		}
	};

	for (let c = 0; c < 15; c++) {
		const cx = rand() * size;
		const cy = rand() * size;
		const base = size * (0.040 + rand() * 0.030);
		const lobes = 5 + Math.floor(rand() * 5);
		for (let l = 0; l < lobes; l++) {
			stamp(cx + (rand() - 0.5) * base * 3.0,
				cy + (rand() - 0.5) * base * 1.0,
				base * (0.55 + rand() * 0.60));
		}
	}

	const data = new Uint8Array(size * size * 4);
	for (let i = 0; i < a.length; i++) {

		const t = Math.max(0, Math.min(1, (a[i] - 0.30) / 0.34));
		const v = t * t * (3 - 2 * t);
		const j = i * 4;
		data[j] = data[j + 1] = data[j + 2] = 255;
		data[j + 3] = Math.round(v * 255);
	}
	const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.needsUpdate = true;
	return tex;
}

function cloudTexture(size = 256, octaves = 4) {

	const rand = (() => {
		let s = 1337;
		return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
	})();
	const grid = 8;
	const g = new Float32Array((grid + 1) * (grid + 1));
	for (let i = 0; i < g.length; i++) g[i] = rand();
	const at = (x, y) => g[(y % grid) * (grid + 1) + (x % grid)];
	const fade = (t) => t * t * (3 - 2 * t);
	const noise = (x, y, freq) => {
		const fx = x * freq, fy = y * freq;
		const x0 = Math.floor(fx), y0 = Math.floor(fy);
		const tx = fade(fx - x0), ty = fade(fy - y0);
		const a = at(x0, y0), b = at(x0 + 1, y0);
		const c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
		return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
	};
	const data = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let v = 0, amp = 0.5, freq = 1;
			for (let o = 0; o < octaves; o++) {
				v += noise(x / size * grid, y / size * grid, freq) * amp;
				amp *= 0.5;
				freq *= 2;
			}

			const a = Math.max(0, Math.min(1, (v - 0.42) * 2.6));
			const i = (y * size + x) * 4;
			data[i] = data[i + 1] = data[i + 2] = 255;
			data[i + 3] = Math.round(a * 255);
		}
	}
	const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.needsUpdate = true;
	return tex;
}

function discTexture(size = 128, core = 0.30, falloff = 2.6) {
	const data = new Uint8Array(size * size * 4);
	const c = (size - 1) / 2;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const r = Math.hypot(x - c, y - c) / c;
			let a = 0;
			if (r < core) a = 1;
			else a = Math.max(0, 1 - (r - core) / (1 - core));
			a = Math.pow(a, falloff);
			const i = (y * size + x) * 4;
			data[i] = data[i + 1] = data[i + 2] = 255;
			data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
		}
	}
	const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	tex.needsUpdate = true;
	return tex;
}

export async function createLighting(scene, renderer, opts = {}) {
	const sky = await SKY;
	const cloudMeshMod = await CLOUDMESH;

	const makeCloudMesh = () => {
		const m = cloudMeshMod.createCloudMesh({ maxRadius: DOME_R * 0.93 });

		if (m && m.setWind) {
			const rad = (WIND_BEARING_DEG * Math.PI) / 180;
			m.setWind(Math.sin(rad), -Math.cos(rad));
		}

		if (m) {
			m.sizeScale = cloudSizeWanted;
			m.thickness = cloudThicknessWanted;
			m.horizonSink = cloudDroopWanted;
			m.rimFade = cloudRimFadeWanted;
			m.clumpAmt = cloudClumpWanted;
			m.greyAmount = cloudGreyWanted;
			m.altitude = cloudHeightWanted;
			m.distGain = cloudDistGainWanted;
			m.horizonCrowd = cloudCrowdWanted;
		}
		return m;
	};

	const domeMat = new THREE.ShaderMaterial({
		uniforms: {
			zenith: { value: new THREE.Color('#3f78c0') },
			horizon: { value: new THREE.Color('#cfe0ec') },
			ground: { value: new THREE.Color('#9aa7b0') },
			band: { value: new THREE.Color('#a9d7f0') },
			bandAmt: { value: 0.12 },
		},
		vertexShader: DOME_VERT,
		fragmentShader: DOME_FRAG,
		side: THREE.BackSide,
		depthWrite: false,

		fog: false,
	});
	const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 32, 16), domeMat);
	dome.renderOrder = -1000;
	dome.frustumCulled = false;
	scene.add(dome);

	const mulberry32 = (a) => () => {
		a |= 0; a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const rng = mulberry32(0x5eed);
	const crng = mulberry32(0xc010);

	const STAR_COLOURS = [
		[0x9db4ff, 0.5],
		[0xc4d4ff, 1.0],
		[0xffffff, 12.0],
		[0xfff3d6, 2.5],
		[0xffdf9a, 1.3],
		[0xffbe74, 0.7],
		[0xff9c5a, 0.35],
	];
	const starTotal = STAR_COLOURS.reduce((s, c) => s + c[1], 0);

	const starPos = new Float32Array(STAR_N * 3);
	const starColour = new Float32Array(STAR_N * 3);
	const starR = DOME_R * 0.97;
	for (let i = 0; i < STAR_N; i++) {

		const up = 0.05 + 0.95 * rng();
		const r = Math.sqrt(Math.max(0, 1 - up * up));
		const theta = rng() * Math.PI * 2;
		starPos[i * 3] = Math.cos(theta) * r * starR;
		starPos[i * 3 + 1] = up * starR;
		starPos[i * 3 + 2] = Math.sin(theta) * r * starR;

		let pickV = crng() * starTotal;
		let chosen = STAR_COLOURS[STAR_COLOURS.length - 1][0];
		for (const c of STAR_COLOURS) {
			pickV -= c[1];
			if (pickV <= 0) { chosen = c[0]; break; }
		}

		const k = 0.55 + 0.45 * crng();
		starColour[i * 3] = (((chosen >> 16) & 255) / 255) * k;
		starColour[i * 3 + 1] = (((chosen >> 8) & 255) / 255) * k;
		starColour[i * 3 + 2] = ((chosen & 255) / 255) * k;
	}
	const starGeo = new THREE.BufferGeometry();
	starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
	starGeo.setAttribute('color', new THREE.BufferAttribute(starColour, 3));
	const starMat = new THREE.PointsMaterial({

		color: 0xffffff,
		vertexColors: true,
		size: STAR_SIZE,
		sizeAttenuation: false,
		transparent: true,
		opacity: 0,
		depthWrite: false,
		fog: false,
		blending: THREE.AdditiveBlending,

		toneMapped: false,
	});
	const stars = new THREE.Points(starGeo, starMat);
	stars.renderOrder = -999;
	stars.frustumCulled = false;
	scene.add(stars);

	const coreTex = discTexture(128, 0.42, 2.2);
	const haloTex = discTexture(128, 0.02, 3.4);
	const mkSprite = (tex, size, colour, opacity) => {
		const s = new THREE.Sprite(new THREE.SpriteMaterial({
			map: tex, color: new THREE.Color(colour), transparent: true,
			opacity, depthWrite: false, blending: THREE.AdditiveBlending,
			toneMapped: false, fog: false,
		}));
		s.scale.setScalar(size);
		s.renderOrder = -998;
		s.frustumCulled = false;
		scene.add(s);
		return s;
	};

	const sunCore = mkSprite(coreTex, 55, '#fff2d8', 1);
	const sunHalo = mkSprite(haloTex, 620, '#fff2d8', 0.30);

	const moonCore = mkSprite(coreTex, 320, '#b6cdf4', 1);
	moonCore.material.blending = THREE.NormalBlending;

	const moonHalo = mkSprite(haloTex, 1180, '#7fa8ea', 0.26);

	const CLOUD_SPAN = DOME_R * 14;

	const CLOUD_KINDS = { wisp: cloudTexture(), puff: puffTexture() };
	let cloudKind = 'wisp';

	let meshClouds = null;

	let cloudSizeWanted = 0.85;
	let cloudThicknessWanted = 0.65;

	let cloudDroopWanted = 0.67;
	let cloudRimFadeWanted = 0.12;
	let cloudClumpWanted = 0.3;

	let cloudGreyWanted = 0.35;

	let cloudHeightWanted = 1000;

	let cloudDistGainWanted = 0;

	let cloudCrowdWanted = 0.95;

	let fogScale = 1;

	const WIND_BEARING_DEG = 250;

	const CLOUD_GREY_SUNSET = 1.2;

	let windSpeed = 5.5;
	const windDrift = { x: 0, z: 0 };
	let windLogged = false;

	const meshCover = (amt) => Math.min(0.55, amt * amt * 0.7);

	const litC = new THREE.Color();
	const darkC = new THREE.Color();
	const hazeC = new THREE.Color();
	const skyC = new THREE.Color();

	const WHITE = new THREE.Color(0xffffff);
	const CLOUD_TINT_GAIN = 0.38;

	const CLOUD_NIGHT_LIT = 0.16;
	const CLOUD_NIGHT_UNDER = 0.42;
	const CLOUD_NIGHT_HAZE = 0.55;
	const clouds = [];
	for (let i = 0; i < 2; i++) {
		const tex = CLOUD_KINDS[cloudKind].clone();
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

		const tiles = Math.round(CLOUD_SPAN / 5000) + i * 4;

		tex.generateMipmaps = true;
		tex.minFilter = THREE.LinearMipmapLinearFilter;
		tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
		tex.needsUpdate = true;

		const mat = new THREE.ShaderMaterial({
			uniforms: {
				map: { value: tex },
				tint: { value: new THREE.Color('#ffffff') },
				alpha: { value: i ? 0.35 : 0.5 },
				fadeStart: { value: 3000 },
				fadeEnd: { value: CLOUD_SPAN * 0.5 },

				repeat: { value: new THREE.Vector2(tiles, tiles) },
				offset: { value: new THREE.Vector2(0, 0) },
			},
			vertexShader: `
				uniform vec2 repeat;
				uniform vec2 offset;
				varying vec2 vUv;
				varying float vDist;
				void main() {
					vUv = uv * repeat + offset;
					vec4 wp = modelMatrix * vec4(position, 1.0);

					vDist = length(wp.xz - cameraPosition.xz);
					gl_Position = projectionMatrix * viewMatrix * wp;
				}`,
			fragmentShader: `
				uniform sampler2D map;
				uniform vec3 tint;
				uniform float alpha;
				uniform float fadeStart;
				uniform float fadeEnd;
				varying vec2 vUv;
				varying float vDist;
				void main() {
					float a = texture2D(map, vUv).a * alpha;

					float f = smoothstep(fadeStart, fadeEnd, vDist);
					a *= mix(1.0, 0.18, f);
					if (a < 0.004) discard;
					gl_FragColor = vec4(tint, a);
				}`,
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide,
			fog: false,
		});
		const m = new THREE.Mesh(new THREE.PlaneGeometry(CLOUD_SPAN, CLOUD_SPAN), mat);
		m.rotation.x = -Math.PI / 2;
		m.position.y = 900 + i * 380;
		m.renderOrder = -997;
		m.frustumCulled = false;
		scene.add(m);
		clouds.push(m);
	}

	const hemi = new THREE.HemisphereLight(0xc6edff, 0x6c737e, 1.7);
	scene.add(hemi);

	const sunLight = new THREE.DirectionalLight(0xfff1e0, 3.2);
	sunLight.castShadow = true;
	sunLight.shadow.mapSize.set(4096, 4096);

	sunLight.shadow.bias = -0.0001;

	sunLight.shadow.normalBias = 0.3;
	const sc = sunLight.shadow.camera;
	sc.near = 1; sc.far = 1400;
	scene.add(sunLight);
	scene.add(sunLight.target);

	const moonLight = new THREE.DirectionalLight(0x9fb4d8, 0);
	scene.add(moonLight);
	scene.add(moonLight.target);

	if (!scene.fog) scene.fog = new THREE.Fog(0x93b0d6, 900, 2600);

	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	let timeOfDay = opts.timeOfDay !== undefined ? opts.timeOfDay : 0.36;
	let latitude = opts.latitudeDeg !== undefined ? opts.latitudeDeg : sky.DEFAULT_LATITUDE_DEG;

	let running = false;

	let dayLengthS = 240;
	let shadows = true;

	let cloudAmt = 0;

	let nightLevel = 0;

	let nightPreset = false;
	let drift = 0;
	let current = null;

	let exposureGain = 1.0;
	let sunGain = 1.0;
	let fillGain = 1.0;

	const TONE = {
		aces: THREE.ACESFilmicToneMapping,
		cineon: THREE.CineonToneMapping,
		reinhard: THREE.ReinhardToneMapping,
		linear: THREE.LinearToneMapping,
		none: THREE.NoToneMapping,
	};
	let toneName = 'aces';
	let shadowLevel = DEFAULT_SHADOW;

	const CAR_NIGHT_ENV = 6.0;

	const CAR_NIGHT_EMISSIVE = 0.0;
	const CAR_EMISSIVE_TINT = 0x8fa8c8;

	const NIGHT_EXPOSURE_LIFT = 2.00;
	let carGroup = null;
	let carGainAt = -1;
	let shadowRadius = 140;
	let shadowMap = 4096;
	let shadowReach = 1;
	let styleName = sky.DEFAULT_STYLE;
	let blueName = sky.DEFAULT_BLUE;

	let goldenArm = sky.DEFAULT_GOLDEN;

	const pmrem = new THREE.PMREMGenerator(renderer);
	pmrem.compileEquirectangularShader();
	const envScene = new THREE.Scene();
	const envDome = new THREE.Mesh(dome.geometry, domeMat);
	envScene.add(envDome);
	let envTarget = null;
	let envBakedAt = -1;

	let envBakedUp = 2;

	const ENV_BAKE_D_SIN = 0.010;
	let envIntensity = 0;

	const tracked = new Set();

	function bakeEnv(force) {
		if (envIntensity <= 0) {
			if (scene.environment) scene.environment = null;
			return;
		}

		const upNow = sky.sunVector(timeOfDay, latitude).y;
		if (!force && envBakedAt >= 0
			&& Math.abs(upNow - envBakedUp) < ENV_BAKE_D_SIN) return;
		envBakedAt = timeOfDay;
		envBakedUp = upNow;

		try {
			const next = pmrem.fromScene(envScene, 0, 1, DOME_R * 2);
			if (envTarget) envTarget.dispose();
			envTarget = next;
			scene.environment = envTarget.texture;
		} catch (err) {

			console.warn('[lighting] environment bake failed, falling back to no ambient:', err);
			scene.environment = null;
			envIntensity = 0;
			applyMaterials();
		}
	}

	let nightLift = 0;

	let legacy = false;

	function applyShadowLevel() {
		const lv = SHADOW_LEVELS.find((x) => x.id === shadowLevel) || SHADOW_LEVELS[1];
		sunLight.shadow.mapSize.set(lv.map, lv.map);

		if (sunLight.shadow.map) {
			sunLight.shadow.map.dispose();
			sunLight.shadow.map = null;
		}
		sc.left = -lv.radius; sc.right = lv.radius;
		sc.top = lv.radius; sc.bottom = -lv.radius;
		sc.updateProjectionMatrix();

		const texel = (2 * lv.radius) / lv.map;
		sunLight.shadow.normalBias = texel * 1.5;

		shadowRadius = lv.radius;
		shadowMap = lv.map;
		shadowReach = 1;
	}
	applyShadowLevel();

	const SHADOW_REACH_MAX = 1.0;
	function applyShadowReach(sunUp) {

		const want = sunUp >= 0.2419
			? 1
			: Math.min(SHADOW_REACH_MAX, 1 / Math.max(Math.abs(sunUp), 1 / SHADOW_REACH_MAX));
		if (Math.abs(want - shadowReach) < 0.02) return;
		shadowReach = want;
		sc.top = shadowRadius * want;
		sc.bottom = -shadowRadius * want;
		sc.updateProjectionMatrix();

		sunLight.shadow.normalBias = ((2 * shadowRadius * want) / shadowMap) * 1.5;
	}

	function applyCarNight(mix) {
		if (!carGroup || !carGroup.parent) {
			carGroup = scene.getObjectByName('carmesh') || null;
			carGainAt = -1;
			if (!carGroup) return;
		}
		const want = 1 + (CAR_NIGHT_ENV - 1) * mix;
		if (Math.abs(want - carGainAt) < 0.01) return;
		carGainAt = want;
		const glow = CAR_NIGHT_EMISSIVE * mix;
		carGroup.traverse((o) => {
			if (!o.isMesh || !o.material) return;
			for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
				if (!m || m.envMapIntensity === undefined) continue;

				m.envMapIntensity = envIntensity * want;
				if (!m.emissive) continue;

				if (m.userData._emis === undefined) {
					m.userData._emis = m.emissive.getHex();
					m.userData._emisI = m.emissiveIntensity === undefined
						? 1 : m.emissiveIntensity;
				}

				if (m.userData._emis !== 0x000000) continue;
				if (glow > 0.001) {
					m.emissive.setHex(CAR_EMISSIVE_TINT);
					m.emissiveIntensity = glow;
				} else {
					m.emissive.setHex(m.userData._emis);
					m.emissiveIntensity = m.userData._emisI;
				}
			}
		});
	}

	const tmp = new THREE.Vector3();

	function applyMaterials() {
		const st = sky.STYLES[styleName] || sky.STYLES[sky.DEFAULT_STYLE];
		const flat = !legacy && !!st.flat;
		const matte = !legacy && !!st.matte;
		for (const m of tracked) {
			const snap = m.userData._look || {};
			if (m.flatShading !== flat) {
				m.flatShading = flat;
				m.needsUpdate = true;
			}

			if (matte) {
				m.roughness = 1;
				m.envMapIntensity = 0;
			} else {
				if (snap.roughness !== undefined) m.roughness = snap.roughness;
				m.envMapIntensity = envIntensity;
			}
		}
	}

	function applyLegacy(focus) {
		dome.visible = false;
		stars.visible = false;
		for (const p of [sunCore, sunHalo, moonCore, moonHalo]) p.visible = false;
		for (const c of clouds) c.visible = false;

		hemi.color.set(0xdcebff);
		hemi.intensity = 1.9;
		sunLight.color.set(0xfff4e2);
		sunLight.intensity = 1.7;
		sunLight.visible = true;
		sunLight.castShadow = false;
		moonLight.visible = false;

		const o = focus || tmp.set(0, 0, 0);
		sunLight.target.position.copy(o);
		sunLight.position.set(o.x - 260, o.y + 200, o.z + 240);
		sunLight.target.updateMatrixWorld();

		renderer.toneMapping = THREE.NoToneMapping;
		renderer.toneMappingExposure = 1;
		renderer.shadowMap.enabled = false;

		scene.environment = null;
		scene.fog.color.set(0x93b0d6);
		scene.fog.near = 900;
		scene.fog.far = 2600;
		if (scene.background && scene.background.isColor) scene.background.set(0x93b0d6);
	}

	function applyLook(focus) {
		if (legacy) { applyLegacy(focus); return; }
		dome.visible = true;
		stars.visible = true;

		for (const c of clouds) c.visible = cloudKind !== 'low';

		const s = sky.lookAt(timeOfDay, latitude, styleName, blueName, goldenArm);

		const nightMix = nightPreset ? 1 : s.night;

		nightLevel = nightMix;
		current = s;
		const L = s.look;

		const st = sky.STYLES[styleName] || sky.STYLES[sky.DEFAULT_STYLE];
		const wantEnv = (st.env || 0) * (0.35 + 0.65 * s.phase);
		if (Math.abs(wantEnv - envIntensity) > 0.02) {
			envIntensity = wantEnv;
			applyMaterials();

			carGainAt = -1;
		}
		applyCarNight(nightMix);
		bakeEnv(false);

		domeMat.uniforms.zenith.value.set(L.skyZenith);
		domeMat.uniforms.horizon.value.set(L.skyHorizon);
		domeMat.uniforms.ground.value.set(L.skyGround);
		domeMat.uniforms.band.value.set(L.skyBand);
		domeMat.uniforms.bandAmt.value = L.skyBandAmt;

		starMat.opacity = L.starAmt * nightMix * 0.9;

		hemi.color.set(L.hemiSky);

		hemi.intensity = (L.hemiIntensity + nightLift * s.night) * fillGain;
		sunLight.color.set(L.sunColor);

		const fadeLo = Math.sin(-1.5 * Math.PI / 180);
		const fadeHi = Math.sin(3 * Math.PI / 180);
		const fadeT = Math.max(0, Math.min(1, (s.sunUp - fadeLo) / (fadeHi - fadeLo)));
		const horizonFade = fadeT * fadeT * (3 - 2 * fadeT);
		sunLight.intensity = L.sunIntensity * sunGain * horizonFade;

		const moonWant = nightPreset
			? Math.max(L.moonIntensity, MOON_PRESET_FLOOR) : L.moonIntensity;
		moonLight.intensity = moonWant * sunGain;

		renderer.toneMappingExposure = L.exposure * exposureGain
			* (1 + (NIGHT_EXPOSURE_LIFT - 1) * nightMix);

		scene.fog.color.set(L.skyHorizon);

		scene.fog.near = L.fogNear * fogScale;
		scene.fog.far = L.fogFar * fogScale;
		if (scene.background && scene.background.isColor) scene.background.set(L.skyHorizon);

		const o = focus || tmp.set(0, 0, 0);
		dome.position.copy(o);
		stars.position.copy(o);
		for (const c of clouds) { c.position.x = o.x; c.position.z = o.z; }

		const R = DOME_R * 0.95;
		for (const p of [sunCore, sunHalo]) {
			p.position.set(o.x + s.sun.x * R, o.y + s.sun.y * R, o.z + s.sun.z * R);
			p.material.color.set(L.sunTint);
			p.visible = s.day > 0.01;
		}
		sunCore.material.opacity = s.day;

		sunHalo.material.opacity = s.day * (0.22 + 0.5 * (1 - Math.min(1, s.sunUp / 0.35)));
		sunHalo.scale.setScalar(620 * (1 + 0.8 * (1 - Math.min(1, Math.max(0, s.sunUp) / 0.35))));

		const moonDir = nightPreset
			? sky.dirFromAltAz(sky.MOON_AT_NIGHT.altDeg, sky.MOON_AT_NIGHT.aziDeg)
			: s.moon;
		for (const p of [moonCore, moonHalo]) {
			p.position.set(o.x + moonDir.x * R, o.y + moonDir.y * R, o.z + moonDir.z * R);
			p.visible = moonDir.y > -0.05 && nightMix > 0.01;
		}
		moonCore.material.opacity = nightMix * 0.95;
		moonHalo.material.opacity = nightMix * 0.16;

		for (let i = 0; i < clouds.length; i++) {
			const u = clouds[i].material.uniforms;

			const solid = cloudKind === 'puff' ? (i ? 0.80 : 0.97) : (i ? 0.42 : 0.62);
			u.alpha.value = cloudAmt * solid;

			if (L.cloudTint) {
				u.tint.value.set(L.cloudTint).multiplyScalar(CLOUD_TINT_GAIN);
			} else {
				u.tint.value.set(sky.lerpHex(L.skyHorizon, L.skyZenith,
					0.25 + 0.45 * s.phase));
			}

			if (nightMix > 0.01) {
				u.tint.value.lerp(WHITE, CLOUD_NIGHT_LIT * nightMix);
			}
		}

		if (meshClouds && meshClouds.object.visible) {

			if (L.cloudTint) {
				litC.set(L.cloudTint);

				litC.multiplyScalar(CLOUD_TINT_GAIN);
			} else {
				litC.set(sky.lerpHex(L.skyHorizon, '#ffffff', 0.55 + 0.35 * s.phase));
			}

			if (nightMix > 0.01) litC.lerp(WHITE, CLOUD_NIGHT_LIT * nightMix);
			darkC.set(L.skyGround);

			if (nightMix > 0.01) darkC.lerp(litC, CLOUD_NIGHT_UNDER * nightMix);

			hazeC.set(L.cloudTint
				? sky.lerpHex(L.skyHorizon, L.cloudTint, 0.85)
				: L.skyHorizon);

			if (nightMix > 0.01) hazeC.lerp(litC, CLOUD_NIGHT_HAZE * nightMix);

			skyC.set(L.skyHorizon);
			meshClouds.setPalette(litC, darkC, hazeC, skyC);
			meshClouds.cover = meshCover(cloudAmt);

			const drama = 1 - Math.abs(2 * s.phase - 1);
			meshClouds.greyAmount = Math.min(1,
				cloudGreyWanted * (1 + CLOUD_GREY_SUNSET * drama));

			meshClouds.object.position.set(windDrift.x, 0, windDrift.z);

			meshClouds.object.updateMatrix();
			meshClouds.update(o.x - windDrift.x, o.z - windDrift.z);
			if (!windLogged) {
				windLogged = true;
				;
			}
		}

		const sunDist = 600;
		sunLight.target.position.copy(o);
		sunLight.position.set(o.x + s.sun.x * sunDist,
			o.y + s.sun.y * sunDist, o.z + s.sun.z * sunDist);
		sunLight.target.updateMatrixWorld();
		moonLight.target.position.copy(o);

		moonLight.position.set(o.x + moonDir.x * sunDist,
			o.y + moonDir.y * sunDist, o.z + moonDir.z * sunDist);
		moonLight.target.updateMatrixWorld();

		applyShadowReach(s.sunUp);
		sunLight.castShadow = shadows && horizonFade > 0.02;
		sunLight.visible = L.sunIntensity > 0.001 && s.sunUp > -0.02;
		moonLight.visible = moonWant > 0.001;
	}

	applyLook(null);

	return {
		get timeOfDay() { return timeOfDay; },
		set timeOfDay(v) { timeOfDay = ((v % 1) + 1) % 1; },
		get running() { return running; },
		set running(v) { running = !!v; },
		get dayLengthS() { return dayLengthS; },
		set dayLengthS(v) { dayLengthS = Math.max(10, v); },
		get shadows() { return shadows; },
		set shadows(v) {
			shadows = !!v;
			renderer.shadowMap.enabled = shadows;

			scene.traverse((o) => {
				if (o.isMesh && o.material) {
					for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
						m.needsUpdate = true;
					}
				}
			});
		},

		get nightLevel() { return nightLevel; },

		get nightPreset() { return nightPreset; },
		set nightPreset(v) { nightPreset = !!v; },
		get clouds() { return cloudAmt; },
		set clouds(v) { cloudAmt = Math.max(0, Math.min(1, v)); },

		get cloudKind() { return cloudKind; },
		set cloudKind(v) {

			if (v === 'low') {
				cloudKind = v;
				for (const c of clouds) c.visible = false;
				if (!meshClouds) {
					meshClouds = makeCloudMesh();

					if (meshClouds) scene.add(meshClouds.object);
				}
				if (meshClouds) {
					meshClouds.object.visible = true;
					meshClouds.cover = meshCover(cloudAmt);
				}
				return;
			}
			if (meshClouds) meshClouds.object.visible = false;
			if (!CLOUD_KINDS[v] || v === cloudKind) { cloudKind = v; return; }
			cloudKind = v;
			for (let i = 0; i < clouds.length; i++) {
				const u = clouds[i].material.uniforms;
				const old = u.map.value;
				const tex = CLOUD_KINDS[v].clone();
				tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
				tex.generateMipmaps = true;
				tex.minFilter = THREE.LinearMipmapLinearFilter;
				tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
				tex.needsUpdate = true;
				u.map.value = tex;

				if (old) old.dispose();
			}
		},
		cloudKinds: [
			{ id: 'wisp', label: 'wisps' },
			{ id: 'puff', label: 'puffs' },
			{ id: 'low', label: 'low-poly (faceted)' },
		],

		get windSpeed() { return windSpeed; },
		set windSpeed(v) { windSpeed = Math.max(0, Math.min(40, Number(v) || 0)); },
		get windBearing() { return WIND_BEARING_DEG; },

		get cloudShade() { return meshClouds ? meshClouds.shade : 0.85; },
		set cloudShade(v) { if (meshClouds) meshClouds.shade = v; },

		set cloudSpeed(v) { windSpeed = Math.max(0, Math.min(40, v)); },
		get cloudSpeed() { return windSpeed; },

		set cloudSize(v) {
			cloudSizeWanted = Math.max(0.2, Number(v) || 1);
			if (meshClouds) meshClouds.sizeScale = cloudSizeWanted;
		},
		get cloudSize() { return cloudSizeWanted; },

		set cloudThickness(v) {
			cloudThicknessWanted = Math.max(0.5, Math.min(1.5, Number(v) || 1));
			if (meshClouds) meshClouds.thickness = cloudThicknessWanted;
		},
		get cloudThickness() { return cloudThicknessWanted; },

		set cloudDroop(v) {
			cloudDroopWanted = Math.max(0, Math.min(0.85, Number(v) || 0));
			if (meshClouds) meshClouds.horizonSink = cloudDroopWanted;
		},
		get cloudDroop() { return cloudDroopWanted; },

		set cloudRimFade(v) {
			cloudRimFadeWanted = Math.max(0, Math.min(0.6, Number(v) || 0));
			if (meshClouds) meshClouds.rimFade = cloudRimFadeWanted;
		},
		get cloudRimFade() { return cloudRimFadeWanted; },

		set cloudClump(v) {
			cloudClumpWanted = Math.max(0, Math.min(0.9, Number(v) || 0));
			if (meshClouds) meshClouds.clumpAmt = cloudClumpWanted;
		},
		get cloudClump() { return cloudClumpWanted; },

		set cloudGrey(v) { cloudGreyWanted = Math.max(0, Math.min(1, Number(v) || 0)); },
		get cloudGrey() { return cloudGreyWanted; },

		get cloudGreyNow() { return meshClouds ? meshClouds.greyAmount : 0; },

		set cloudHeight(v) {
			cloudHeightWanted = Math.max(300, Math.min(2200, Number(v) || 1000));
			if (meshClouds) meshClouds.altitude = cloudHeightWanted;
		},
		get cloudHeight() { return cloudHeightWanted; },

		set cloudDistGain(v) {
			cloudDistGainWanted = Math.max(0, Math.min(1.5, Number(v) || 0));
			if (meshClouds) meshClouds.distGain = cloudDistGainWanted;
		},
		get cloudDistGain() { return cloudDistGainWanted; },

		set cloudCrowd(v) {
			cloudCrowdWanted = Math.max(0, Math.min(2, Number(v) || 0));
			if (meshClouds) meshClouds.horizonCrowd = cloudCrowdWanted;
		},
		get cloudCrowd() { return cloudCrowdWanted; },

		set fogDistance(v) { fogScale = Math.max(0.2, Math.min(2, Number(v) || 1)); },
		get fogDistance() { return fogScale; },

		get fogRange() {
			return scene.fog ? [Math.round(scene.fog.near), Math.round(scene.fog.far)] : null;
		},
		get cloudsDrawn() { return meshClouds && meshClouds.object.visible ? meshClouds.drawn : 0; },

		get cloudSway() {
			if (!meshClouds) return null;
			return meshClouds.object.children.map(
				(m) => Math.round(m.position.x * 10) / 10);
		},

		get exposure() { return exposureGain; },
		set exposure(v) { exposureGain = Math.max(0.1, Math.min(4, v)); },
		get sunGain() { return sunGain; },
		set sunGain(v) { sunGain = Math.max(0, Math.min(4, v)); },
		get fillGain() { return fillGain; },
		set fillGain(v) { fillGain = Math.max(0, Math.min(4, v)); },
		get tone() { return toneName; },
		set tone(v) {
			if (!(v in TONE)) return;
			toneName = v;
			renderer.toneMapping = TONE[v];

			scene.traverse((o) => {
				if (o.isMesh && o.material) {
					for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
						m.needsUpdate = true;
					}
				}
			});
		},
		toneOptions: Object.keys(TONE),

		get legacy() { return legacy; },
		set legacy(v) {
			legacy = !!v;

			renderer.toneMapping = legacy ? THREE.NoToneMapping : TONE[toneName];
			renderer.shadowMap.enabled = !legacy && shadows;
			applyMaterials();
			if (!legacy) { envBakedAt = -1; bakeEnv(true); }
			scene.traverse((o) => {
				if (o.isMesh && o.material) {
					for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
						m.needsUpdate = true;
					}
				}
			});
		},

		get style() { return styleName; },
		set style(v) {
			if (!sky.STYLES[v]) return;
			styleName = v;
			const st = sky.STYLES[v];

			if (st.tone) this.tone = st.tone;
			envIntensity = st.env || 0;
			envBakedAt = -1;
			applyMaterials();
			bakeEnv(true);
		},
		styles: Object.keys(sky.STYLES).map((id) => ({
			id, label: sky.STYLES[id].label || id, blurb: sky.STYLES[id].blurb || '',
			world: sky.STYLES[id].world || 'bench',

			clouds: sky.STYLES[id].clouds,
			cloudKind: sky.STYLES[id].cloudKind,
			cloudShade: sky.STYLES[id].cloudShade,
			road: sky.STYLES[id].road,

			grid: sky.STYLES[id].grid,

			tree: sky.STYLES[id].tree,

			buildings: sky.STYLES[id].buildings,
			neon: sky.STYLES[id].neon,
		})),

		get worldPalette() {
			const st = sky.STYLES[styleName];
			return (st && st.world) || 'bench';
		},

		get goldenArm() { return goldenArm; },
		set goldenArm(v) {
			if (!sky.GOLDEN_ARMS[v]) return;
			goldenArm = v;
			envBakedAt = -1;
			bakeEnv(true);
		},
		goldenArms: Object.keys(sky.GOLDEN_ARMS).map((id) => ({
			id, label: sky.GOLDEN_ARMS[id].label || id,
		})),

		get goldenGround() { return sky.GOLDEN_GROUND; },
		set goldenGround(v) {
			if (!sky.setGoldenGround(v)) return;
			envBakedAt = -1;
			bakeEnv(true);
		},
		goldenGrounds: Object.keys(sky.GOLDEN_GROUNDS),

		get nightGround() { return sky.NIGHT_GROUND; },
		set nightGround(v) {
			if (!sky.setNightGround(v)) return;
			envBakedAt = -1;
			bakeEnv(true);
		},
		nightGrounds: Object.keys(sky.NIGHT_GROUNDS),

		get blue() { return blueName; },
		set blue(v) {
			if (!sky.SKY_BLUES[v]) return;
			blueName = v;

			envBakedAt = -1;
			bakeEnv(true);
		},
		blues: Object.keys(sky.SKY_BLUES).map((id) => {
			const sp = sky.blueSpread(id);
			return {
				id,
				label: sky.SKY_BLUES[id].label || id,
				spread: sp === null ? null : Math.round(sp * 100),
			};
		}),

		get envIntensity() { return envIntensity; },

		rebake() {
			envBakedAt = -1;
			envBakedUp = 2;
			bakeEnv(true);
		},

		rendererState() {
			return {
				exposure: +renderer.toneMappingExposure.toFixed(4),
				sun: +sunLight.intensity.toFixed(4),
				sunCasts: !!sunLight.castShadow,
				moon: +moonLight.intensity.toFixed(4),
				hemi: +hemi.intensity.toFixed(4),
				hemiSky: '#' + hemi.color.getHexString(),
				env: +envIntensity.toFixed(4),

				envBakedUp: +envBakedUp.toFixed(5),
				envBakedAt: +envBakedAt.toFixed(5),
				fogNear: Math.round(scene.fog ? scene.fog.near : -1),
				fogFar: Math.round(scene.fog ? scene.fog.far : -1),
				fogColor: scene.fog ? '#' + scene.fog.color.getHexString() : null,
				bg: scene.background && scene.background.isColor
					? '#' + scene.background.getHexString() : null,
				night: +nightLevel.toFixed(4),
			};
		},
		set envIntensity(v) {
			envIntensity = Math.max(0, Math.min(3, v));
			applyMaterials();
			bakeEnv(true);
		},

		get nightLift() { return nightLift; },
		set nightLift(v) { nightLift = Math.max(0, Math.min(4, v)); },

		get shadowLevel() { return shadowLevel; },
		set shadowLevel(v) {
			if (!SHADOW_LEVELS.some((x) => x.id === v)) return;
			shadowLevel = v;
			applyShadowLevel();
		},
		shadowLevels: SHADOW_LEVELS,

		get shadowTexelM() {
			const lv = SHADOW_LEVELS.find((x) => x.id === shadowLevel) || SHADOW_LEVELS[1];
			return (2 * lv.radius) / lv.map;
		},
		get latitudeDeg() { return latitude; },
		set latitudeDeg(v) { latitude = v; },

		get look() { return current; },
		get phaseName() { return current ? current.look.name : ''; },
		clockText: (t) => sky.clockText(t === undefined ? timeOfDay : t),
		presets: sky.PRESETS,

		dress(root, { cast = true, receive = true } = {}) {
			if (!root) return;
			root.traverse((o) => {
				if (!o.isMesh) return;
				o.castShadow = cast;
				o.receiveShadow = receive;
				for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {

					if (m && !m.userData._look) {
						m.userData._look = {
							flatShading: !!m.flatShading,
							roughness: m.roughness,
							envMapIntensity: m.envMapIntensity,
						};
					}
					if (m) tracked.add(m);
				}

				for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
					if (m && m.side === THREE.DoubleSide) m.shadowSide = THREE.FrontSide;
				}
			});
			applyMaterials();
		},

		restyle() { applyMaterials(); },

		update(dt, focus) {
			if (running && dt > 0) timeOfDay = (timeOfDay + dt / dayLengthS) % 1;

			const bearing = WIND_BEARING_DEG * Math.PI / 180;
			windDrift.x += Math.sin(bearing) * windSpeed * dt;
			windDrift.z -= Math.cos(bearing) * windSpeed * dt;

			drift += dt * (windSpeed / 5.0);
			for (let i = 0; i < clouds.length; i++) {

				const o = clouds[i].material.uniforms.offset.value;
				o.x = drift * (0.0016 + i * 0.0009);
				o.y = drift * (0.0007 + i * 0.0004);
			}
			applyLook(focus);
		},
	};
}
