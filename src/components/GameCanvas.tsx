import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Maximize, Minimize, Volume2, VolumeX } from "lucide-react";
import {
  clearProgress,
  createInitialState,
  explorationStats,
  formatClock,
  getObjectives,
  interact,
  isTrueEnding,
  journalRows,
  skipStory,
  startAttack,
  startIntro,
  startRoll,
  startShoot,
  stepGame,
  tabletCount,
  toggleJournal,
  advanceDialogue,
  advanceIntro,
  type JournalRow,
} from "@/game/engine";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/game/maps";
import { renderGame } from "@/game/renderer";
import { sfx } from "@/game/sound";
import type { GamePhase, GameState, InputState } from "@/game/types";
import { VirtualStick } from "@/components/VirtualStick";
import { StoryBackdrop } from "@/components/StoryBackdrop";

interface HudSnapshot {
  phase: GamePhase;
  roomName: string;
  hp: number;
  maxHp: number;
  coins: number;
  shards: number;
  dialogue: { speaker: string; text: string; hasMore: boolean } | null;
  banner: string | null;
  intro: {
    speaker: string;
    text: string;
    panel: number;
    totalPanels: number;
    hasMore: boolean;
    line: number;
    progress: number;
    mood: "night" | "dawn" | "dark";
  } | null;
  hasRoll: boolean;
  hasBow: boolean;
  /** 0 = ready, 1 = just used; rounded so the HUD does not re-render every frame. */
  rollCooldown: number;
  bowCooldown: number;
  objectiveMain: string;
  objectiveSide: string | null;
  /** Whole seconds of real play time. */
  playSeconds: number;
  exploration: { found: number; total: number; percent: number };
  tablets: { found: number; total: number };
  clearedAreas: { cleared: number; total: number };
  trueEnding: boolean;
  /** Present only while the travel journal is open. */
  journal: JournalRow[] | null;
}

const NO_INPUT: InputState = { up: false, down: false, left: false, right: false };

function readHud(state: GameState): HudSnapshot {
  const objectives = getObjectives(state);
  const story = state.intro?.story ?? [];
  const panel = story[state.intro?.panelIndex ?? 0];
  const introProgress = state.intro
    ? (state.intro.panelIndex + (state.intro.lineIndex / Math.max(1, panel?.lines.length ?? 1))) /
      Math.max(1, story.length)
    : 0;
  return {
    phase: state.phase,
    roomName: state.rooms[state.roomId].name,
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    coins: state.player.coins,
    shards: state.player.shards,
    dialogue: state.dialogue
      ? {
          speaker: state.dialogue.speaker,
          text: state.dialogue.lines[state.dialogue.index] ?? "",
          hasMore: state.dialogue.index + 1 < state.dialogue.lines.length,
        }
      : null,
    banner: state.banner ? state.banner.text : null,
    intro: state.intro
      ? {
          speaker: state.intro.story[state.intro.panelIndex]?.speaker ?? "",
          text: state.intro.story[state.intro.panelIndex]?.lines[state.intro.lineIndex] ?? "",
          line: state.intro.lineIndex,
          progress: introProgress,
          mood:
            state.intro.story[state.intro.panelIndex]?.mood ??
            (state.phase === "ending" ? "dawn" : "night"),
          panel: state.intro.panelIndex + 1,
          totalPanels: state.intro.story.length,
          hasMore:
            state.intro.lineIndex + 1 <
              (state.intro.story[state.intro.panelIndex]?.lines.length ?? 0) ||
            state.intro.panelIndex + 1 < state.intro.story.length,
        }
      : null,
    hasRoll: !!state.abilities.roll,
    hasBow: !!state.abilities.bow,
    rollCooldown: Math.round((state.player.rollCooldown / 0.7) * 20) / 20,
    bowCooldown: Math.round((state.player.bowCooldown / 0.45) * 20) / 20,
    objectiveMain: objectives.main,
    objectiveSide: objectives.side,
    playSeconds: Math.floor(state.playSeconds),
    exploration: explorationStats(state),
    tablets: tabletCount(state),
    clearedAreas: clearProgress(state),
    trueEnding: isTrueEnding(state),
    journal: state.journalOpen ? journalRows(state) : null,
  };
}

function HeartIcon({ fill }: { fill: "full" | "half" | "empty" }) {
  return (
    <svg viewBox="0 0 12 11" className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden="true">
      <path
        d="M2 0h3v1h2V0h3v1h1v1h1v3h-1v2h-1v1H9v1H8v1H7v1H5v-1H4V9H3V8H2V7H1V5H0V2h1V1h1V0z"
        className={fill === "empty" ? "fill-muted" : "fill-ruby"}
      />
      {fill === "half" && <rect x="6" y="0" width="6" height="11" className="fill-muted" />}
    </svg>
  );
}

/** Round skill button; a dark overlay drains as its cooldown recovers. */
function AbilityButton({
  label,
  ariaLabel,
  cooldown,
  onPress,
  className,
}: {
  label: string;
  ariaLabel: string;
  cooldown: number;
  onPress: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className={`dpad-btn pixel-btn relative flex h-14 w-14 flex-col items-center justify-center overflow-hidden rounded-full text-xs font-bold opacity-90 sm:h-16 sm:w-16 ${className}`}
    >
      <span className="relative z-10">{label}</span>
      {cooldown > 0 && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 bg-background/75"
          style={{ height: `${cooldown * 100}%` }}
        />
      )}
    </button>
  );
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState("title"));
  // Keyboard and on-screen stick are tracked separately and merged each frame,
  // so releasing one never cancels the other.
  const keysRef = useRef<InputState>({ ...NO_INPUT });
  const stickRef = useRef<InputState>({ ...NO_INPUT });
  const [hud, setHud] = useState<HudSnapshot>(() => readHud(stateRef.current));
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  // The objective line is folded away on phones so it never covers the game picture.
  const [goalOpen, setGoalOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 640,
  );

  const playSfx = useCallback((kind: Parameters<typeof sfx.play>[0]) => {
    sfx.play(kind);
  }, []);

  const syncHud = useCallback(() => {
    const next = readHud(stateRef.current);
    setHud((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  const handleStart = useCallback(() => {
    stateRef.current = createInitialState("intro");
    keysRef.current = { ...NO_INPUT };
    stickRef.current = { ...NO_INPUT };
    startIntro(stateRef.current, playSfx);
    syncHud();
  }, [playSfx, syncHud]);

  const handleAttack = useCallback(() => {
    startAttack(stateRef.current, playSfx);
    syncHud();
  }, [playSfx, syncHud]);

  const handleInteract = useCallback(() => {
    interact(stateRef.current, playSfx);
    syncHud();
  }, [playSfx, syncHud]);

  const handleRoll = useCallback(() => {
    startRoll(stateRef.current, playSfx);
    syncHud();
  }, [playSfx, syncHud]);

  const handleShoot = useCallback(() => {
    startShoot(stateRef.current, playSfx);
    syncHud();
  }, [playSfx, syncHud]);

  const handleAdvanceDialogue = useCallback(() => {
    advanceDialogue(stateRef.current, playSfx);
    syncHud();
  }, [playSfx, syncHud]);

  const handleAdvanceIntro = useCallback(() => {
    advanceIntro(stateRef.current, playSfx);
    syncHud();
  }, [playSfx, syncHud]);

  const handleSkipStory = useCallback(() => {
    skipStory(stateRef.current);
    syncHud();
  }, [syncHud]);

  const handleToggleJournal = useCallback(() => {
    toggleJournal(stateRef.current, playSfx);
    syncHud();
  }, [playSfx, syncHud]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      sfx.muted = next;
      return next;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    setCanFullscreen(typeof document !== "undefined" && document.fullscreenEnabled === true);
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        e.preventDefault();
      }
      if (key === "arrowup" || key === "w") keysRef.current.up = true;
      if (key === "arrowdown" || key === "s") keysRef.current.down = true;
      if (key === "arrowleft" || key === "a") keysRef.current.left = true;
      if (key === "arrowright" || key === "d") keysRef.current.right = true;

      const phase = stateRef.current.phase;
      if (key === "shift" && phase === "playing") {
        handleRoll();
        return;
      }
      if (key === "q" && phase === "playing") {
        handleShoot();
        return;
      }
      if ((key === "m" || key === "escape") && (phase === "playing")) {
        if (key === "m" || stateRef.current.journalOpen) handleToggleJournal();
        return;
      }
      if (
        key === " " ||
        key === "z" ||
        key === "j" ||
        key === "e" ||
        key === "x" ||
        key === "enter" ||
        key === "k"
      ) {
        if (phase === "title") handleStart();
        else if (phase === "intro" || phase === "ending") handleAdvanceIntro();
        else if (key === " " || key === "z" || key === "j") handleAttack();
        else handleInteract();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "arrowup" || key === "w") keysRef.current.up = false;
      if (key === "arrowdown" || key === "s") keysRef.current.down = false;
      if (key === "arrowleft" || key === "a") keysRef.current.left = false;
      if (key === "arrowright" || key === "d") keysRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    handleAttack,
    handleInteract,
    handleStart,
    handleAdvanceIntro,
    handleRoll,
    handleShoot,
    handleToggleJournal,
  ]);

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const k = keysRef.current;
      const s = stickRef.current;
      const input: InputState = {
        up: k.up || s.up,
        down: k.down || s.down,
        left: k.left || s.left,
        right: k.right || s.right,
      };
      stepGame(stateRef.current, input, dt, playSfx);
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) renderGame(ctx, stateRef.current);
      syncHud();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [playSfx, syncHud]);

  const totalHearts = Math.ceil(hud.maxHp / 2);
  const showControls = hud.phase === "playing" && !hud.dialogue;
  const isOverlayPhase =
    hud.phase === "title" || hud.phase === "gameover" || hud.phase === "victory";

  return (
    <main className="fixed inset-0 select-none touch-none overflow-hidden bg-background">
      {/* Game picture: fills the screen as large as possible without stretching the 15:11 pixels */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative overflow-hidden bg-card"
          style={{ width: "min(100vw, calc(100dvh * 15 / 11))", aspectRatio: "15 / 11" }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="pixel-canvas block h-full w-full"
          />

          {/* Area / chapter banner */}
          {hud.phase === "playing" && hud.banner && !hud.dialogue && (
            <div className="pointer-events-none absolute inset-x-4 top-14 flex justify-center sm:top-16">
              <div className="pixel-panel px-3 py-1.5 text-center text-xs text-foreground sm:text-sm">
                {hud.banner}
              </div>
            </div>
          )}

          {/* Dialogue: tap anywhere on the box to continue */}
          {hud.phase === "playing" && hud.dialogue && (
            <button
              type="button"
              onClick={handleAdvanceDialogue}
              className="pixel-panel absolute inset-x-3 bottom-3 block cursor-pointer p-3 text-left sm:inset-x-6 sm:bottom-5 sm:p-4"
            >
              <div className="mb-1 text-xs text-gold sm:text-sm">{hud.dialogue.speaker}</div>
              <p className="text-xs leading-relaxed text-foreground sm:text-sm">
                {hud.dialogue.text}
              </p>
              <div className="mt-1.5 text-right text-[11px] text-primary">
                {hud.dialogue.hasMore ? "▼ つぎへ" : "▼ とじる"}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Full-screen story: animated backdrop, the line of text, and a skip control */}
      {(hud.phase === "intro" || hud.phase === "ending") && hud.intro && (
        <div className="absolute inset-0 overflow-hidden bg-black">
          <StoryBackdrop
            scene={hud.phase === "ending" ? "ending" : "opening"}
            progress={hud.intro.progress}
            mood={hud.intro.mood}
          />
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/60 to-transparent" />
          <button
            type="button"
            onClick={handleAdvanceIntro}
            aria-label="次の文章へ"
            className="absolute inset-0 block cursor-pointer text-left"
          >
            <div className="mx-auto flex h-full max-w-2xl flex-col justify-end px-6 pb-12 sm:px-10 sm:pb-16">
              {hud.intro.speaker && (
                <div
                  className="mb-2 text-xs tracking-[0.3em] text-gold sm:text-sm"
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}
                >
                  {hud.intro.speaker}
                </div>
              )}
              <p
                key={`${hud.intro.panel}-${hud.intro.line}`}
                className="text-sm leading-loose text-foreground sm:text-xl"
                style={{
                  animation: "introFadeIn 0.9s ease-out",
                  textShadow: "0 2px 14px rgba(0,0,0,0.95)",
                }}
              >
                {hud.intro.text}
              </p>
              <div className="mt-5 flex items-center justify-between text-[11px] text-primary sm:text-xs">
                <span className="font-mono text-muted-foreground">
                  {hud.intro.panel} / {hud.intro.totalPanels}
                </span>
                <span>
                  {hud.intro.hasMore ? "▼ つぎへ" : hud.phase === "intro" ? "▼ はじまる" : "▼ おわる"}
                </span>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={handleSkipStory}
            className="pixel-panel absolute right-3 top-3 z-10 cursor-pointer rounded-sm px-2.5 py-1 text-xs text-foreground"
          >
            スキップ
          </button>
        </div>
      )}

      {/* Travel journal: progress per area and the lore stones read so far */}
      {hud.phase === "playing" && hud.journal && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 p-3 sm:p-6">
          <div className="pixel-panel flex max-h-full w-full max-w-xl flex-col gap-2 overflow-hidden p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-gold sm:text-base">旅の記録</h2>
              <span className="font-mono text-xs text-emerald">探索率 {hud.exploration.percent}%</span>
              <button
                type="button"
                onClick={handleToggleJournal}
                className="pixel-btn cursor-pointer rounded-sm bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
              >
                閉じる [M]
              </button>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
              <div className="h-full bg-emerald" style={{ width: `${hud.exploration.percent}%` }} />
            </div>
            <p className="font-mono text-[11px] text-muted-foreground sm:text-xs">
              旅の刻 {formatClock(hud.playSeconds)}　石板 {hud.tablets.found}/{hud.tablets.total}　場所{" "}
              {hud.clearedAreas.cleared}/{hud.clearedAreas.total}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {hud.journal.map((row) => {
                const counts = [
                  row.enemies.total > 0 && `敵 ${row.enemies.done}/${row.enemies.total}`,
                  row.chests.total > 0 && `宝 ${row.chests.done}/${row.chests.total}`,
                  row.talks.total > 0 && `話 ${row.talks.done}/${row.talks.total}`,
                  row.stones.total > 0 && `石 ${row.stones.done}/${row.stones.total}`,
                ]
                  .filter(Boolean)
                  .join("　");
                return (
                  <div key={row.id} className="border-b border-border/60 py-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                      <span className={row.cleared ? "text-emerald" : "text-foreground"}>
                        {row.cleared ? "✔ " : "・ "}
                        {row.name}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">{counts}</span>
                    </div>
                    {row.readStones.map((stone) => (
                      <p key={stone.title} className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="text-gold">「{stone.title}」</span> {stone.text}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isOverlayPhase && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-6 text-center">
          {hud.phase === "title" && (
            <>
              <p className="mb-1 text-xs tracking-widest text-gold sm:text-sm">
                2Dドット絵アクション冒険
              </p>
              <h1 className="text-3xl font-bold tracking-wider text-foreground sm:text-6xl">
                翠星の旅人 リオ
              </h1>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
                エルディア諸島の全ての場所を巡り、3つの「星のかけら」で翠光の塔へ。かけらが翠光を満たすまで、一時間の旅路だ。
              </p>
              <button
                type="button"
                onClick={handleStart}
                className="pixel-btn mt-6 cursor-pointer rounded-sm bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:brightness-110 sm:text-base"
              >
                ぼうけんをはじめる
              </button>
            </>
          )}
          {hud.phase === "gameover" && (
            <>
              <h2 className="text-2xl font-bold text-ruby sm:text-4xl">力尽きてしまった...</h2>
              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                ミドリ村から再び冒険へ出発しよう。
              </p>
              <button
                type="button"
                onClick={handleStart}
                className="pixel-btn mt-6 cursor-pointer rounded-sm bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground"
              >
                もういちど挑む
              </button>
            </>
          )}
          {hud.phase === "victory" && (
            <>
              <p className="text-xs tracking-widest text-gold sm:text-sm">ADVENTURE CLEAR</p>
              <h2 className="mt-1 text-2xl font-bold text-emerald sm:text-4xl">
                翠光の神殿に光が戻った！
              </h2>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-foreground sm:text-sm">
                リオは3つの星のかけらを取り戻し、エルディア諸島に平和が訪れた。
              </p>
              <p className="mt-2 font-mono text-xs text-gold sm:text-sm">
                集めた星貨: ● {hud.coins}
              </p>
              <p className="mt-1 font-mono text-xs text-emerald sm:text-sm">
                探索率 {hud.exploration.percent}%　石板 {hud.tablets.found}/{hud.tablets.total}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                旅の刻 {formatClock(hud.playSeconds)}
              </p>
              {hud.trueEnding && (
                <p className="mt-3 max-w-md text-xs leading-relaxed text-gold sm:text-sm">
                  真の結末に到達した。十一の石板を読み、父の想いを受け継いだ。
                </p>
              )}
              <button
                type="button"
                onClick={handleStart}
                className="pixel-btn mt-6 cursor-pointer rounded-sm bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground"
              >
                はじめから遊ぶ
              </button>
            </>
          )}
        </div>
      )}

      {/* HUD floating over the game */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className="pixel-panel flex max-w-[60vw] flex-col gap-0.5 rounded-sm px-2 py-1 text-xs opacity-90 sm:max-w-xs sm:px-2.5 sm:py-1.5 sm:text-sm">
          {/* One compact row: hearts, shards, coins and play time */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" aria-label={`体力 ${hud.hp}/${hud.maxHp}`}>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: totalHearts }).map((_, i) => {
                const hpForSlot = hud.hp - i * 2;
                const fill = hpForSlot >= 2 ? "full" : hpForSlot === 1 ? "half" : "empty";
                return <HeartIcon key={i} fill={fill} />;
              })}
              <span className="ml-1 font-mono text-[11px] sm:text-xs">
                {hud.hp}/{hud.maxHp}
              </span>
            </div>
            <span className="font-mono text-emerald" aria-label={`星のかけら ${hud.shards}/3`}>
              ★{hud.shards}/3
            </span>
            <span className="font-mono text-gold" aria-label={`星貨 ${hud.coins}`}>
              ●{hud.coins}
            </span>
            {hud.phase === "playing" && (
              <span className="font-mono text-[11px] text-muted-foreground" aria-label="旅の刻">
                {formatClock(hud.playSeconds)}
              </span>
            )}
          </div>

          {/* Objective: a single line that folds open and closed */}
          {hud.phase === "playing" && (
            <>
              <button
                type="button"
                onClick={() => setGoalOpen((open) => !open)}
                aria-expanded={goalOpen}
                className="pointer-events-auto cursor-pointer truncate text-left text-[11px] leading-snug text-gold"
              >
                {goalOpen ? "▾" : "▸"} 目的{goalOpen ? "" : "（開く）"}
              </button>
              {goalOpen && (
                <div className="border-t border-border/60 pt-0.5 text-[11px] leading-snug">
                  <p className="text-gold">{hud.objectiveMain}</p>
                  {hud.objectiveSide && <p className="text-muted-foreground">{hud.objectiveSide}</p>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="pixel-panel rounded-sm px-2.5 py-1 text-xs text-foreground sm:text-sm">
            {hud.roomName}
          </span>
          {hud.phase === "playing" && (
            <button
              type="button"
              onClick={handleToggleJournal}
              aria-label="旅の記録を開く"
              className="pointer-events-auto pixel-panel inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm text-foreground"
            >
              <BookOpen className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "効果音をオン" : "効果音をミュート"}
            className="pointer-events-auto pixel-panel inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm text-foreground"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          {canFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "全画面を解除" : "全画面にする"}
              className="pointer-events-auto pixel-panel inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm text-foreground"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          )}
        </div>
      </header>

      {/* On-screen controls floating over the game */}
      {showControls && (
        <>
          <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
            <VirtualStick onChange={(dir) => (stickRef.current = dir)} />
          </div>
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
            {(hud.hasBow || hud.hasRoll) && (
              <div className="flex items-center gap-3">
                {hud.hasBow && (
                  <AbilityButton
                    label="矢"
                    ariaLabel="星の矢を放つ"
                    cooldown={hud.bowCooldown}
                    onPress={handleShoot}
                    className="bg-secondary text-secondary-foreground"
                  />
                )}
                {hud.hasRoll && (
                  <AbilityButton
                    label="回避"
                    ariaLabel="風のブーツで回避"
                    cooldown={hud.rollCooldown}
                    onPress={handleRoll}
                    className="bg-secondary text-secondary-foreground"
                  />
                )}
              </div>
            )}
            <div className="flex items-end gap-3">
              <button
                type="button"
                aria-label="調べる・話す"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleInteract();
                }}
                className="dpad-btn pixel-btn flex h-14 w-14 flex-col items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground opacity-90 sm:h-16 sm:w-16"
              >
                調べる
              </button>
              <button
                type="button"
                aria-label="剣で攻撃"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleAttack();
                }}
                className="dpad-btn pixel-btn flex h-20 w-20 flex-col items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground opacity-90 sm:h-24 sm:w-24"
              >
                攻撃
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
