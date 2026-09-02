

import * as THREE from 'three';

export const GRID_UNIFORM = {
	value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)],
};

export const GRID_STRENGTH = 0.22;

export const GRID_SPACING_M = 25;

export const GRID_LINE_PX = 1.4;

export const GRID_FADE_M = 600;

export const GRID_MINOR_RATIO = 0.38;

export const GRID_MINOR_DIV = 5;

export const GRID_COLOUR = [0.32, 0.88, 1.0];

export const GRID_COLOUR_VAPOR = [1.0, 0.24, 0.86];

export const GRID_PALETTES = {
	cyan: { label: 'Tron cyan', rgb: GRID_COLOUR },
	magenta: { label: 'vaporwave magenta', rgb: GRID_COLOUR_VAPOR },
};

const WORLD_VARYING = 'vGridWorld';

export const GRID_GLSL =   `
uniform vec4 uGrid[2];

float gridBand(vec2 cell, float widthPx) {
	vec2 deriv = fwidth(cell);
	vec2 dist = abs(fract(cell - 0.5) - 0.5) / max(deriv * widthPx, vec2(1e-6));
	float band = 1.0 - min(min(dist.x, dist.y), 1.0);
	float cellPx = max(deriv.x, deriv.y);
	return band * (1.0 - smoothstep(0.35, 1.0, cellPx));
}

float groundGridAmount(vec3 wpos) {
	float strength = uGrid[0].x;
	if (strength <= 0.0) return 0.0;
	float spacing = uGrid[0].y;
	float widthPx = uGrid[0].z;
	float fadeM = uGrid[0].w;
	float minorRatio = uGrid[1].w;

	vec2 major = wpos.xz / spacing;
	float amt = gridBand(major, widthPx);
	amt += gridBand(major * ${GRID_MINOR_DIV.toFixed(1)}, widthPx) * minorRatio;

	float dist = length(wpos - cameraPosition);
	float fade = 1.0 - smoothstep(fadeM * 0.35, fadeM, dist);
	return amt * fade * strength;
}
`;

export function attachGroundGrid(mat) {
	if (!mat || mat.userData.gridAttached) return mat;
	mat.userData.gridAttached = true;
	const prev = mat.onBeforeCompile;
	mat.onBeforeCompile = function (shader, renderer) {
		if (prev) prev.call(this, shader, renderer);
		shader.uniforms.uGrid = GRID_UNIFORM;
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>',
				`#include <common>\nvarying vec3 ${WORLD_VARYING};`)

			.replace('#include <begin_vertex>',
				`#include <begin_vertex>\n${WORLD_VARYING} = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>',
				`#include <common>\nvarying vec3 ${WORLD_VARYING};\n${GRID_GLSL}`)

			.replace('#include <emissivemap_fragment>',
				'#include <emissivemap_fragment>\n'
				+ `totalEmissiveRadiance += uGrid[1].xyz * groundGridAmount(${WORLD_VARYING});`);
	};
	const prevKey = mat.customProgramCacheKey;
	mat.customProgramCacheKey = function () {
		return `${prevKey ? prevKey.call(this) : ''}|groundGrid`;
	};
	mat.needsUpdate = true;
	return mat;
}

export function attachToRoot(root) {
	if (!root) return 0;
	let n = 0;
	const seen = new Set();
	root.traverse((o) => {
		if (!o.isMesh || !o.material) return;
		const mats = Array.isArray(o.material) ? o.material : [o.material];
		for (const m of mats) {
			if (seen.has(m)) continue;
			seen.add(m);
			if (!m.userData.gridAttached) n++;
			attachGroundGrid(m);
		}
	});
	return n;
}

export function writeGrid(on, palette = 'cyan', opts = {}) {
	const u = GRID_UNIFORM.value;
	const rgb = Array.isArray(palette)
		? palette
		: (GRID_PALETTES[palette] || GRID_PALETTES.cyan).rgb;
	u[0].set(
		on ? (opts.strength === undefined ? GRID_STRENGTH : opts.strength) : 0,
		opts.spacing === undefined ? GRID_SPACING_M : opts.spacing,
		opts.linePx === undefined ? GRID_LINE_PX : opts.linePx,
		opts.fadeM === undefined ? GRID_FADE_M : opts.fadeM,
	);
	u[1].set(rgb[0], rgb[1], rgb[2],
		opts.minorRatio === undefined ? GRID_MINOR_RATIO : opts.minorRatio);
}
