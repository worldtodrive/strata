

const WORLD_VARYING = 'vCoverWorld';

const FRAME = { value: new Float32Array([1000, 2000, 1, 8000]) };
const ID_MAP = { value: null };
const PALETTE = { value: null };
const FAR_MAP = { value: null };

let RAW_ROWS = [];

let loaded = null;

async function decodeIds(url, size) {
	const bmp = await createImageBitmap(await (await fetch(url)).blob());
	if (bmp.width !== size || bmp.height !== size) {
		throw new Error(`cover id map is ${bmp.width}x${bmp.height}, manifest says ${size}`);
	}
	const out = new Uint8Array(size * size);
	const strip = Math.max(1, Math.min(size, Math.floor(8_000_000 / size)));
	const canvas = (typeof OffscreenCanvas !== 'undefined')
		? new OffscreenCanvas(size, strip)
		: Object.assign(document.createElement('canvas'), { width: size, height: strip });
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	for (let y = 0; y < size; y += strip) {
		const h = Math.min(strip, size - y);
		ctx.clearRect(0, 0, size, h);
		ctx.drawImage(bmp, 0, y, size, h, 0, 0, size, h);
		const px = ctx.getImageData(0, 0, size, h).data;
		for (let i = 0, n = size * h; i < n; i++) out[y * size + i] = px[i * 4];
	}
	bmp.close();
	return out;
}

export async function loadCover(THREE, urls, meta) {
	const ids = await decodeIds(urls.id, meta.px);
	const tex = new THREE.DataTexture(ids, meta.px, meta.px, THREE.RedFormat);
	tex.internalFormat = 'R8';
	tex.type = THREE.UnsignedByteType;

	tex.minFilter = THREE.NearestFilter;
	tex.magFilter = THREE.NearestFilter;
	tex.generateMipmaps = false;
	tex.wrapS = THREE.ClampToEdgeWrapping;
	tex.wrapT = THREE.ClampToEdgeWrapping;
	tex.flipY = false;
	tex.unpackAlignment = 1;
	tex.needsUpdate = true;
	ID_MAP.value = tex;

	RAW_ROWS = (meta.palette || []).map((r) => r.slice());
	const lut = new Uint8Array(256 * 4);
	for (let i = 0; i < 256; i++) {
		const r = RAW_ROWS[i] || [0, 0, 0, 0];
		lut[i * 4] = r[0]; lut[i * 4 + 1] = r[1]; lut[i * 4 + 2] = r[2]; lut[i * 4 + 3] = r[3];
	}
	const pal = new THREE.DataTexture(lut, 256, 1, THREE.RGBAFormat);
	pal.colorSpace = THREE.SRGBColorSpace;
	pal.minFilter = THREE.NearestFilter;
	pal.magFilter = THREE.NearestFilter;
	pal.generateMipmaps = false;
	pal.needsUpdate = true;
	PALETTE.value = pal;

	const far = await new THREE.TextureLoader().loadAsync(urls.far);
	far.colorSpace = THREE.SRGBColorSpace;
	far.flipY = false;
	far.wrapS = THREE.ClampToEdgeWrapping;
	far.wrapT = THREE.ClampToEdgeWrapping;
	far.generateMipmaps = true;
	far.minFilter = THREE.LinearMipmapLinearFilter;
	far.magFilter = THREE.LinearFilter;
	far.needsUpdate = true;
	FAR_MAP.value = far;

	FRAME.value[0] = meta.half_m !== undefined ? meta.half_m : 1000;
	FRAME.value[1] = meta.size_m !== undefined ? meta.size_m : 2000;
	FRAME.value[3] = meta.px;
	loaded = { urls, meta };
	return loaded;
}

export function haveCover() { return !!ID_MAP.value; }

export function setAnisotropy(n) {
	if (FAR_MAP.value) { FAR_MAP.value.anisotropy = n; FAR_MAP.value.needsUpdate = true; }
}

const GLSL = `
uniform sampler2D uCoverId;
uniform sampler2D uCoverPal;
uniform sampler2D uCoverFar;
uniform vec4 uCoverFrame;

vec4 coverAt(vec3 world) {
	vec2 uv = (world.xz + uCoverFrame.x) / uCoverFrame.y;

	if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);

	float texels = max(length(dFdx(uv)), length(dFdy(uv))) * uCoverFrame.w;

	float id = texture2D(uCoverId, uv).r;
	vec4 near = texture2D(uCoverPal, vec2(id * (255.0 / 256.0) + (0.5 / 256.0), 0.5));

	vec4 far = texture2D(uCoverFar, uv);
	return mix(near, far, smoothstep(0.75, 2.0, texels));
}
`;

export function attachCoverCoat(mat) {
	if (!mat || mat.userData.coverAttached) return mat;
	mat.userData.coverAttached = true;
	const prev = mat.onBeforeCompile;
	mat.onBeforeCompile = function (shader, renderer) {
		if (prev) prev.call(this, shader, renderer);
		shader.uniforms.uCoverId = ID_MAP;
		shader.uniforms.uCoverPal = PALETTE;
		shader.uniforms.uCoverFar = FAR_MAP;
		shader.uniforms.uCoverFrame = FRAME;
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>',
				`#include <common>\nvarying vec3 ${WORLD_VARYING};`)

			.replace('#include <begin_vertex>',
				`#include <begin_vertex>\n${WORLD_VARYING} = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>',
				`#include <common>\nvarying vec3 ${WORLD_VARYING};\n${GLSL}`)

			.replace('#include <map_fragment>',
				'#include <map_fragment>\n'
				+ 'if (uCoverFrame.z > 0.0) {\n'
				+ `	vec4 coverPaint = coverAt(${WORLD_VARYING});\n`
				+ '	diffuseColor.rgb = mix(diffuseColor.rgb, coverPaint.rgb,'
				+ ' coverPaint.a * uCoverFrame.z);\n'
				+ '}');
	};
	const prevKey = mat.customProgramCacheKey;
	mat.customProgramCacheKey = function () {
		return `${prevKey ? prevKey.call(this) : ''}|coverCoat`;
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
		for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
			if (seen.has(m)) continue;
			seen.add(m);
			if (!m.userData.coverAttached) n++;
			attachCoverCoat(m);
		}
	});
	return n;
}

export function rawPalette() { return RAW_ROWS; }

export function setPalette(rows) {
	const pal = PALETTE.value;
	if (!pal) return 0;
	const lut = pal.image.data;
	let n = 0;
	for (let i = 0; i < 256; i++) {
		const r = rows[i];
		if (!r) continue;
		lut[i * 4] = r[0]; lut[i * 4 + 1] = r[1]; lut[i * 4 + 2] = r[2];
		n++;
	}
	pal.needsUpdate = true;
	return n;
}

export function writeCover(strength) {
	FRAME.value[2] = strength === undefined ? 1 : Number(strength);
}

export function coverState() {
	const m = loaded ? loaded.meta : null;
	return {
		loaded: !!ID_MAP.value,
		mode: 'id',
		strength: FRAME.value[2],
		px: m ? m.px : null,
		mpp: m ? m.mpp : null,
		far_px: m ? m.far_px : null,
		slots: m ? m.slots : null,
		gpu_mb: m ? m.gpu_mb : null,
		weld: m ? m.weld : null,
		slotsGraded: RAW_ROWS.filter((r) => r && r[3]).length,
		anisotropy: FAR_MAP.value ? FAR_MAP.value.anisotropy : null,
	};
}
