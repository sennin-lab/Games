import { useEffect, useRef } from "react";
import { drawCinematic, type CinematicScene } from "@/game/cinematic";

interface StoryBackdropProps {
  scene: CinematicScene;
  /** 0 at the start of the story, 1 at its last line. */
  progress: number;
  mood: "night" | "dawn" | "dark";
}

const MOOD_TINT: Record<StoryBackdropProps["mood"], string> = {
  night: "rgba(4, 6, 16, 0.35)",
  dark: "rgba(0, 0, 0, 0.5)",
  dawn: "rgba(10, 8, 6, 0.12)",
};

/**
 * Full-screen animated backdrop for the opening and ending. The scene is drawn at a small
 * fixed resolution and scaled up with pixelated rendering, so it matches the game's pixel art.
 */
export function StoryBackdrop({ scene, progress, mood }: StoryBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) drawCinematic(ctx, scene, (now - start) / 1000, progressRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scene]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={320}
        height={180}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated", objectFit: "cover" }}
      />
      <div className="absolute inset-0" style={{ background: MOOD_TINT[mood] }} />
    </>
  );
}
