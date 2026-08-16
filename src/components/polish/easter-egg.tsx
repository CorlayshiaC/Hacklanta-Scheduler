"use client";

import { useEffect, useRef, useState } from "react";

const TRIGGER = "progsu";
/** rgb(139, 92, 246) is --purple-500 from src/styles/tokens.css, the one splash of color this
 * component is allowed (the shared spec's single sanctioned easter egg). */
const PURPLE_RGB = "139, 92, 246";

export function EasterEggListener() {
  const [burstId, setBurstId] = useState<number | null>(null);
  const bufferRef = useRef("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) {
        return;
      }
      bufferRef.current = (bufferRef.current + event.key.toLowerCase()).slice(-TRIGGER.length);
      if (bufferRef.current === TRIGGER) {
        setBurstId(Date.now());
        bufferRef.current = "";
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (burstId === null) {
    return null;
  }

  return <ParticleBurst key={burstId} onDone={() => setBurstId(null)} />;
}

function ParticleBurst({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      const timeout = setTimeout(onDone, 400);
      return () => clearTimeout(timeout);
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      onDone();
      return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 48 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      return {
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
      };
    });

    let frameId: number;
    const timeout = setTimeout(onDone, 1200);

    function tick() {
      context!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.05;
        particle.life -= 0.015;
        if (particle.life <= 0) {
          continue;
        }
        context!.fillStyle = `rgba(${PURPLE_RGB}, ${particle.life})`;
        context!.beginPath();
        context!.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
        context!.fill();
      }
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frameId);
    };
  }, [onDone]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100]" />;
}
