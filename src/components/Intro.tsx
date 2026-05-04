import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

/**
 * Skyline real de Madrid (mirando desde el sur, hacia el norte):
 *  - Sierra de Guadarrama nevada al fondo
 *  - Centro: Torre Picasso (157m), Torre Europa (121m), Torre BBVA (107m)
 *  - Puerta de Europa: 2 KIO Towers inclinadas 15°
 *  - Derecha: Cuatro Torres (Caja Madrid, PWC, Cristal, Espacio) ~250m
 *  - Tejados bajos en primer plano
 *  - Sol orbitando con sombras suaves
 */

interface Block {
  x: number; z: number;     // posición plano horizontal (m, escala arbitraria)
  w: number; d: number;     // dimensiones base
  h: number;                // altura
  color: string;            // color base
  tilt?: number;            // grados (KIO)
  tiltAxis?: 'x' | 'z';
  emissiveGrid?: boolean;   // para Torre Picasso (rejilla)
}

const SKYLINE: Block[] = [
  // === Sierra de Guadarrama (back, 4 cumbres) ===
  // Las renderizo con conos achatados separados.

  // === Cuatro Torres (extremo derecho, las más altas) ===
  { x:  18, z: -2, w: 4.5, d: 4.5, h: 28, color: '#9bb1c7' }, // Torre de Cristal (más alta)
  { x:  24, z: -1, w: 4,   d: 4,   h: 26, color: '#7c92a8' }, // Torre Espacio
  { x:  13, z: -2, w: 4,   d: 4,   h: 25, color: '#6b8197' }, // Torre PWC
  { x:   8, z: -1, w: 3.8, d: 3.8, h: 24, color: '#8aa1b7' }, // Torre Caja Madrid

  // === Puerta de Europa (KIO Towers) — inclinadas 15° hacia adentro ===
  { x: -4.8, z:  2, w: 3.2, d: 3.2, h: 16, color: '#3a4a5e', tilt: -15, tiltAxis: 'z' },
  { x:  4.8, z:  2, w: 3.2, d: 3.2, h: 16, color: '#3a4a5e', tilt:  15, tiltAxis: 'z' },

  // === Centro AZCA: Torre Picasso, Europa, BBVA ===
  { x:  -8, z:  3, w: 2.6, d: 2.6, h: 18, color: '#f0eada', emissiveGrid: true }, // Picasso
  { x: -12, z:  4, w: 2.2, d: 2.2, h: 14, color: '#1a2230' }, // Europa (oscura)
  { x: -14, z:  5, w: 2,   d: 2,   h: 12, color: '#2a3340' }, // BBVA

  // === Tejados bajos / casco urbano (primer plano y dispersos) ===
];

// Genera tejados aleatorios pero deterministas en primer plano
function urbanFloor(rng: () => number): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < 90; i++) {
    const x = -28 + rng() * 56;
    const z = 8 + rng() * 14;
    const w = 0.8 + rng() * 1.6;
    const d = 0.8 + rng() * 1.6;
    const h = 1.2 + rng() * 3.2;
    const palette = ['#e7c89a', '#d4a274', '#c97a2b', '#b25e2a', '#dcb78a', '#8a6b4a'];
    const color = palette[Math.floor(rng() * palette.length)];
    out.push({ x, z, w, d, h, color });
  }
  return out;
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

export function Intro({ onDone }: { onDone?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const setIntroDone = useAppStore((s) => s.setIntroDone);

  const finish = () => {
    onDone?.();
    setIntroDone(true);
  };

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0E1B2C');
    scene.fog = new THREE.Fog('#0E1B2C', 35, 95);

    const camera = new THREE.PerspectiveCamera(38, el.clientWidth / el.clientHeight, 0.1, 300);
    camera.position.set(0, 14, 50);
    camera.lookAt(0, 8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    // Suelo (calle)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ color: '#d8c8b1', roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // === SIERRA DE GUADARRAMA al fondo ===
    const sierra = new THREE.Group();
    sierra.position.set(0, 0, -55);
    const peakColor = new THREE.Color('#a8b9cc');
    const snowColor = new THREE.Color('#f5f7fa');
    const peaks = [
      { x: -38, h: 16, w: 22 }, { x: -18, h: 19, w: 20 },
      { x:  -2, h: 14, w: 18 }, { x:  14, h: 17, w: 22 },
      { x:  34, h: 15, w: 20 }
    ];
    for (const p of peaks) {
      const geom = new THREE.ConeGeometry(p.w / 2, p.h, 32, 1, false);
      const mat = new THREE.MeshStandardMaterial({
        color: peakColor, roughness: 0.95,
        emissive: snowColor, emissiveIntensity: 0.15
      });
      const m = new THREE.Mesh(geom, mat);
      m.position.set(p.x, p.h / 2, 0);
      // tapa de nieve: cono pequeño blanco arriba
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(p.w / 4.5, p.h / 3, 24),
        new THREE.MeshStandardMaterial({ color: snowColor, roughness: 0.9 })
      );
      cap.position.set(0, p.h / 3, 0);
      m.add(cap);
      sierra.add(m);
    }
    scene.add(sierra);

    // === SKYLINE específico ===
    const blocks = [...SKYLINE, ...urbanFloor(mulberry32(7))];
    const meshes: THREE.Mesh[] = [];

    for (const b of blocks) {
      const geom = new THREE.BoxGeometry(b.w, b.h, b.d);
      let mat: THREE.MeshStandardMaterial;
      if (b.emissiveGrid) {
        // Torre Picasso: textura procedural de ventanas
        const tex = makeWindowTex(b.h);
        mat = new THREE.MeshStandardMaterial({
          color: b.color, roughness: 0.4, metalness: 0.1,
          map: tex
        });
      } else if (b.h > 10) {
        // Rascacielos: cristal
        mat = new THREE.MeshStandardMaterial({
          color: b.color, roughness: 0.25, metalness: 0.6,
          envMapIntensity: 1
        });
      } else {
        mat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85 });
      }
      const m = new THREE.Mesh(geom, mat);
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(b.x, b.h / 2, b.z);
      if (b.tilt && b.tiltAxis) {
        const rad = (b.tilt * Math.PI) / 180;
        if (b.tiltAxis === 'z') m.rotation.z = rad;
        else m.rotation.x = rad;
        // recolocar para que la base siga apoyada
        m.position.y = (b.h / 2) * Math.cos(rad);
      }
      scene.add(m);
      meshes.push(m);
    }

    // Sol
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 32, 32),
      new THREE.MeshBasicMaterial({ color: '#FBE3A8' })
    );
    scene.add(sun);
    const sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 32, 32),
      new THREE.MeshBasicMaterial({ color: '#E8A951', transparent: true, opacity: 0.25 })
    );
    scene.add(sunHalo);

    const sunLight = new THREE.DirectionalLight('#FFE2A8', 2.6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -10;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const ambient = new THREE.HemisphereLight('#bfd6ee', '#3a2516', 0.5);
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

      // Sol orbitando: amanece por el este (derecha), se pone al oeste
      const ang = -1.3 + t * 0.32; // -1.3 → noche, 0 → mediodía, 1.3 → atardecer
      const R = 50;
      sun.position.set(-Math.sin(ang) * R, Math.max(-2, Math.cos(ang) * 35), -10);
      sunHalo.position.copy(sun.position);
      sunLight.position.copy(sun.position);

      // tono cielo según altura del sol
      const sunY = Math.max(0, sun.position.y) / 35;
      const k = Math.min(1, sunY);
      const dawn = new THREE.Color('#3A1E2C');
      const noon = new THREE.Color('#bfd3de');
      const dusk = new THREE.Color('#E8A951');
      // mezclar dawn-noon-dusk según ángulo
      const ph = (Math.sin(ang) + 1) / 2; // 0..1 (0 izquierda/oeste, 1 derecha/este)
      const horizon = ph < 0.5 ? dusk : dawn;
      const sky = new THREE.Color().lerpColors(horizon, noon, k);
      scene.background = sky;
      scene.fog!.color.copy(sky);
      sunLight.intensity = 0.4 + 2.4 * k;

      // micro-rotación cámara (parallax suave)
      camera.position.x = Math.sin(t * 0.18) * 2.4;
      camera.position.y = 14 + Math.cos(t * 0.12) * 0.6;
      camera.lookAt(0, 9, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-50 bg-night-700"
    >
      <div ref={ref} className="absolute inset-0" />
      {/* Vignette inferior para dar peso al texto */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none bg-gradient-to-t from-night-900/70 via-night-900/20 to-transparent" />
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 sm:pb-16 px-6 text-center pointer-events-none">
        <motion.p
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-sun-300 uppercase tracking-[0.4em] text-[10px] sm:text-xs"
        >Madrid · Tiempo real</motion.p>
        <motion.h1
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7, duration: 0.9 }}
          className="font-display font-extrabold text-6xl sm:text-8xl text-paper mt-3 leading-none tracking-tight"
        >SolMAD</motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.1 }}
          className="text-paper/85 mt-4 max-w-md font-display text-base sm:text-xl italic"
        >La terraza con sol, ahora mismo.</motion.p>
        <motion.button
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.5 }}
          onClick={finish}
          className="pointer-events-auto mt-7 sm:mt-8 rounded-full bg-sun-300 text-night-900 font-medium px-7 sm:px-9 py-3.5 shadow-glow hover:bg-sun-100 active:scale-95 transition text-sm sm:text-base"
        >Buscar mi caña al sol →</motion.button>
        <p className="text-paper/40 text-[10px] sm:text-xs mt-5 sm:mt-6 px-4">Datos: Ayuntamiento de Madrid · OpenStreetMap · SunCalc</p>
      </div>
      <button
        onClick={finish}
        className="absolute top-4 right-4 text-paper/50 hover:text-paper text-xs uppercase tracking-widest pointer-events-auto"
        aria-label="Saltar intro"
      >Saltar →</button>
    </motion.div>
  );
}

// Textura procedural de ventanas para Torre Picasso (rejilla blanca con celdas oscuras)
function makeWindowTex(_h: number): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f0eada';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#3a4250';
  const cols = 6, rows = 32;
  const cw = c.width / cols, ch = c.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillRect(col * cw + 2, r * ch + 2, cw - 4, ch - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}
