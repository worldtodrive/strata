

import * as THREE from 'three';

export const CROSSING = {
	leadS: 18,
	gateDelayS: 3,
	armTravelS: 8,
	tailS: 1.5,
	flashHz: 1,
};

function canvasTexture(w, h, draw) {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	draw(canvas.getContext('2d'), w, h);
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;
}

const rgb = (c) => new THREE.Color(c[0], c[1], c[2]);

export async function buildSigns(url, opts = {}) {
	const res = await fetch(url);
	if (!res.ok) return null;
	const data = await res.json();
	const crossings = data.crossings || [];
	const approaches = data.approaches || [];
	const stops = data.stops || [];
	if (!approaches.length && !stops.length) return null;
	const g = data.geometry;
	const p = data.palette;
	const dummy = new THREE.Object3D();
	const group = new THREE.Group();
	group.name = 'Signs';
	const meshes = [];
	function add(mesh) {

		mesh.frustumCulled = false;
		mesh.instanceMatrix.needsUpdate = true;
		group.add(mesh);
		meshes.push(mesh);
		return mesh;
	}

	const A = approaches.map((a) => {
		const [c, x, y, z, yaw, armLen, adx, adz] = a;
		const fx = Math.cos(yaw), fz = -Math.sin(yaw);
		return { c, x, y, z, yaw, armLen, adx, adz, fx, fz, cr: crossings[c] };
	});
	const withLight = A.filter((a) => a.cr.light);
	const withGate = A.filter((a) => a.cr.gate);

	const unitBox = new THREE.BoxGeometry(1, 1, 1);
	const mastMat = new THREE.MeshStandardMaterial({ color: rgb(p.mast), roughness: 0.6, metalness: 0.3 });

	const masts = add(new THREE.InstancedMesh(unitBox, mastMat, A.length));
	A.forEach((a, i) => {
		dummy.position.set(a.x, a.y + g.mast_height_m / 2, a.z);
		dummy.rotation.set(0, a.yaw, 0);
		dummy.scale.set(g.mast_width_m, g.mast_height_m, g.mast_width_m);
		dummy.updateMatrix();
		masts.setMatrixAt(i, dummy.matrix);
	});

	const word = (text) => canvasTexture(512, 96, (ctx, w, h) => {
		ctx.fillStyle = '#f4f4f0';
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = '#111';
		ctx.lineWidth = 8;
		ctx.strokeRect(6, 6, w - 12, h - 12);
		ctx.fillStyle = '#111';
		ctx.font = 'bold 62px Arial, Helvetica, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, w / 2, h / 2 + 3, w - 40);
	});
	const backMat = new THREE.MeshStandardMaterial({ color: rgb(p.crossbuck_back), roughness: 0.7, metalness: 0.2 });
	const bladeGeom = new THREE.BoxGeometry(0.02, g.crossbuck_width_m, g.crossbuck_len_m);
	const bladeMats = (tex) => [
		new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }),
		backMat, backMat, backMat, backMat, backMat,
	];
	const bladeA = add(new THREE.InstancedMesh(bladeGeom, bladeMats(word('RAILROAD')), A.length));
	const bladeB = add(new THREE.InstancedMesh(bladeGeom, bladeMats(word('CROSSING')), A.length));
	A.forEach((a, i) => {
		const y = a.y + g.crossbuck_y_m;
		dummy.scale.set(1, 1, 1);

		dummy.position.set(a.x + a.fx * 0.08, y, a.z + a.fz * 0.08);
		dummy.rotation.set(Math.PI / 4, a.yaw, 0, 'YXZ');
		dummy.updateMatrix();
		bladeA.setMatrixAt(i, dummy.matrix);
		dummy.position.set(a.x + a.fx * 0.10, y, a.z + a.fz * 0.10);
		dummy.rotation.set(-Math.PI / 4, a.yaw, 0, 'YXZ');
		dummy.updateMatrix();
		bladeB.setMatrixAt(i, dummy.matrix);
	});
	dummy.rotation.set(0, 0, 0, 'XYZ');

	const flashOn = rgb(p.flash_on);
	const flashOff = rgb(p.flash_off);
	let crossarms = null, backplates = null, lenses = null;
	if (withLight.length) {
		crossarms = add(new THREE.InstancedMesh(unitBox, mastMat, withLight.length));
		const plateGeom = new THREE.CircleGeometry(g.flasher_backplate_m / 2, 20).rotateY(Math.PI / 2);
		const lensGeom = new THREE.CircleGeometry(g.flasher_lens_m / 2, 16).rotateY(Math.PI / 2);
		backplates = add(new THREE.InstancedMesh(plateGeom,
			new THREE.MeshStandardMaterial({ color: rgb(p.backplate), roughness: 0.9 }), withLight.length * 2));
		lenses = add(new THREE.InstancedMesh(lensGeom,
			new THREE.MeshBasicMaterial({ toneMapped: false }), withLight.length * 2));
		lenses.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(withLight.length * 6), 3);
		withLight.forEach((a, i) => {
			const y = a.y + g.flasher_y_m;

			const across = Math.atan2(-a.adz, a.adx);
			dummy.position.set(a.x + a.fx * 0.08, y, a.z + a.fz * 0.08);
			dummy.rotation.set(0, across, 0);
			dummy.scale.set(g.flasher_spread_m + g.flasher_backplate_m, 0.08, 0.08);
			dummy.updateMatrix();
			crossarms.setMatrixAt(i, dummy.matrix);
			dummy.rotation.set(0, a.yaw, 0);
			dummy.scale.set(1, 1, 1);
			for (let k = 0; k < 2; k++) {
				const off = (k === 0 ? -1 : 1) * g.flasher_spread_m / 2;
				const bx = a.x + a.adx * off, bz = a.z + a.adz * off;
				dummy.position.set(bx + a.fx * 0.13, y, bz + a.fz * 0.13);
				dummy.updateMatrix();
				backplates.setMatrixAt(i * 2 + k, dummy.matrix);
				dummy.position.set(bx + a.fx * 0.15, y, bz + a.fz * 0.15);
				dummy.updateMatrix();
				lenses.setMatrixAt(i * 2 + k, dummy.matrix);
				flashOff.toArray(lenses.instanceColor.array, (i * 2 + k) * 3);
			}
		});
	}

	let armStripes = null, armLamps = null;
	const gates = [];
	if (withGate.length) {
		const boxes = add(new THREE.InstancedMesh(unitBox,
			new THREE.MeshStandardMaterial({ color: rgb(p.gate_box), roughness: 0.6, metalness: 0.3 }),
			withGate.length * 2));
		let stripes = 0;
		withGate.forEach((a, i) => {
			const [bw, bh, bd] = g.gate_box_m;
			dummy.rotation.set(0, a.yaw, 0);
			dummy.position.set(a.x + a.adx * 0.3, a.y + bh / 2, a.z + a.adz * 0.3);
			dummy.scale.set(bw, bh, bd);
			dummy.updateMatrix();
			boxes.setMatrixAt(i * 2, dummy.matrix);

			const px = a.x + a.adx * g.arm_pivot_out_m + a.fx * 0.3;
			const pz = a.z + a.adz * g.arm_pivot_out_m + a.fz * 0.3;
			dummy.position.set(px - a.adx * 0.7, a.y + g.arm_pivot_y_m, pz - a.adz * 0.7);
			dummy.scale.set(0.2, 0.3, 0.6);
			dummy.updateMatrix();
			boxes.setMatrixAt(i * 2 + 1, dummy.matrix);
			const n = Math.max(1, Math.ceil(a.armLen / g.arm_stripe_m));
			gates.push({ a, px, py: a.y + g.arm_pivot_y_m, pz, n, first: stripes,
				armYaw: Math.atan2(-a.adz, a.adx), angle: g.arm_up_rad, posed: -1 });
			stripes += n;
		});
		armStripes = add(new THREE.InstancedMesh(unitBox,
			new THREE.MeshStandardMaterial({ roughness: 0.5 }), stripes));
		const red = rgb(p.arm_red), white = rgb(p.arm_white);
		for (const gate of gates) {
			for (let k = 0; k < gate.n; k++) armStripes.setColorAt(gate.first + k, k % 2 ? white : red);
		}
		armStripes.instanceColor.needsUpdate = true;
		armLamps = add(new THREE.InstancedMesh(
			new THREE.CircleGeometry(g.arm_lamp_m / 2, 12).rotateY(Math.PI / 2),
			new THREE.MeshBasicMaterial({ toneMapped: false }), gates.length * 3));
		armLamps.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(gates.length * 9), 3);
	}

	const axis = new THREE.Vector3();
	function poseGate(i) {
		const gate = gates[i];
		if (Math.abs(gate.posed - gate.angle) < 1e-4) return false;
		gate.posed = gate.angle;
		const { a, px, py, pz, n } = gate;
		const c = Math.cos(gate.angle), s = Math.sin(gate.angle);
		axis.set(a.adx * c, s, a.adz * c);
		const seg = a.armLen / n;
		dummy.rotation.set(0, gate.armYaw, gate.angle, 'YZX');
		dummy.scale.set(seg, g.arm_section_m, g.arm_section_m);
		for (let k = 0; k < n; k++) {
			const t = (k + 0.5) * seg;
			dummy.position.set(px + axis.x * t, py + axis.y * t, pz + axis.z * t);
			dummy.updateMatrix();
			armStripes.setMatrixAt(gate.first + k, dummy.matrix);
		}
		dummy.rotation.set(0, a.yaw, 0, 'XYZ');
		dummy.scale.set(1, 1, 1);
		const lift = g.arm_section_m / 2 + 0.01;
		[0.35, 0.65, 0.97].forEach((f, k) => {
			const t = f * a.armLen;
			dummy.position.set(px + axis.x * t + a.fx * lift, py + axis.y * t, pz + axis.z * t + a.fz * lift);
			dummy.updateMatrix();
			armLamps.setMatrixAt(i * 3 + k, dummy.matrix);
		});
		return true;
	}
	gates.forEach((_, i) => poseGate(i));
	dummy.rotation.set(0, 0, 0, 'XYZ');

	const paintRows = data.paint || [];
	const bars = paintRows.filter((r) => r[1] === 0);
	const rxrs = paintRows.filter((r) => r[1] === 1);
	const paintColour = rgb(p.paint);
	const LIFT = 0.03;
	if (bars.length) {
		const mat = new THREE.MeshStandardMaterial({ color: paintColour, roughness: 0.8 });
		if (opts.registerPaint) opts.registerPaint(mat);
		const mesh = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, bars.length));
		bars.forEach((r, i) => {
			const [, , x, y, z, yaw, width] = r;
			dummy.position.set(x, y + LIFT, z);
			dummy.rotation.set(0, yaw, 0);
			dummy.scale.set(g.stop_bar_m, 1, width);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
		});
		mesh.receiveShadow = true;
	}
	if (rxrs.length) {

		const tex = canvasTexture(256, 592, (ctx, w, h) => {
			ctx.clearRect(0, 0, w, h);
			ctx.strokeStyle = ctx.fillStyle = '#fff';
			ctx.lineWidth = 26;
			ctx.beginPath();
			ctx.moveTo(22, 20); ctx.lineTo(w - 22, h - 20);
			ctx.moveTo(w - 22, 20); ctx.lineTo(22, h - 20);
			ctx.stroke();
			ctx.font = 'bold 110px Arial, Helvetica, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			for (const cx of [48, w - 48]) {
				ctx.save();
				ctx.translate(cx, h / 2);
				ctx.scale(0.75, 2.2);
				ctx.fillText('R', 0, 0);
				ctx.restore();
			}
		});
		const mat = new THREE.MeshStandardMaterial({ color: paintColour, map: tex, transparent: true,
			alphaTest: 0.4, roughness: 0.8, depthWrite: false });
		if (opts.registerPaint) opts.registerPaint(mat);

		const geom = new THREE.PlaneGeometry(g.rxr_width_m, g.rxr_len_m).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
		const mesh = add(new THREE.InstancedMesh(geom, mat, rxrs.length));
		rxrs.forEach((r, i) => {
			const [, , x, y, z, yaw, , grade] = r;
			dummy.position.set(x, y + LIFT, z);
			dummy.rotation.set(0, yaw, Math.atan(grade || 0), 'YZX');
			dummy.scale.set(1, 1, 1);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
		});
		mesh.receiveShadow = true;
	}

	const sg = data.stop_geometry;
	let stopCount = 0, yieldCount = 0, plateCount = 0;
	if (stops.length && sg) {
		const octagon = (ctx, w, inset) => {
			const r = w / 2 - inset;
			const k = r * Math.tan(Math.PI / 8);
			ctx.beginPath();
			ctx.moveTo(w / 2 - k, w / 2 - r); ctx.lineTo(w / 2 + k, w / 2 - r);
			ctx.lineTo(w / 2 + r, w / 2 - k); ctx.lineTo(w / 2 + r, w / 2 + k);
			ctx.lineTo(w / 2 + k, w / 2 + r); ctx.lineTo(w / 2 - k, w / 2 + r);
			ctx.lineTo(w / 2 - r, w / 2 + k); ctx.lineTo(w / 2 - r, w / 2 - k);
			ctx.closePath();
		};
		const triangle = (ctx, w, inset) => {
			ctx.beginPath();
			ctx.moveTo(inset, inset * 0.8); ctx.lineTo(w - inset, inset * 0.8); ctx.lineTo(w / 2, w - inset * 1.4);
			ctx.closePath();
		};
		const face = (shape, fill, border, text) => canvasTexture(256, 256, (ctx, w) => {
			ctx.clearRect(0, 0, w, w);
			ctx.fillStyle = border; shape(ctx, w, 2); ctx.fill();
			ctx.fillStyle = fill; shape(ctx, w, 14); ctx.fill();
			if (text) {
				ctx.fillStyle = border;
				ctx.font = 'bold 72px Arial, Helvetica, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(text, w / 2, w / 2 + 4, w - 60);
			}
		});
		const back = (shape) => canvasTexture(64, 64, (ctx, w) => {
			ctx.clearRect(0, 0, w, w);
			ctx.fillStyle = '#8c8e92'; shape(ctx, w, 1); ctx.fill();
		});
		const signMat = (map) => new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.55 });
		const post = sg.post_width_m;
		const kinds = [
			{ list: stops.filter((s) => s[4] !== 1), size: sg.stop_m,
				front: signMat(face(octagon, '#c8102e', '#ffffff', 'STOP')), back: signMat(back(octagon)) },
			{ list: stops.filter((s) => s[4] === 1), size: sg.yield_m,
				front: signMat(face(triangle, '#ffffff', '#c8102e', '')), back: signMat(back(triangle)) },
		];
		const posts = add(new THREE.InstancedMesh(unitBox, mastMat, stops.length));
		let pi = 0;
		for (const kind of kinds) {
			if (!kind.list.length) continue;
			const frontGeom = new THREE.PlaneGeometry(kind.size, kind.size).rotateY(Math.PI / 2);
			const backGeom = new THREE.PlaneGeometry(kind.size, kind.size).rotateY(-Math.PI / 2);
			const fronts = add(new THREE.InstancedMesh(frontGeom, kind.front, kind.list.length));
			const backs = add(new THREE.InstancedMesh(backGeom, kind.back, kind.list.length));
			kind.list.forEach((s, i) => {
				const [x, y, z, yaw] = s;
				const fx = Math.cos(yaw), fz = -Math.sin(yaw);
				const cy = y + sg.sign_bottom_m + kind.size / 2;
				dummy.rotation.set(0, yaw, 0);
				dummy.scale.set(1, 1, 1);
				dummy.position.set(x + fx * sg.proud_m, cy, z + fz * sg.proud_m);
				dummy.updateMatrix();
				fronts.setMatrixAt(i, dummy.matrix);
				dummy.position.set(x + fx * (sg.proud_m - 0.012), cy, z + fz * (sg.proud_m - 0.012));
				dummy.updateMatrix();
				backs.setMatrixAt(i, dummy.matrix);
				const top = sg.sign_bottom_m + kind.size - 0.05;
				dummy.position.set(x, y + top / 2, z);
				dummy.scale.set(post, top, post);
				dummy.updateMatrix();
				posts.setMatrixAt(pi++, dummy.matrix);
			});
		}
		stopCount = kinds[0].list.length;
		yieldCount = kinds[1].list.length;

		const allWay = kinds[0].list.filter((s) => s[5]);
		if (allWay.length) {
			const [pw, ph] = sg.plate_m;
			const plateTex = canvasTexture(256, 84, (ctx, w, h) => {
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(0, 0, w, h);
				ctx.fillStyle = '#c8102e';
				ctx.fillRect(5, 5, w - 10, h - 10);
				ctx.fillStyle = '#ffffff';
				ctx.font = 'bold 50px Arial, Helvetica, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText('ALL WAY', w / 2, h / 2 + 3, w - 24);
			});
			const plates = add(new THREE.InstancedMesh(
				new THREE.PlaneGeometry(pw, ph).rotateY(Math.PI / 2),
				new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.55 }), allWay.length));
			const plateBacks = add(new THREE.InstancedMesh(
				new THREE.PlaneGeometry(pw, ph).rotateY(-Math.PI / 2), backMat, allWay.length));
			allWay.forEach((s, i) => {
				const [x, y, z, yaw] = s;
				const fx = Math.cos(yaw), fz = -Math.sin(yaw);
				const cy = y + sg.sign_bottom_m - ph / 2 - 0.05;
				dummy.rotation.set(0, yaw, 0);
				dummy.scale.set(1, 1, 1);
				dummy.position.set(x + fx * sg.proud_m, cy, z + fz * sg.proud_m);
				dummy.updateMatrix();
				plates.setMatrixAt(i, dummy.matrix);
				dummy.position.set(x + fx * (sg.proud_m - 0.012), cy, z + fz * (sg.proud_m - 0.012));
				dummy.updateMatrix();
				plateBacks.setMatrixAt(i, dummy.matrix);
			});
			plateCount = allWay.length;
		}
	}

	const state = crossings.map(() => ({ watch: null, warnFor: 0, eta: Infinity, lit: false }));
	let boundTo = null;
	function bind(trains) {
		boundTo = trains;
		let watched = 0;
		crossings.forEach((c, i) => {
			state[i].watch = trains && trains.watch ? trains.watch(c.x, -c.z) : null;
			if (state[i].watch) watched++;
		});
		if (trains) ;
	}

	let clock = 0;
	let armMoved = false;
	const gateOf = gates.map((gate) => gate.a.c);
	function update(dt, trains) {
		if (trains !== boundTo) bind(trains);
		clock += dt;
		for (const st of state) {
			st.eta = st.watch ? st.watch.eta(CROSSING.leadS, CROSSING.tailS) : Infinity;
			st.warnFor = st.eta < Infinity ? st.warnFor + dt : 0;
		}
		const rate = (g.arm_up_rad / CROSSING.armTravelS) * dt;
		armMoved = false;
		gates.forEach((gate, i) => {
			const st = state[gateOf[i]];
			const down = st.eta < Infinity && st.warnFor >= CROSSING.gateDelayS;
			const target = down ? 0 : g.arm_up_rad;
			if (gate.angle !== target) {
				gate.angle = gate.angle < target
					? Math.min(target, gate.angle + rate) : Math.max(target, gate.angle - rate);
			}
			if (poseGate(i)) armMoved = true;
		});
		if (armMoved) armStripes.instanceMatrix.needsUpdate = armLamps.instanceMatrix.needsUpdate = true;

		for (const st of state) st.lit = st.eta < Infinity;
		gates.forEach((gate, i) => { if (gate.angle < g.arm_up_rad - 1e-3) state[gateOf[i]].lit = true; });

		const phase = Math.floor(clock * CROSSING.flashHz * 2) % 2;
		if (lenses) {
			const arr = lenses.instanceColor.array;
			withLight.forEach((a, i) => {
				const lit = state[a.c].lit;
				(lit && phase === 0 ? flashOn : flashOff).toArray(arr, i * 6);
				(lit && phase === 1 ? flashOn : flashOff).toArray(arr, i * 6 + 3);
			});
			lenses.instanceColor.needsUpdate = true;
		}
		if (armLamps) {
			const arr = armLamps.instanceColor.array;
			gates.forEach((gate, i) => {
				const lit = state[gateOf[i]].lit;
				(lit && phase === 0 ? flashOn : flashOff).toArray(arr, i * 9);
				(lit && phase === 1 ? flashOn : flashOff).toArray(arr, i * 9 + 3);
				(lit ? flashOn : flashOff).toArray(arr, i * 9 + 6);
			});
			armLamps.instanceColor.needsUpdate = true;
		}
	}

	const report = `${crossings.length} level crossings, ${A.length} masts, ${gates.length} gates, `
		+ `${withLight.length} flasher pairs, ${bars.length} stop bars, ${rxrs.length} RXR; `
		+ `${stopCount} STOP (${plateCount} ALL WAY), ${yieldCount} YIELD`;
	;
	return {
		group,
		report,
		update,

		probe() {
			return crossings.map((c, i) => ({
				roads: c.roads.join(', ') || '?', gate: c.gate, light: c.light,
				routes: state[i].watch ? state[i].watch.routes : 0,
				eta: Number.isFinite(state[i].eta) ? +state[i].eta.toFixed(1) : null,
				lit: state[i].lit,
				eye: `${c.x.toFixed(0)},${(c.y + 12).toFixed(0)},${(c.z + 30).toFixed(0)}`,
			}));
		},
	};
}
