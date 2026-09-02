

import * as THREE from 'three';

const JITTER_N = 256;

export class JitterMeter {
	constructor(n = JITTER_N) {
		this.n = n;

		this.heave = new Float32Array(n);

		this.pitch = new Float32Array(n);
		this.yaw = new Float32Array(n);
		this.at = 0;
		this.filled = 0;
		this.prevVy = 0;
		this.prevYaw = 0;
		this._axis = new THREE.Vector3();
		this._quat = new THREE.Quaternion();
	}

	reset() {
		this.heave.fill(0);
		this.pitch.fill(0);
		this.yaw.fill(0);
		this.at = 0;
		this.filled = 0;
		this.prevVy = 0;
		this.prevYaw = 0;
	}

	sample(vehicle, dt) {
		if (!vehicle || !vehicle.chassis) return;

		const vy = vehicle.chassis.linvel().y;
		this.heave[this.at] = (vy - this.prevVy) / dt / 9.81;
		this.prevVy = vy;

		const av = vehicle.chassis.angvel();
		const r = vehicle.chassis.rotation();
		this._quat.set(r.x, r.y, r.z, r.w);
		this._axis.set(1, 0, 0).applyQuaternion(this._quat);
		const rate = av.x * this._axis.x + av.y * this._axis.y + av.z * this._axis.z;
		this.pitch[this.at] = rate * 180 / Math.PI;

		const yaw = av.y * 180 / Math.PI;
		this.yaw[this.at] = (yaw - this.prevYaw) / dt;
		this.prevYaw = yaw;

		this.at = (this.at + 1) % this.n;
		if (this.filled < this.n) this.filled++;
	}

	axisReport(buf, rate, label, unit) {
		let mean = 0;
		for (let i = 0; i < this.n; i++) mean += buf[i];
		mean /= this.n;
		let rms = 0;
		for (let i = 0; i < this.n; i++) {
			const v = buf[i] - mean;
			rms += v * v;
		}
		rms = Math.sqrt(rms / this.n);

		const bins = 40;
		let peakHz = 0, peakP = 0;
		for (let b = 0; b < bins; b++) {
			const hz = 0.8 + (60.0 - 0.8) * (b / (bins - 1));
			const w = 2 * Math.PI * hz / rate;
			let re = 0, im = 0;
			for (let i = 0; i < this.n; i++) {
				const v = buf[(this.at + i) % this.n] - mean;
				re += v * Math.cos(w * i);
				im += v * Math.sin(w * i);
			}
			const pw = re * re + im * im;
			if (pw > peakP) { peakP = pw; peakHz = hz; }
		}
		return `${label} ${rms.toFixed(3)}${unit} @ ${peakHz.toFixed(1)}Hz`;
	}

	report(vehicle, rate) {
		if (this.filled < this.n) return '';

		let contact = 0;
		if (vehicle && vehicle.controller) {
			for (let i = 0; i < 4; i++) {
				if (vehicle.controller.wheelIsInContact(i)) contact++;
			}
		}
		return `${this.axisReport(this.heave, rate, 'heave', 'g')}  ·  `
			+ `${this.axisReport(this.pitch, rate, 'pitch', '°/s')}  ·  `
			+ `${this.axisReport(this.yaw, rate, 'yaw', '°/s²')}  ·  wheels down ${contact}/4`;
	}
}
