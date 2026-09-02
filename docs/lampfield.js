

import * as THREE from './vendor/three.module.js';

export const FIELD_TEXEL_M = 2;

const MAX_TEXELS = 2048;

export const FIELD_GAIN = 3.2;

const GRAD_TILT = 2.6;

const WRAP = 0.35;

export function lampKernel(lamp, spec, kernel, dx, dz) {
	const a = dx * lamp.tx + dz * lamp.tz;
	const b = (-dx * lamp.tz + dz * lamp.tx) * lamp.s;
	const across = b >= 0 ? spec.across * kernel.house : spec.across * kernel.street;
	const u = a / spec.along;
	const v = b / across;
	const r2 = u * u + v * v;
	if (r2 >= 1) return 0;
	const t = 1 - r2;
	return t * t * lamp.g;
}

const DECK_FAMILIES = new Set(['garage', 'rooftop']);

const NO_FIELD_FAMILIES = new Set(['garage']);

function insideFootprint(px, pz, boxes) {
	for (const b of boxes) {
		const dx = px - b[0];
		const dz = pz - b[1];
		const c = Math.cos(b[4]);
		const s = Math.sin(b[4]);
		if (Math.abs(dx * c + dz * s) <= b[2] && Math.abs(-dx * s + dz * c) <= b[3]) {
			return true;
		}
	}
	return false;
}

export function bakeLampField(lamps, types, kernel, texel = FIELD_TEXEL_M,
	footprints = null) {
	if (!lamps.length) return null;

	const specOf = (l) => types[l.t];
	const reachOf = (l) => {
		const s = specOf(l);
		return Math.max(s.along, s.across * kernel.street);
	};
	let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
	for (const l of lamps) {
		const r = reachOf(l);
		if (l.a[0] - r < minX) minX = l.a[0] - r;
		if (l.a[0] + r > maxX) maxX = l.a[0] + r;
		if (l.a[2] - r < minZ) minZ = l.a[2] - r;
		if (l.a[2] + r > maxZ) maxZ = l.a[2] + r;
	}
	let nx = Math.ceil((maxX - minX) / texel) + 1;
	let nz = Math.ceil((maxZ - minZ) / texel) + 1;

	if (nx > MAX_TEXELS || nz > MAX_TEXELS) {
		texel *= Math.max(nx / MAX_TEXELS, nz / MAX_TEXELS);
		nx = Math.min(MAX_TEXELS, Math.ceil((maxX - minX) / texel) + 1);
		nz = Math.min(MAX_TEXELS, Math.ceil((maxZ - minZ) / texel) + 1);
	}

	const n = nx * nz;
	const intensity = new Float32Array(n);
	const height = new Float32Array(n);
	const colR = new Float32Array(n);
	const colG = new Float32Array(n);

	const best = new Float32Array(n);

	const boxes = (footprints && footprints.length) ? footprints : null;
	for (const lamp of lamps) {
		const spec = specOf(lamp);
		if (!spec) continue;

		if (NO_FIELD_FAMILIES.has(lamp.t)) continue;

		const masked = boxes && !DECK_FAMILIES.has(lamp.t);
		const tint = spec.rgb;
		const r = reachOf(lamp);
		const i0 = Math.max(0, Math.floor((lamp.a[0] - r - minX) / texel));
		const i1 = Math.min(nx - 1, Math.ceil((lamp.a[0] + r - minX) / texel));
		const j0 = Math.max(0, Math.floor((lamp.a[2] - r - minZ) / texel));
		const j1 = Math.min(nz - 1, Math.ceil((lamp.a[2] + r - minZ) / texel));
		for (let j = j0; j <= j1; j += 1) {
			const wz = minZ + j * texel;
			for (let i = i0; i <= i1; i += 1) {
				const k = lampKernel(lamp, spec, kernel, minX + i * texel - lamp.a[0],
					wz - lamp.a[2]);
				if (k <= 0) continue;
				const c = j * nx + i;
				if (masked && insideFootprint(minX + i * texel, wz, boxes)) continue;
				intensity[c] += k;
				colR[c] += k * tint[0];
				colG[c] += k * tint[1];
				if (k > best[c]) { best[c] = k; height[c] = lamp.a[1]; }
			}
		}
	}

	let peak = 0, lit = 0;
	for (let c = 0; c < n; c += 1) {
		if (intensity[c] > peak) peak = intensity[c];
		if (intensity[c] > 0) {
			lit += 1;
			colR[c] /= intensity[c];
			colG[c] /= intensity[c];
		} else {

			colR[c] = 1;
			colG[c] = 1;
		}
	}
	return { intensity, height, colR, colG, nx, nz, x0: minX, z0: minZ, texel, peak, lit };
}

const CHUNK_PARS =   `
uniform sampler2D uLampField;
uniform vec4 uLampFieldXform;
uniform float uLampFieldGain;
uniform vec3 uLampFieldTint;
uniform vec2 uLampFieldHeight;
uniform vec2 uLampFieldTexel;
varying vec3 vLampFieldWorld;
`;

const CHUNK_VERTEX =   `
#include <worldpos_vertex>
	vec4 lampFieldPos = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		lampFieldPos = batchingMatrix * lampFieldPos;
	#endif
	#ifdef USE_INSTANCING
		lampFieldPos = instanceMatrix * lampFieldPos;
	#endif
	vLampFieldWorld = ( modelMatrix * lampFieldPos ).xyz;
`;

const CHUNK_FLAT =   `
	#if defined( RE_IndirectDiffuse )
	{
		vec2 lampUv = ( vLampFieldWorld.xz - uLampFieldXform.xy ) * uLampFieldXform.zw;
		if ( uLampFieldGain > 0.0 && lampUv.x > 0.0 && lampUv.x < 1.0 && lampUv.y > 0.0 && lampUv.y < 1.0 ) {
			vec4 lampTex = texture2D( uLampField, lampUv );
			float dy = abs( vLampFieldWorld.y - lampTex.g );
			float gate = 1.0 - smoothstep( uLampFieldHeight.x, uLampFieldHeight.y, dy );
			vec3 lampZone = max( vec3( lampTex.b, lampTex.a, 3.0 - lampTex.b - lampTex.a ), vec3( 0.0 ) );
			irradiance += uLampFieldTint * lampZone * ( lampTex.r * uLampFieldGain * gate );
		}
	}
	#endif
`;

const CHUNK_GRAD =   `
	#if defined( RE_IndirectDiffuse )
	{
		vec2 lampUv = ( vLampFieldWorld.xz - uLampFieldXform.xy ) * uLampFieldXform.zw;
		if ( uLampFieldGain > 0.0 && lampUv.x > 0.0 && lampUv.x < 1.0 && lampUv.y > 0.0 && lampUv.y < 1.0 ) {
			vec4 lampTex = texture2D( uLampField, lampUv );
			float dy = abs( vLampFieldWorld.y - lampTex.g );
			float gate = 1.0 - smoothstep( uLampFieldHeight.x, uLampFieldHeight.y, dy );
			vec3 lampZone = max( vec3( lampTex.b, lampTex.a, 3.0 - lampTex.b - lampTex.a ), vec3( 0.0 ) );
			vec2 e = uLampFieldTexel;
			float ir = texture2D( uLampField, lampUv + vec2( e.x, 0.0 ) ).r;
			float il = texture2D( uLampField, lampUv - vec2( e.x, 0.0 ) ).r;
			float iu = texture2D( uLampField, lampUv + vec2( 0.0, e.y ) ).r;
			float id = texture2D( uLampField, lampUv - vec2( 0.0, e.y ) ).r;
			// Normalised by the centre value, so the tilt depends on the SHAPE of the
			// falloff and not on how bright this particular family is — otherwise a
			// highway mast would light a car from a different angle than a park lantern
			// standing the same distance away.
			vec2 grad = vec2( ir - il, iu - id ) / max( lampTex.r, 1e-4 );
			vec3 L = normalize( vec3( grad.x * ${GRAD_TILT.toFixed(2)}, 1.0, grad.y * ${GRAD_TILT.toFixed(2)} ) );
			float nl = dot( normalize( geometryNormal ), L );
			float w = max( 0.0, ( nl + ${WRAP.toFixed(2)} ) / ( 1.0 + ${WRAP.toFixed(2)} ) );
			irradiance += uLampFieldTint * lampZone * ( lampTex.r * uLampFieldGain * gate * w );
		}
	}
	#endif
`;

export function buildLampField(fleet, opts = {}) {
	const kernel = fleet.kernel;

	const types = {};
	for (const [name, spec] of Object.entries(fleet.types)) {
		const c = new THREE.Color(spec.tint);
		const mean = (c.r + c.g + c.b) / 3;
		types[name] = {
			...spec,
			rgb: mean > 1e-6 ? [c.r / mean, c.g / mean, c.b / mean] : [1, 1, 1],
		};
	}
	const bake = bakeLampField(fleet.lamps, types, kernel,
		opts.texel || FIELD_TEXEL_M, opts.footprints || null);
	if (!bake) return null;

	const { nx, nz, x0, z0, texel } = bake;
	const data = new Uint16Array(nx * nz * 4);
	const half = THREE.DataUtils.toHalfFloat;
	for (let c = 0; c < nx * nz; c += 1) {
		data[c * 4] = half(bake.intensity[c]);
		data[c * 4 + 1] = half(bake.height[c]);
		data[c * 4 + 2] = half(bake.colR[c]);
		data[c * 4 + 3] = half(bake.colG[c]);
	}
	const texture = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat,
		THREE.HalfFloatType);
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;

	texture.wrapS = THREE.ClampToEdgeWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;

	texture.needsUpdate = true;

	const uniforms = {
		uLampField: { value: texture },

		uLampFieldXform: {
			value: new THREE.Vector4(x0, z0, 1 / (nx * texel), 1 / (nz * texel)),
		},
		uLampFieldGain: { value: 0 },
		uLampFieldTint: { value: new THREE.Color(0xffffff) },
		uLampFieldHeight: {
			value: new THREE.Vector2(kernel.heightFull, kernel.heightZero),
		},
		uLampFieldTexel: { value: new THREE.Vector2(1 / nx, 1 / nz) },
	};

	const attached = new WeakSet();
	return {
		texture,
		uniforms,
		bake,

		stats: { nx, nz, texel, peak: bake.peak, lit: bake.lit,
			mb: +(data.byteLength / 1e6).toFixed(2) },

		attach(material, o = {}) {
			if (!material || attached.has(material)) return;
			attached.add(material);
			const grad = !!o.gradient;
			const prev = material.onBeforeCompile;
			const prevKey = material.customProgramCacheKey;
			material.onBeforeCompile = (shader, renderer) => {
				if (prev) prev.call(material, shader, renderer);
				Object.assign(shader.uniforms, uniforms);
				shader.vertexShader = shader.vertexShader
					.replace('#include <common>',
						'#include <common>\nvarying vec3 vLampFieldWorld;')
					.replace('#include <worldpos_vertex>', CHUNK_VERTEX);
				shader.fragmentShader = shader.fragmentShader
					.replace('#include <common>', `#include <common>\n${CHUNK_PARS}`)
					.replace('#include <lights_fragment_maps>',
						`#include <lights_fragment_maps>\n${grad ? CHUNK_GRAD : CHUNK_FLAT}`);
			};
			material.customProgramCacheKey = () => {
				const base = prevKey ? prevKey.call(material) : '';
				return `${base}|lampfield-${grad ? 'grad' : 'flat'}`;
			};
			material.needsUpdate = true;
		},

		set gain(v) { uniforms.uLampFieldGain.value = v; },
		get gain() { return uniforms.uLampFieldGain.value; },

		dispose() { texture.dispose(); },
	};
}
