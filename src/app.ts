import 'material-design-lite/dist/material.min.css';
import 'three/build/three.min';

const MODEL_OBJ_URL = '../assets/ArcticFox_Posed.obj';
const MODEL_MTL_URL = '../assets/ArcticFox_Posed.mtl';
const MODEL_SCALE = 0.1;

class App {
    constructor() {
        this.onXRFrame = this.onXRFrame.bind(this);
        this.onEnterAR = this.onEnterAR.bind(this);
        this.onClick = this.onClick.bind(this);

        this.init();
    }

    async init() {
        if (navigator.xr && XRSession.prototype.requestHitTest) {
            try {
                this.device = navigator.xr; //await navigator.xr.requestDevice();
            } catch (e) {
                console.log(navigator.xr);
                console.log(e);
                // this.onNoXRDevice();
                // return;
            }
        } else {
            console.log(navigator.xr);
            console.log(XRSession.prototype.requestHitTest);
            this.onNoXRDevice();
            return;
        }
        document.querySelector('#enter-ar').addEventListener('click', this.onEnterAR);
    }

    async onEnterAR() {
        const outputCanvas = document.createElement('canvas');
        const ctx = outputCanvas.getContext('xrpresent');

        try {
            const session = await this.device.requestSession({
                outputContext: ctx,
                environmentIntegration: true,
            });

            document.body.appendChild(outputCanvas);
            this.onSessionStarted(session);
        } catch (e) {
            console.log(e);
            this.onNoXRDevice();
        }
    }

    onNoXRDevice() {
        document.body.classList.add('unsupported');
    }

    async onSessionStarted(session) {
        this.session = session;
        document.body.classList.add('ar');
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
        });
        this.renderer.autoClear = false;

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.gl = this.renderer.getContext();

        await this.gl.setCompatibleXRDevice(this.session.device);

        this.session.baseLayer = new XRWebGLLayer(this.session, this.gl);

        const framebuffer = this.session.baseLayer.framebuffer;
        this.renderer.setFramebuffer(framebuffer);

        this.scene = DemoUtils.createLitScene();

        DemoUtils.loadModel(MODEL_OBJ_URL, MODEL_MTL_URL).then(model => {
            this.model = model;
            this.model.children.forEach(mesh => (mesh.castShadow = true));
            this.model.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
        });

        this.camera = new THREE.PerspectiveCamera();
        this.camera.matrixAutoUpdate = false;

        this.reticle = new Reticle(this.session, this.camera);
        this.scene.add(this.reticle);

        this.frameOfRef = await this.session.requestFrameOfReference('eye-level');
        this.session.requestAnimationFrame(this.onXRFrame);

        window.addEventListener('click', this.onClick);
    }

    onXRFrame(time, frame) {
        let session = frame.session;
        let pose = frame.getDevicePose(this.frameOfRef);

        this.reticle.update(this.frameOfRef);

        if (this.reticle.visible && !this.stabilized) {
            this.stabilized = true;
            document.body.classList.add('stabilized');
        }

        session.requestAnimationFrame(this.onXRFrame);

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.session.baseLayer.framebuffer);

        if (pose) {
            for (let view of frame.views) {
                const viewport = session.baseLayer.getViewport(view);
                this.renderer.setSize(viewport.width, viewport.height);

                this.camera.projectionMatrix.fromArray(view.projectionMatrix);
                const viewMatrix = new THREE.Matrix4().fromArray(pose.getViewMatrix(view));
                this.camera.matrix.getInverse(viewMatrix);
                this.camera.updateMatrixWorld(true);

                this.renderer.render(this.scene, this.camera);
            }
        }
    }

    async onClick(e) {
        if (!this.model) {
            return;
        }

        const x = 0;
        const y = 0;

        this.raycaster = this.raycaster || new THREE.Raycaster();
        this.raycaster.setFromCamera({ x, y }, this.camera);
        const ray = this.raycaster.ray;

        const origin = new Float32Array(ray.origin.toArray());
        const direction = new Float32Array(ray.direction.toArray());
        const hits = await this.session.requestHitTest(origin, direction, this.frameOfRef);

        if (hits.length) {
            const hit = hits[0];
            const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);
            this.model.position.setFromMatrixPosition(hitMatrix);
            DemoUtils.lookAtOnY(this.model, this.camera);

            const shadowMesh = this.scene.children.find(c => c.name === 'shadowMesh');
            shadowMesh.position.y = this.model.position.y;

            this.scene.add(this.model);
        }
    }
}

window.app = new App();
