

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export function newGLTFLoader() {
	return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
