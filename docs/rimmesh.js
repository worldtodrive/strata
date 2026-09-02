

import * as THREE from 'three';

export const RIM_STYLES = ['spoke5', 'spoke6', 'spoke7', 'spoke10', 'twin5', 'dish'];

const SPEC = {
	spoke5: { spokes: 5, arcDeg: 21, hub: 0.30, lip: 0.84, dish: 0.30, taper: 0.55 },
	spoke6: { spokes: 6, arcDeg: 19, hub: 0.29, lip: 0.85, dish: 0.30, taper: 0.55 },
	spoke7: { spokes: 7, arcDeg: 16, hub: 0.28, lip: 0.86, dish: 0.28, taper: 0.60 },
	spoke10: { spokes: 10, arcDeg: 11, hub: 0.26, lip: 0.87, dish: 0.26, taper: 0.70 },

	twin5: { spokes: 5, arcDeg: 9, hub: 0.30, lip: 0.85, dish: 0.30, taper: 0.60, twin: 0.13 },
};

const SEG = 24;

export function buildBrakeGeometry(style, R, W) {
	const s = SPEC[style];
	if (!s || !(R > 0) || !(W > 0)) return null;
	const pos = [];
	const tri = (a, b, c) => {
		pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
	};
	const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
	const P = (x, r, th) => [x, r * Math.cos(th), r * Math.sin(th)];

	const rIn = 0.34 * R;
	const rOut = 0.80 * R;
	const x0 = -0.06 * W;
	const x1 = x0 - 0.05 * W;
	const slots = s.spokes + 2;
	const slotArc = (Math.PI * 2) / slots * 0.34;

	for (let i = 0; i < SEG * 2; i++) {
		const t0 = (i / (SEG * 2)) * Math.PI * 2;
		const t1 = ((i + 1) / (SEG * 2)) * Math.PI * 2;

		const mid = (t0 + t1) / 2;
		const phase = ((mid % ((Math.PI * 2) / slots)) + (Math.PI * 2) / slots)
			% ((Math.PI * 2) / slots);
		if (phase < slotArc) continue;

		quad(P(x0, rIn, t0), P(x0, rOut, t0), P(x0, rOut, t1), P(x0, rIn, t1));
		quad(P(x1, rIn, t1), P(x1, rOut, t1), P(x1, rOut, t0), P(x1, rIn, t0));

		quad(P(x0, rOut, t0), P(x1, rOut, t0), P(x1, rOut, t1), P(x0, rOut, t1));
	}

	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	g.computeBoundingSphere();
	return g;
}

export function buildRimGeometry(style, R, W) {
	const s = SPEC[style];
	if (!s || !(R > 0) || !(W > 0)) return null;

	const pos = [];
	const tri = (a, b, c) => {
		pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
	};
	const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };

	const P = (x, r, th) => [x, r * Math.cos(th), r * Math.sin(th)];

	const xOut = W / 2;
	const rLip = s.lip * R;
	const rHub = s.hub * R;

	for (let i = 0; i < SEG; i++) {
		const t0 = (i / SEG) * Math.PI * 2;
		const t1 = ((i + 1) / SEG) * Math.PI * 2;
		quad(P(-xOut, R, t0), P(xOut, R, t0), P(xOut, R, t1), P(-xOut, R, t1));

		const ri = R * 0.995;
		quad(P(-xOut, ri, t1), P(xOut, ri, t1), P(xOut, ri, t0), P(-xOut, ri, t0));
	}

	for (const side of [1, -1]) {
		const xf = side * xOut;
		const xd = side * (xOut - s.dish * W);
		const xb = side * (xOut - (s.dish + 0.18) * W);

		for (let i = 0; i < SEG; i++) {
			const t0 = (i / SEG) * Math.PI * 2;
			const t1 = ((i + 1) / SEG) * Math.PI * 2;
			if (side > 0) {
				quad(P(xf, R, t0), P(xf, rLip, t0), P(xf, rLip, t1), P(xf, R, t1));
				quad(P(xf, rLip, t0), P(xd, rLip, t0), P(xd, rLip, t1), P(xf, rLip, t1));
			} else {
				quad(P(xf, rLip, t0), P(xf, R, t0), P(xf, R, t1), P(xf, rLip, t1));
				quad(P(xd, rLip, t0), P(xf, rLip, t0), P(xf, rLip, t1), P(xd, rLip, t1));
			}
		}

		for (let i = 0; i < SEG; i++) {
			const t0 = (i / SEG) * Math.PI * 2;
			const t1 = ((i + 1) / SEG) * Math.PI * 2;
			const c = [xd, 0, 0];
			if (side > 0) tri(c, P(xd, rHub, t0), P(xd, rHub, t1));
			else tri(c, P(xd, rHub, t1), P(xd, rHub, t0));
			quad(P(xd, rHub, t0), P(0, rHub, t0), P(0, rHub, t1), P(xd, rHub, t1));
		}

		const arc = (s.arcDeg * Math.PI) / 180;
		const offs = s.twin ? [-s.twin, s.twin] : [0];
		for (let k = 0; k < s.spokes; k++) {
			const mid = (k / s.spokes) * Math.PI * 2;
			for (const o of offs) {
				const m = mid + o;

				const aIn = arc * s.taper;
				const h0 = [xd, rHub * Math.cos(m - aIn), rHub * Math.sin(m - aIn)];
				const h1 = [xd, rHub * Math.cos(m + aIn), rHub * Math.sin(m + aIn)];
				const l0 = [xd, rLip * Math.cos(m - arc), rLip * Math.sin(m - arc)];
				const l1 = [xd, rLip * Math.cos(m + arc), rLip * Math.sin(m + arc)];
				const b = (p) => [xb, p[1], p[2]];
				if (side > 0) {
					quad(h0, l0, l1, h1);
					quad(b(h1), b(l1), b(l0), b(h0));
					quad(h0, b(h0), b(l0), l0);
					quad(l1, b(l1), b(h1), h1);
				} else {
					quad(h1, l1, l0, h0);
					quad(b(h0), b(l0), b(l1), b(h1));
					quad(l0, b(l0), b(h0), h0);
					quad(h1, b(h1), b(l1), l1);
				}
			}
		}
	}

	{
		const vr = R * 0.055;
		const vm = 0.62 * R;
		const th = Math.PI / s.spokes;
		for (const side of [1, -1]) {
			const xa = side * (xOut - s.dish * W);
			const xb = side * (xOut + 0.05 * W);
			for (let i = 0; i < 8; i++) {
				const a0 = (i / 8) * Math.PI * 2;
				const a1 = ((i + 1) / 8) * Math.PI * 2;
				const c = [Math.cos(th) * vm, Math.sin(th) * vm];
				const q = (x, a) => [x, c[0] + vr * Math.cos(a), c[1] + vr * Math.sin(a)];
				if (side > 0) quad(q(xa, a0), q(xb, a0), q(xb, a1), q(xa, a1));
				else quad(q(xa, a1), q(xb, a1), q(xb, a0), q(xa, a0));
			}

			const c = [Math.cos(th) * vm, Math.sin(th) * vm];
			for (let i = 0; i < 8; i++) {
				const a0 = (i / 8) * Math.PI * 2;
				const a1 = ((i + 1) / 8) * Math.PI * 2;
				const mid = [xb, c[0], c[1]];
				const p0 = [xb, c[0] + vr * Math.cos(a0), c[1] + vr * Math.sin(a0)];
				const p1 = [xb, c[0] + vr * Math.cos(a1), c[1] + vr * Math.sin(a1)];
				if (side > 0) tri(mid, p0, p1); else tri(mid, p1, p0);
			}
		}
	}

	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

	g.computeVertexNormals();
	g.computeBoundingSphere();
	return g;
}
