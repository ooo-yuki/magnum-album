import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { buildParts } from "../lib/zavri/mesh";
import { partsToGroup } from "../lib/zavri/adapterFactory";
import { ZAVRI_BY_ID } from "../lib/zavri/catalog";
import type { ThreeLike } from "../lib/zavri/adapterFactory";

type ZavriItem = { id: number; speciesId: string; hunger: number; happiness: number; ascension: number };

type Props = {
  items: ZavriItem[];
  eatId?: number | null;
  breedPair?: [number, number] | null;
  onPet?: (id: number) => void;
  onPick?: (id: number) => void;
};

export function ZavriTerrarium({ items, eatId, breedPair, onPet, onPick }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<Map<number, THREE.Group>>(new Map());
  const eatIdRef = useRef<number | null>(null);
  const breedPairRef = useRef<[number, number] | null>(null);

  useEffect(() => { eatIdRef.current = eatId ?? null; }, [eatId]);
  useEffect(() => { breedPairRef.current = breedPair ?? null; }, [breedPair]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (!items.length) return;

    const w = el.clientWidth, h = 320;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setClearColor(0x0f1220, 0.0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0f1220, 8, 18);
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(4, 6, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fb4ff, 0.45); rim.position.set(-4, 3, -4); scene.add(rim);

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 7),
      new THREE.MeshStandardMaterial({ color: 0x1a1d2e, roughness: 0.92 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.05;
    scene.add(ground);
    const grid = new THREE.GridHelper(12, 12, 0x2a2f45, 0x1e2235);
    (grid.position as THREE.Vector3).y = -1.045;
    scene.add(grid);

    const THREE_ANY = THREE as unknown as ThreeLike;
    const groups = new Map<number, THREE.Group>();
    const states = new Map<number, { x: number; z: number; tx: number; tz: number; speed: number; phase: number }>();

    // place завры
    items.forEach((it, i) => {
      const def = ZAVRI_BY_ID.get(it.speciesId);
      if (!def) return;
      const g = partsToGroup(THREE_ANY, buildParts(def, it.id)) as unknown as THREE.Group;
      // hunger tint
      if (it.hunger < 35) {
        g.traverse((o: unknown) => {
          const m = o as { material?: { color?: THREE.Color } };
          if (m.material?.color) { try { const c = m.material.color as THREE.Color; const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s * 0.5, hsl.l); } catch {} }
        });
      }
      const ang = (i / Math.max(1, items.length)) * Math.PI * 2;
      const r = 1.2 + (i % 3) * 0.6;
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r * 0.6;
      g.position.set(x, 0, z);
      g.rotation.y = ang + Math.PI;
      scene.add(g);
      groups.set(it.id, g);
      states.set(it.id, { x, z, tx: x + (Math.random() - 0.5) * 2, tz: z + (Math.random() - 0.5) * 1.2, speed: 0.008 + Math.random() * 0.012, phase: Math.random() * Math.PI * 2 });
    });
    groupsRef.current = groups;

    const cam = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
    cam.position.set(0, 3.2, 7.5);
    cam.lookAt(0, -0.4, 0);

    // raycaster for picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cam);
      const intersects = raycaster.intersectObjects([...groups.values()], true);
      if (intersects.length) {
        let obj: THREE.Object3D | null = intersects[0]!.object;
        while (obj && !groupsRef.current.has((obj as unknown as { userData?: { zavriId?: number } }).userData?.zavriId ?? -1) && obj.parent) obj = obj.parent;
        // fallback: find nearest group by distance to intersect point
        let best: number | null = null, bestD = Infinity;
        const pt = intersects[0]!.point;
        for (const [id, g] of groups) {
          const d = g.position.distanceTo(pt);
          if (d < bestD) { bestD = d; best = id; }
        }
        if (best != null) {
          // pet anim
          const g = groups.get(best)!;
          gsap.to(g.scale, { x: 1.18, y: 0.82, z: 1.18, duration: 0.14, yoyo: true, repeat: 1, ease: "power2.out" });
          onPet?.(best);
          onPick?.(best);
        }
      }
    };
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.style.cursor = "pointer";

    // walking + bobbing loop
    let raf = 0, t = 0;
    let paused = false;
    const io = new IntersectionObserver((entries) => { paused = !entries[0]?.isIntersecting; }, { threshold: 0.05 });
    io.observe(el);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (paused || document.visibilityState !== "visible") return;
      t += 0.016;
      for (const [id, g] of groups) {
        const st = states.get(id)!;
        // breed jumps override walk
        const isBreeding = breedPairRef.current && (breedPairRef.current[0] === id || breedPairRef.current[1] === id);
        if (!isBreeding) {
          // walk to target
          const dx = st.tx - st.x, dz = st.tz - st.z;
          const len = Math.hypot(dx, dz);
          if (len < 0.12) {
            st.tx = (Math.random() - 0.5) * 8;
            st.tz = (Math.random() - 0.5) * 4.2;
            st.speed = 0.008 + Math.random() * 0.012;
          } else {
            st.x += (dx / len) * st.speed;
            st.z += (dz / len) * st.speed;
            g.position.x = st.x;
            g.position.z = st.z;
            g.rotation.y = Math.atan2(dx, dz) + Math.PI;
          }
          // bob + leg waddle
          g.position.y = Math.sin(t * 2.2 + st.phase) * 0.06 + Math.abs(Math.sin(t * 4 + st.phase)) * 0.04;
        }
        // happiness tail wag via scale x
        const it = items.find((x) => x.id === id);
        if (it && it.happiness > 72) g.rotation.z = Math.sin(t * 3 + st.phase) * 0.04;
        else g.rotation.z *= 0.96;
      }
      renderer.render(scene, cam);
    };
    tick();

    const onResize = () => {
      const nw = el.clientWidth;
      renderer.setSize(nw, 320);
      cam.aspect = nw / 320;
      cam.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      try { el.removeChild(renderer.domElement); } catch {}
      renderer.dispose();
    };
  }, [items, onPet, onPick]);

  // eat anim trigger
  useEffect(() => {
    if (eatId == null) return;
    const g = groupsRef.current.get(eatId);
    if (!g) return;
    gsap.killTweensOf(g.scale);
    gsap.killTweensOf(g.position);
    const tl = gsap.timeline();
    tl.to(g.scale, { x: 1.12, y: 1.18, z: 1.12, duration: 0.14, ease: "power2.out" })
      .to(g.scale, { x: 0.96, y: 0.96, z: 0.96, duration: 0.12, ease: "power2.inOut" })
      .to(g.scale, { x: 1, y: 1, z: 1, duration: 0.18, ease: "back.out(1.4)" });
    tl.to(g.position, { y: 0.28, duration: 0.14, ease: "power2.out" }, 0);
    tl.to(g.position, { y: 0, duration: 0.3, ease: "bounce.out" }, 0.14);
    // food bits
    const el = wrapRef.current;
    if (el) {
      for (let i = 0; i < 4; i++) {
        const d = document.createElement("div");
        d.textContent = "●";
        d.style.position = "absolute";
        d.style.left = "50%"; d.style.top = "38%";
        d.style.color = "#ffcc66"; d.style.fontSize = "10px"; d.style.pointerEvents = "none";
        el.appendChild(d);
        gsap.to(d, { x: (Math.random() - 0.5) * 80, y: -18 - Math.random() * 18, opacity: 0, duration: 0.45, delay: i * 0.06, ease: "power2.out", onComplete: () => d.remove() });
      }
    }
  }, [eatId]);

  // breed jumps
  useEffect(() => {
    if (!breedPair) return;
    const [a, b] = breedPair;
    const ga = groupsRef.current.get(a), gb = groupsRef.current.get(b);
    if (!ga || !gb) return;
    const tl = gsap.timeline();
    [ga, gb].forEach((g, idx) => {
      tl.to(g.position, { y: 0.9, duration: 0.22, ease: "power2.out" }, idx * 0.08)
        .to(g.position, { y: 0, duration: 0.28, ease: "bounce.out" }, idx * 0.08 + 0.22)
        .to(g.position, { y: 0.7, duration: 0.2, ease: "power2.out" }, 0.5 + idx * 0.06)
        .to(g.position, { y: 0, duration: 0.3, ease: "bounce.out" }, 0.7 + idx * 0.06);
    });
    // hearts between
    const el = wrapRef.current;
    if (el) {
      for (let i = 0; i < 5; i++) {
        const d = document.createElement("div");
        d.textContent = "♥";
        d.style.position = "absolute"; d.style.left = "50%"; d.style.top = "42%"; d.style.color = "#ff5a8a"; d.style.fontSize = "16px"; d.style.pointerEvents = "none";
        el.appendChild(d);
        gsap.to(d, { y: -48 - Math.random() * 24, x: (Math.random() - 0.5) * 48, opacity: 0, scale: 1.4, duration: 0.9, delay: 0.4 + i * 0.07, ease: "power2.out", onComplete: () => d.remove() });
      }
    }
  }, [breedPair]);

  if (!items.length) return <div style={{ padding: 18, textAlign: "center", color: "rgba(255,255,255,0.6)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 14 }}>Террариум пуст — выбей завров в баннере выше</div>;

  return <div ref={wrapRef} style={{ width: "100%", height: 320, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "radial-gradient(900px 360px at 50% 0%, rgba(96,165,250,0.08), transparent 62%), linear-gradient(180deg, rgba(18,18,22,0.96), rgba(12,12,16,0.98))", position: "relative" }} aria-label="Террариум завров — ходят, кликни чтобы погладить" />;
}
