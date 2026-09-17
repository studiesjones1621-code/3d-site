/**
 * The Pure Raw jar as real geometry, so it can turn a full 360 degrees.
 * Profile is lathed from the proportions of the product shot; the printed
 * mark is the one lifted off the photograph.
 */
import * as THREE from './three.module.min.js';
import { RoomEnvironment } from './RoomEnvironment.js';

const JAR_PROFILE = [
    [0.00, -2.10], [0.60, -2.10], [0.80, -2.05], [0.88, -1.95],
    [0.90, -1.70], [0.90, 1.44], [0.89, 1.60], [0.84, 1.74],
    [0.76, 1.85], [0.74, 1.92]
];

export async function createJar3D(container, opts = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.0, 8.9);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xffffff, 3.1);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 2.0);
    rim.position.set(4, 2, -3);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const jar = new THREE.Group();
    scene.add(jar);

    /* glass shell */
    const points = JAR_PROFILE.map(p => new THREE.Vector2(p[0], p[1]));
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1,
        thickness: 0.35, ior: 1.5, transparent: true, side: THREE.DoubleSide,
        envMapIntensity: 1.7, clearcoat: 0.6, clearcoatRoughness: 0.05
    });
    const glass = new THREE.Mesh(new THREE.LatheGeometry(points, 96), glassMat);
    jar.add(glass);

    /* juice */
    const juicePoints = JAR_PROFILE
        .filter(p => p[1] <= 1.30)
        .map(p => new THREE.Vector2(Math.max(0, p[0] * 0.965), p[1] + 0.03));
    juicePoints.push(new THREE.Vector2(0.868, 1.30), new THREE.Vector2(0, 1.30));
    const juiceMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(opts.juice || '#173d10'),
        roughness: 0.22, metalness: 0, envMapIntensity: 0.5,
        emissive: new THREE.Color(opts.glow || opts.juice || '#3b7a27'),
        emissiveIntensity: 0.34
    });
    jar.add(new THREE.Mesh(new THREE.LatheGeometry(juicePoints, 96), juiceMat));

    /* lid */
    const lidMat = new THREE.MeshPhysicalMaterial({ color: 0xfcfbf7, roughness: 0.33, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.2 });
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.80, 0.80, 0.34, 96, 1, false), lidMat);
    lid.position.y = 2.06;
    jar.add(lid);
    const lidTop = new THREE.Mesh(new THREE.CircleGeometry(0.80, 96), lidMat);
    lidTop.rotation.x = -Math.PI / 2;
    lidTop.position.y = 2.23;
    jar.add(lidTop);

    /* printed mark, wrapped on the glass */
    const label = await new Promise(resolve => {
        new THREE.TextureLoader().load(opts.label || 'assets/label.png', tex => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            tex.repeat.set(3, 1);          /* the art covers a third of the circumference */
            tex.offset.set(-1.25, 0);      /* and sits on the face pointing at the camera */
            resolve(tex);
        }, undefined, () => resolve(null));
    });
    if (label) {
        const printMat = new THREE.MeshBasicMaterial({
            map: label, transparent: true, side: THREE.FrontSide, depthWrite: false, opacity: 1
        });
        const print = new THREE.Mesh(new THREE.CylinderGeometry(0.914, 0.914, 1.46, 96, 1, true), printMat);
        print.position.y = 0.20;
        jar.add(print);
    }

    function resize() {
        const w = container.clientWidth || 340, h = container.clientHeight || 600;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    let yaw = 0, pitch = 0, disposed = false;
    function frame() {
        if (disposed) return;
        jar.rotation.y = yaw;
        jar.rotation.x = pitch;
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
    }
    frame();

    return {
        setView(yawDeg, pitchDeg) {
            yaw = yawDeg * Math.PI / 180;
            pitch = pitchDeg * Math.PI / 180;
        },
        setJuice(hex, glow) { juiceMat.color.set(hex); juiceMat.emissive.set(glow || hex); },
        dispose() { disposed = true; renderer.dispose(); container.removeChild(renderer.domElement); }
    };
}
