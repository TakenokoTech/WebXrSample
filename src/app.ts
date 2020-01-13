import 'material-design-lite/dist/material.min.css';
import 'three/build/three.min';
import * as THREE from 'three';
import { Reticle } from './utils';

const MODEL_OBJ_URL = '../assets/ArcticFox_Posed.obj';
const MODEL_MTL_URL = '../assets/ArcticFox_Posed.mtl';
const MODEL_SCALE = 0.1;

class App {
    constructor() {
        this.onXRFrame = this.onXRFrame.bind(this);
        this.onEnterAR = this.onEnterAR.bind(this);

        this.init();
    }

    async init() {
        console.log('init');
        if (navigator.xr && XRSession.prototype.requestHitTestSource) {
            console.log('navigator.xr && XRSession.prototype.requestHitTestSource ok');
            navigator.xr.isSessionSupported('immersive-ar').then(
                () => {
                    console.log('supportsSession immersive-ar ok');
                },
                () => {
                    this.onNoXRDevice();
                },
            );
        } else {
            this.onNoXRDevice();
            return;
        }
        document.querySelector('#enter-ar').addEventListener('click', this.onEnterAR);
    }

    async onEnterAR() {
        console.log('onEnterAR');
        const outputCanvas = document.createElement('canvas');
        navigator.xr
            .requestSession('immersive-ar')
            .then(xrSession => {
                this.session = xrSession;
                console.log('requestSession immersive-ar ok');
                xrSession.addEventListener('end', this.onXRSessionEnded.bind(this));
                document.body.appendChild(outputCanvas);
                this.onSessionStarted();
            })
            .catch(error => {
                console.warn('requestSession immersive-ar error: ', error);
                this.onNoXRDevice();
            });
    }

    onXRSessionEnded = () => {
        console.log('onXRSessionEnded');
        document.body.classList.remove('ar');
        document.body.classList.remove('stabilized');
        if (this.renderer) {
            this.renderer.vr.setSession(null);
            this.stabilized = false;
        }
    };

    onNoXRDevice() {
        console.log('onNoXRDevice');
        document.body.classList.add('unsupported');
    }

    async onSessionStarted() {
        console.log('onSessionStarted');
        document.body.classList.add('ar');
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
        });
        this.renderer.autoClear = false;
        this.gl = this.renderer.getContext();
        this.renderer.vr.enabled = true;
        this.XRReferenceSpaceType = 'local';
        this.renderer.vr.setReferenceSpaceType(this.XRReferenceSpaceType);
        this.renderer.vr.setSession(this.session);
        this.session.baseLayer = new XRWebGLLayer(this.session, this.gl);
        this.scene = new THREE.Scene();
        const geometry = new THREE.BoxBufferGeometry(0.1, 0.2, 0.3);
        const material = new THREE.MeshNormalMaterial();
        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.25, 0));
        this.model = new THREE.Mesh(geometry, material);
        this.camera = new THREE.PerspectiveCamera();
        this.camera.matrixAutoUpdate = false;
        this.reticle = new Reticle(this.camera);
        this.scene.add(this.reticle);
        this.frameOfRef = await this.session.requestReferenceSpace('local');
        this.tick();
    }

    tick = () => {
        // console.log('tick');
        this.rafId = this.session.requestAnimationFrame(this.onXRFrame);
    };

    onXRFrame(time, frame) {
        console.log('onXRFrame');
        const { session } = frame;
        const pose = 'getDevicePose' in frame ? frame.getDevicePose(this.frameOfRef) : frame.getViewerPose(this.frameOfRef);
        this.tick();
        if (pose == null) {
            return;
        }
        for (const view of frame.getViewerPose(this.frameOfRef).views) {
            console.log('view', view);
            const viewport = session.renderState.baseLayer.getViewport(view);
            this.renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
            this.camera.projectionMatrix.fromArray(view.projectionMatrix);
            const viewMatrix = new THREE.Matrix4().fromArray(view.transform.inverse.matrix);
            this.camera.matrix.getInverse(viewMatrix);
            this.camera.updateMatrixWorld(true);
            this.reticle.update(this.session, this.frameOfRef);
            this.processXRInput(frame);
            this.renderer.render(this.scene, this.camera);
        }
        if (this.reticle.visible && !this.stabilized) {
            this.stabilized = true;
            document.body.classList.add('stabilized');
        }
    }

    processXRInput(frame) {
        console.log('processXRInput');
        const { session } = frame;
        const sources = Array.from(session.inputSources).filter(input => input.targetRayMode === 'screen');
        if (sources.length === 0) {
            return;
        }
        const pose = frame.getPose(sources[0].targetRaySpace, this.frameOfRef);
        if (pose) {
            this.placeModel();
        }
    }

    async placeModel() {
        console.debug('placeModel');
        const x = 0;
        const y = 0;
        if (this.session == null) {
            return;
        }
        this.raycaster = this.raycaster || new THREE.Raycaster();
        this.raycaster.setFromCamera({ x, y }, this.camera);
        const ray = this.raycaster.ray;
        let xrray = new XRRay(ray.origin, ray.direction);
        let hits;
        try {
            hits = await this.session.requestHitTest(xrray, this.frameOfRef);
        } catch (e) {
            console.log(e);
        }
        if (hits && hits.length) {
            const presentedScene = this.scene;
            const hit = hits[0];
            const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);
            this.model.position.setFromMatrixPosition(hitMatrix);
            this.scene.add(this.model);
            const camPosition = new THREE.Vector3().setFromMatrixPosition(this.camera.matrix);
            this.model.lookAt(camPosition.x, this.model.position.y, camPosition.z);
            if (presentedScene.pivot) {
                this.model.rotateY(-presentedScene.pivot.rotation.y);
            }
        }
    }
}

window.app = new App();
