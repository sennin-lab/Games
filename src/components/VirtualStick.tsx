import { useRef, useState, type PointerEvent } from "react";
import type { InputState } from "@/game/types";

const STICK_RADIUS = 44; // how far the knob can travel (px)
const DEADZONE = 10; // ignore tiny movements around the centre (px)

const NEUTRAL: InputState = { up: false, down: false, left: false, right: false };

interface VirtualStickProps {
  /** Receives the current direction whenever the thumb moves or lets go. */
  onChange: (input: InputState) => void;
  className?: string;
}

/**
 * On-screen analog-style stick for touch devices (also usable with a mouse).
 * The knob follows the pointer while it is held; the game only receives
 * the four directions, so diagonals come from combining two of them.
 */
export function VirtualStick({ onChange, className = "" }: VirtualStickProps) {
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (e: PointerEvent<HTMLDivElement>) => {
    const origin = originRef.current;
    if (!origin) return;
    let dx = e.clientX - origin.x;
    let dy = e.clientY - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > STICK_RADIUS) {
      dx = (dx / dist) * STICK_RADIUS;
      dy = (dy / dist) * STICK_RADIUS;
    }
    setKnob({ x: dx, y: dy });
    onChange({
      left: dx < -DEADZONE,
      right: dx > DEADZONE,
      up: dy < -DEADZONE,
      down: dy > DEADZONE,
    });
  };

  const release = () => {
    originRef.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(NEUTRAL);
  };

  return (
    <div
      role="application"
      aria-label="移動スティック"
      className={`relative h-32 w-32 touch-none select-none rounded-full border-2 border-border/80 bg-card/45 backdrop-blur-sm sm:h-36 sm:w-36 ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        update(e);
      }}
      onPointerMove={(e) => {
        if (originRef.current) update(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {/* Guide cross */}
      <div className="pointer-events-none absolute left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-foreground/15" />
      <div className="pointer-events-none absolute top-1/2 left-3 right-3 h-px -translate-y-1/2 bg-foreground/15" />
      {/* Knob */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 rounded-full border-2 border-foreground/60 bg-secondary shadow-lg sm:h-16 sm:w-16"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          transition: originRef.current ? "none" : "transform 0.12s ease-out",
        }}
      />
    </div>
  );
}
