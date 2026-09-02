import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildParts } from "../lib/zavri/mesh";
import { partsToGroup } from "../lib/zavri/adapterFactory";
import { ZAVRI_BY_ID } from "../lib/zavri/catalog";
import type { ThreeLike } from "../lib/zavri/adapterFactory";

type Props = {
  speciesId: string;
  seed?: number;
  hunger?: number;
  happiness?: number;
  size?: number;
  interactive?: boolean;
  onPet?: () => void;
  eatTick?: number;
};

export function ZavriCanvas({ speciesId, seed = 0, hunger = 100, happiness = 100, size = 180, interactive, onPet, eatTick }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const eatTickRef = useRef<number>(eatTick ?? 0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const def = ZAVRI_BY_ID.get(speciesId);
    if (!def) return;

    const w = size, h = size;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-3, 1.5, -2);
    scene.add(rim);

    // ground shadow in card (light)
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: hunger < 30 ? 0.12 : 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.98;
    scene.add(shadow);

    const THREE_ANY = THREE as unknown as ThreeLike;
    const group = partsToGroup(THREE_ANY, buildParts(def, seed)) as unknown as THREE.Group;
    group.rotation.y = -0.35;
    // hunger tint: desaturate when hungry
    if (hunger < 35) {
      group.traverse((o: unknown) => {
        const m = o as { material?: { color?: { setHSL: (h: number, s: number, l: number) => void; getHSL: (t: { h: number; s: number; l: number }) => void } } };
        if (m.material?.color) {
          try {
            const c = m.material.color as unknown as THREE.Color;
            const hsl: { h: number; s: number; l: number } = { h: 0, s: 0, l: 0 };
            c.getHSL(hsl);
            c.setHSL(hsl.h, hsl.s * 0.45, hsl.l * 0.95);
          } catch {}
        }
      });
    }
    scene.add(group);
    groupRef.current = group;
    (group as unknown as { userData: Record<string, unknown> }).userData = { zavriId: seed };

    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    cam.position.set(0, 0.28, 5.2);
    cam.lookAt(0, -0.2, 0);

    let raf = 0;
    let t = 0;
    let paused = false;
    const io = new IntersectionObserver(
      (entries) => {
        paused = !entries[0]?.isIntersecting;
      },
      { threshold: 0.05 },
    );
    io.observe(el);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (paused) return;
      if (document.visibilityState !== "visible") return;
      t += 0.016;
      group.position.y = Math.sin(t * 0.9) * 0.05;
      group.rotation.y = -0.35 + Math.sin(t * 0.35) * 0.18;
      // happiness bob speed
      if (happiness > 70) group.position.y += Math.sin(t * 1.8) * 0.015;
      renderer.render(scene, cam);
    };
    tick();

    const onResize = () => {
      // size fixed, no-op
    };

    const handleClick = (e: MouseEvent) => {
      if (!interactive || !onPet) return;
      // squash + hearts
      import("gsap").then(({ default: gsap }) => {
        gsap.to(group.scale, { x: 1.18, y: 0.82, z: 1.18, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" });
        gsap.to(group.position, { y: 0.18, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" });
        // hearts overlay via DOM
        for (let i = 0; i < 3; i++) {
          const d = document.createElement("div");
          d.textContent = "♥";
          d.style.position = "absolute";
          d.style.left = `${50 + (Math.random() * 30 - 15)}%`;
          d.style.top = "62%";
          d.style.color = "#ff5a8a";
          d.style.fontSize = "14px";
          d.style.pointerEvents = "none";
          d.style.filter = "drop-shadow(0 1px 3px rgba(0,0,0,0.4))";
          el.appendChild(d);
          gsap.to(d, { y: -42 - Math.random() * 18, x: (Math.random() - 0.5) * 24, opacity: 0, scale: 1.35, duration: 0.85, ease: "power2.out", onComplete: () => d.remove() });
        }
      });
      onPet();
    };
    if (interactive && onPet) el.addEventListener("click", handleClick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      if (interactive && onPet) el.removeEventListener("click", handleClick);
      try {
        el.removeChild(renderer.domElement);
      } catch {}
      renderer.dispose();
    };
  }, [speciesId, seed, size, hunger, happiness, interactive, onPet]);

  useEffect(() => {
    if (eatTick == null || eatTick === eatTickRef.current) return;
    eatTickRef.current = eatTick;
    const g = groupRef.current;
    const el = wrapRef.current;
    if (!g || !el) return;
    import("gsap").then(({ default: gsap }) => {
      gsap.killTweensOf(g.scale); gsap.killTweensOf(g.position);
      const tl = gsap.timeline();
      tl.to(g.scale, { x: 1.1, y: 1.18, z: 1.1, duration: 0.14, ease: "power2.out" })
        .to(g.scale, { x: 1, y: 1, z: 1, duration: 0.22, ease: "back.out(1.4)" });
      for (let i = 0; i < 3; i++) {
        const d = document.createElement("div");
        d.textContent = "●"; d.style.position = "absolute"; d.style.left = "50%"; d.style.top = "38%"; d.style.color = "#ffcc66"; d.style.fontSize = "10px"; d.style.pointerEvents = "none";
        el.appendChild(d);
        gsap.to(d, { y: -16, x: (Math.random() - 0.5) * 28, opacity: 0, duration: 0.4, delay: i * 0.07, ease: "power2.out", onComplete: () => d.remove() });
      }
    });
  }, [eatTick]);

  return (
    <div
      ref={wrapRef}
      style={{ width: size, height: size, position: "relative", cursor: interactive ? "pointer" : undefined, userSelect: "none", overflow: "hidden", borderRadius: 12 }}
      title={interactive ? "Гладить" : undefined}
      aria-label={interactive ? "Гладить завра" : undefined}
    />
  );
}
