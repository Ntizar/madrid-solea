import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

export function Intro() {
  const ref = useRef<HTMLDivElement>(null);
  const setIntroDone = useAppStore((s) => s.setIntroDone);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0E1B2C');
    scene.fog = new THREE.Fog('#0E1B2C', 18, 60);

    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 200);
    camera.position.set(12, 9, 18);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    // Suelo
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: '#F5EFE4', roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // "Maqueta abstracta" de Madrid: bloques irregulares
    const blockMat = new THREE.MeshStandardMaterial({ color: '#C97A2B', roughness: 0.6, metalness: 0.05 });
    const blocks: THREE.Mesh[] = [];
    const rng = mulberry32(7);
    for (let i = 0; i < 36; i++) {
      const w = 1 + rng() * 2.4;
      const d = 1 + rng() * 2.4;
      const h = 0.8 + rng() * rng() * 6.5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), blockMat.clone());
      m.castShadow = true; m.receiveShadow = true;
      const r = 4 + rng() * 9;
      const a = rng() * Math.PI * 2;
      m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      m.rotation.y = rng() * Math.PI;
      (m.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color('#E8A951'), rng() * 0.3);
      scene.add(m); blocks.push(m);
    }

    // Sol
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 32, 32),
      new THREE.MeshBasicMaterial({ color: '#FBE3A8' })
    );
    scene.add(sun);
    const sunLight = new THREE.DirectionalLight('#FFE2A8', 2.4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 25;
    sunLight.shadow.camera.bottom = -25;
    scene.add(sunLight);

    const ambient = new THREE.HemisphereLight('#a9c8e8', '#3a2516', 0.45);
    scene.add(ambient);

    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      // Sol orbitando: arco amanecer→mediodía→atardecer, acelerado
      const ang = -0.3 + t * 0.5;
      const R = 22;
      sun.position.set(Math.cos(ang) * R, 4 + Math.sin(ang) * 12, Math.sin(ang) * R * 0.4);
      sunLight.position.copy(sun.position);
      // tono cielo según altura del sol
      const sunY = sun.position.y / 18;
      const k = Math.max(0, Math.min(1, sunY));
      const sky = new THREE.Color().lerpColors(new THREE.Color('#3A1E2C'), new THREE.Color('#9CB6CC'), k);
      scene.background = sky;
      scene.fog!.color.copy(sky);
      // micro-rotación cámara
      camera.position.x = 12 + Math.sin(t * 0.2) * 0.6;
      camera.position.y = 9 + Math.cos(t * 0.15) * 0.3;
      camera.lookAt(0, 1.5, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-50 bg-night-700"
    >
      <div ref={ref} className="absolute inset-0" />
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-16 px-6 text-center pointer-events-none">
        <motion.p
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-sun-300 uppercase tracking-[0.4em] text-xs"
        >Madrid · Tiempo real</motion.p>
        <motion.h1
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7, duration: 0.9 }}
          className="font-display text-5xl sm:text-7xl text-paper mt-3 leading-none"
        >Solea</motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.1 }}
          className="text-paper/80 mt-4 max-w-md font-display text-lg sm:text-xl italic"
        >La terraza con sol, ahora mismo.</motion.p>
        <motion.button
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.5 }}
          onClick={() => setIntroDone(true)}
          className="pointer-events-auto mt-8 rounded-full bg-sun-300 text-night-900 font-medium px-8 py-3 shadow-glow hover:bg-sun-100 transition"
        >Buscar mi caña al sol →</motion.button>
        <p className="text-paper/40 text-xs mt-6">Datos: Ayuntamiento de Madrid · OpenStreetMap · SunCalc</p>
      </div>
    </motion.div>
  );
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
