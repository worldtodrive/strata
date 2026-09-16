

import * as THREE from 'three';

const MASK_W = 1024;
const MASK_H = 512;

export function ringsFrom(doc) {
	if (doc && Array.isArray(doc.land)) return doc.land;
	const out = [];
	for (const f of (doc && doc.features) || []) {
		const g = f.geometry;
		if (!g) continue;
		if (g.type === 'Polygon') out.push(...g.coordinates);
		else if (g.type === 'MultiPolygon') for (const p of g.coordinates) out.push(...p);
	}
	return out;
}

export function landMask(rings) {
	const canvas = document.createElement('canvas');
	canvas.width = MASK_W;
	canvas.height = MASK_H;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });

	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, MASK_W, MASK_H);

	ctx.fillStyle = '#fff';
	ctx.beginPath();
	for (const ring of rings) {
		for (let i = 0; i < ring.length; i++) {

			const x = ((ring[i][0] + 180) / 360) * MASK_W;
			const y = ((90 - ring[i][1]) / 180) * MASK_H;
			if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		}
		ctx.closePath();
	}
	ctx.fill('evenodd');

	const px = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
	const bits = new Uint8Array(MASK_W * MASK_H);
	for (let i = 0, j = 0; i < bits.length; i++, j += 4) bits[i] = px[j] > 127 ? 1 : 0;

	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.generateMipmaps = false;
	texture.colorSpace = THREE.NoColorSpace;

	return { bits, texture, width: MASK_W, height: MASK_H };
}

export function isLand(mask, x, y, z) {
	const lon = Math.atan2(-z, x);
	const lat = Math.asin(Math.max(-1, Math.min(1, y)));
	let px = Math.floor((lon / (Math.PI * 2) + 0.5) * mask.width);
	let py = Math.floor((0.5 - lat / Math.PI) * mask.height);
	px = ((px % mask.width) + mask.width) % mask.width;
	py = Math.max(0, Math.min(mask.height - 1, py));
	return mask.bits[py * mask.width + px] === 1;
}

export function rng(seed) {
	let a = seed >>> 0;
	return function next() {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const VERT = `
	attribute float aJit;
	varying vec3 vDir;
	varying vec3 vOut;
	varying vec3 vWorld;
	varying float vJit;
	void main() {

		vDir = normalize(position);

		vOut = normalize(mat3(modelMatrix) * vDir);
		vJit = aJit;
		vec4 w = modelMatrix * vec4(position, 1.0);
		vWorld = w.xyz;
		gl_Position = projectionMatrix * viewMatrix * w;
	}
`;

const FRAG = `
	precision highp float;

	uniform sampler2D uMask;
	uniform vec3 uLand;
	uniform vec3 uLandAlt;
	uniform vec3 uOcean;
	uniform vec3 uSun;
	uniform vec3 uAmbient;
	uniform vec3 uGlow;
	uniform vec3 uRim;
	uniform vec3 uLightDir;
	uniform vec3 uCam;
	uniform float uGlowAmount;
	uniform float uBandAmount;
	uniform float uJitAmount;
	uniform float uWrap;

	varying vec3 vDir;
	varying vec3 vOut;
	varying vec3 vWorld;
	varying float vJit;

	void main() {

		vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));

		if (dot(n, vOut) < 0.0) n = -n;

		vec2 uv = vec2(atan(-vDir.z, vDir.x) / 6.2831853 + 0.5,
		               asin(clamp(vDir.y, -1.0, 1.0)) / 3.1415927 + 0.5);
		float land = texture2D(uMask, uv).r;

		float band = smoothstep(0.0, 1.0, abs(vDir.y));
		vec3 soil = mix(uLand, uLandAlt, band * uBandAmount);

		float jit = 1.0 + (vJit - 0.5) * 2.0 * uJitAmount * mix(0.3, 1.0, land);
		vec3 albedo = mix(uOcean, soil, land) * jit;

		float ndl = dot(n, uLightDir);

		float diff = clamp(ndl * (1.0 - uWrap) + uWrap, 0.0, 1.0);
		vec3 lit = albedo * (uAmbient + uSun * diff);

		float night = smoothstep(0.12, -0.30, ndl);
		lit += uGlow * land * night * uGlowAmount * jit;

		vec3 view = normalize(uCam - vWorld);
		float fres = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 3.0);
		lit += uRim * fres * (0.35 + 0.65 * max(ndl, 0.0));

		gl_FragColor = vec4(lit, 1.0);
	}
`;

export function buildGlobe(mask, { detail = 15, relief = 0.016, seed = 20260911 } = {}) {

	const geo = new THREE.IcosahedronGeometry(1, detail);
	const pos = geo.attributes.position;
	const count = pos.count;

	const jit = new Float32Array(count);
	const next = rng(seed);

	for (let i = 0; i < count; i += 3) {
		const shade = next();
		jit[i] = shade;
		jit[i + 1] = shade;
		jit[i + 2] = shade;
	}

	for (let i = 0; i < count; i++) {
		const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
		if (!isLand(mask, x, y, z)) continue;

		const k = 1 + relief;
		pos.setXYZ(i, x * k, y * k, z * k);
	}
	pos.needsUpdate = true;
	geo.setAttribute('aJit', new THREE.BufferAttribute(jit, 1));
	geo.computeBoundingSphere();

	const uniforms = {
		uMask: { value: mask.texture },
		uLand: { value: new THREE.Color(0x5aa94b) },
		uLandAlt: { value: new THREE.Color(0x5aa94b) },
		uOcean: { value: new THREE.Color(0x2a6cb0) },
		uSun: { value: new THREE.Color(0xfff3dd) },
		uAmbient: { value: new THREE.Color(0x2b3446) },
		uGlow: { value: new THREE.Color(0xffb35c) },
		uRim: { value: new THREE.Color(0x5f9fe0) },
		uLightDir: { value: new THREE.Vector3(1, 0.35, 0.6).normalize() },
		uCam: { value: new THREE.Vector3() },
		uGlowAmount: { value: 0.35 },
		uBandAmount: { value: 0.0 },
		uJitAmount: { value: 0.09 },
		uWrap: { value: 0.38 },
	};

	const mat = new THREE.ShaderMaterial({
		uniforms,
		vertexShader: VERT,
		fragmentShader: FRAG,

		extensions: { derivatives: true },
	});

	const mesh = new THREE.Mesh(geo, mat);
	mesh.name = 'globe';
	return { mesh, uniforms, triangles: count / 3 };
}
