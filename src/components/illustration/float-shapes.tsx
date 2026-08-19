"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export type FloatShapesProps = {
  className?: string;
  /** Fewer shapes for a quieter hero (e.g. a card-sized empty state vs. the full dashboard hero). */
  count?: 3 | 4 | 5;
};

type ShapeSpec = {
  left: string;
  top: string;
  size: number;
  color: "primary" | "delta" | "warn";
  duration: number;
  depth: number;
  blob: string;
};

const SHAPES: ShapeSpec[] = [
  { left: "8%", top: "18%", size: 120, color: "primary", duration: 10, depth: 18, blob: "42% 58% 60% 40% / 50% 44% 56% 50%" },
  { left: "78%", top: "8%", size: 84, color: "delta", duration: 9, depth: 12, blob: "60% 40% 42% 58% / 46% 60% 40% 54%" },
  { left: "62%", top: "58%", size: 140, color: "primary", duration: 12, depth: 24, blob: "38% 62% 55% 45% / 55% 45% 55% 45%" },
  { left: "20%", top: "68%", size: 70, color: "warn", duration: 8, depth: 10, blob: "50% 50% 40% 60% / 60% 40% 60% 40%" },
  { left: "45%", top: "30%", size: 56, color: "delta", duration: 11, depth: 8, blob: "55% 45% 60% 40% / 40% 60% 40% 60%" },
];

const SHAPE_COLOR_VAR: Record<ShapeSpec["color"], string> = {
  primary: "var(--accent-primary-glow)",
  delta: "var(--accent-delta)",
  warn: "var(--accent-warn)",
};

/**
 * 3 to 5 soft, blob-shaped SVG-ish shapes (CSS border-radius blobs, no asset dependency) that float
 * gently (8 to 12s loops) with mild pointer parallax. Disabled entirely under reduced motion: the
 * shapes still render, just static, no listeners attached. Mount inside a `relative` ancestor
 * (Hero provides one); shapes are absolutely positioned and pointer-events-none.
 */
export function FloatShapes({ className, count = 5 }: FloatShapesProps) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 60, damping: 20 });
  const springY = useSpring(pointerY, { stiffness: 60, damping: 20 });

  useEffect(() => {
    if (reduced) return;
    const node = containerRef.current;
    if (!node) return;

    function handlePointerMove(event: PointerEvent) {
      const rect = node!.getBoundingClientRect();
      pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
      pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
    }

    node.addEventListener("pointermove", handlePointerMove);
    return () => node.removeEventListener("pointermove", handlePointerMove);
  }, [reduced, pointerX, pointerY]);

  const shapes = SHAPES.slice(0, count);

  return (
    <div ref={containerRef} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {shapes.map((shape, index) => (
        <FloatShape key={index} reduced={!!reduced} shape={shape} springX={springX} springY={springY} />
      ))}
    </div>
  );
}

function FloatShape({
  shape,
  reduced,
  springX,
  springY,
}: {
  shape: ShapeSpec;
  reduced: boolean;
  springX: ReturnType<typeof useMotionValue<number>>;
  springY: ReturnType<typeof useMotionValue<number>>;
}) {
  const parallaxX = useTransform(springX, (value) => value * shape.depth);
  const parallaxY = useTransform(springY, (value) => value * shape.depth);

  return (
    <motion.div
      animate={reduced ? undefined : { y: [0, -16, 0], x: [0, 10, 0] }}
      className="absolute opacity-60 blur-2xl"
      style={{
        left: shape.left,
        top: shape.top,
        width: shape.size,
        height: shape.size,
        background: SHAPE_COLOR_VAR[shape.color],
        borderRadius: shape.blob,
        x: reduced ? 0 : parallaxX,
        y: reduced ? 0 : parallaxY,
      }}
      transition={reduced ? undefined : { duration: shape.duration, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
