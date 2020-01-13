import * as THREE from 'three';
// import * as OBJLoader from "three/examples/jsm/loaders/OBJLoader";
// import * as MTLLoader from "three/examples/jsm/loaders/MTLLoader";

// THREE.OBJLoader = OBJLoader;
// THREE.MTLLoader = MTLLoader;

// remaps opacity from 0 to 1
const opacityRemap = mat => {
    if (mat.opacity === 0) {
        mat.opacity = 1;
    }
};

/**
 * The Reticle class creates an object that repeatedly calls
 * `xrSession.requestHitTest()` to render a ring along a found
 * horizontal surface.
 */
export class Reticle extends THREE.Object3D {
    constructor(camera) {
        super();
        this.name = 'Reticle';
        let geometry = new THREE.RingGeometry(0.1, 0.11, 24, 1);
        let material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
        });
        geometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90)));
        this.ring = new THREE.Mesh(geometry, material);
        this.add(this.ring);
        this.visible = false;
        this.camera = camera;
    }

    async update(session, frameOfRef) {
        this.raycaster = this.raycaster || new THREE.Raycaster();
        // console.log(this.raycaster, this.camera);

        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const ray = this.raycaster.ray;
        let xrray = new XRRay(ray.origin, ray.direction);
        let hits;
        try {
            hits = await session.requestHitTest(xrray, frameOfRef);
        } catch (error) {
            hits = [];
        }
        if (hits.length) {
            console.log('hits', hits);
            const hit = hits[0];
            const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);
            this.position.setFromMatrixPosition(hitMatrix);
            const targetPos = new THREE.Vector3().setFromMatrixPosition(this.camera.matrixWorld);
            const angle = Math.atan2(targetPos.x - this.position.x, targetPos.z - this.position.z);
            this.rotation.set(0, angle, 0);
            this.visible = true;
        }
    }
}

window.DemoUtils = {
    createLitScene() {
        const scene = new THREE.Scene();
        const light = new THREE.AmbientLight(0xffffff, 1);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
        directionalLight.position.set(10, 15, 10);
        directionalLight.castShadow = true;
        const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
        planeGeometry.rotateX(-Math.PI / 2);
        const shadowMesh = new THREE.Mesh(
            planeGeometry,
            new THREE.ShadowMaterial({
                color: 0x111111,
                opacity: 0.2,
            }),
        );
        shadowMesh.name = 'shadowMesh';
        shadowMesh.receiveShadow = true;
        shadowMesh.position.y = 10000;
        scene.add(shadowMesh);
        scene.add(light);
        scene.add(directionalLight);
        return scene;
    },
    createCubeScene() {
        const scene = new THREE.Scene();
        const materials = [
            new THREE.MeshBasicMaterial({ color: 0xff0000 }),
            new THREE.MeshBasicMaterial({ color: 0x0000ff }),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
            new THREE.MeshBasicMaterial({ color: 0xff00ff }),
            new THREE.MeshBasicMaterial({ color: 0x00ffff }),
            new THREE.MeshBasicMaterial({ color: 0xffff00 }),
        ];
        const ROW_COUNT = 4;
        const SPREAD = 1;
        const HALF = ROW_COUNT / 2;
        for (let i = 0; i < ROW_COUNT; i++) {
            for (let j = 0; j < ROW_COUNT; j++) {
                for (let k = 0; k < ROW_COUNT; k++) {
                    const box = new THREE.Mesh(new THREE.BoxBufferGeometry(0.2, 0.2, 0.2), materials);
                    box.position.set(i - HALF, j - HALF, k - HALF);
                    box.position.multiplyScalar(SPREAD);
                    scene.add(box);
                }
            }
        }
        return scene;
    },
    loadModel(objURL, mtlURL) {
        const objLoader = new THREE.OBJLoader();
        const mtlLoader = new THREE.MTLLoader();
        mtlLoader.setTexturePath(mtlURL.substr(0, mtlURL.lastIndexOf('/') + 1));
        mtlLoader.setMaterialOptions({ ignoreZeroRGBs: true });
        return new Promise((resolve, reject) => {
            mtlLoader.load(
                mtlURL,
                materialCreator => {
                    materialCreator.preload();
                    for (let material of Object.values(materialCreator.materials)) {
                        opacityRemap(material);
                    }
                    objLoader.setMaterials(materialCreator);
                    objLoader.load(objURL, resolve, function() {}, reject);
                },
                function() {},
                reject,
            );
        });
    },
    lookAtOnY(looker, target) {
        const targetPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);
        const angle = Math.atan2(targetPos.x - looker.position.x, targetPos.z - looker.position.z);
        looker.rotation.set(0, angle, 0);
    },
};
