"use client";

import { useEffect, useRef, useState } from "react";

const TRIGGER = "progsu";
/** `--accent-go`/`--accent-warn`'s RGB channels from src/styles/tokens.css, matched by hand since
 * canvas fillStyle needs a literal color, not a CSS custom property. This is the one sanctioned
 * easter egg, still the only splash of color a component outside the two-accents-per-view rule
 * gets away with, since it owns the whole screen for its duration. */
const ACCENT_COLORS = ["167, 139, 250", "255, 159, 46"]; // purple (accent-go), orange (accent-warn)

export function EasterEggListener() {
  const [rainId, setRainId] = useState<number | null>(null);
  const bufferRef = useRef("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) {
        return;
      }
      bufferRef.current = (bufferRef.current + event.key.toLowerCase()).slice(-TRIGGER.length);
      if (bufferRef.current === TRIGGER) {
        setRainId(Date.now());
        bufferRef.current = "";
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (rainId === null) {
    return null;
  }

  return <CapsuleRain key={rainId} onDone={() => setRainId(null)} />;
}

function CapsuleRain({ onDone }: { onDone: () => void }) {
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

    const DURATION_MS = 1600;
    const startedAt = performance.now();

    // Capsules rain from above the top edge rather than bursting outward from the center, per
    // the shared spec's "purple and orange capsules raining" easter egg. Each gets a random
    // spawn delay across the first half of the run so they don't all fall in one flat sheet.
    const particles = Array.from({ length: 42 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 2 + Math.random() * 2.5,
      width: 10 + Math.random() * 8,
      height: 5 + Math.random() * 3,
      rotation: (Math.random() - 0.5) * 0.6,
      color: ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
      spawnDelayMs: Math.random() * DURATION_MS * 0.5,
    }));

    let frameId: number;
    const timeout = setTimeout(onDone, DURATION_MS);

    function drawCapsule(x: number, y: number, width: number, height: number, rotation: number, rgb: string, alpha: number) {
      const ctx = context!;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
      const radius = height / 2;
      ctx.beginPath();
      ctx.moveTo(-width / 2 + radius, -radius);
      ctx.lineTo(width / 2 - radius, -radius);
      ctx.arc(width / 2 - radius, 0, radius, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-width / 2 + radius, radius);
      ctx.arc(-width / 2 + radius, 0, radius, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function tick(now: number) {
      const elapsed = now - startedAt;
      context!.clearRect(0, 0, canvas!.width, canvas!.height);
      const fadeStart = DURATION_MS * 0.7;
      for (const particle of particles) {
        const particleAge = elapsed - particle.spawnDelayMs;
        if (particleAge <= 0) {
          continue;
        }
        particle.x += particle.vx;
        particle.y += particle.vy;
        const alpha = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / (DURATION_MS - fadeStart)) : 1;
        if (alpha <= 0) {
          continue;
        }
        drawCapsule(particle.x, particle.y, particle.width, particle.height, particle.rotation, particle.color, alpha);
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
