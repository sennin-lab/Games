import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAP_COLS,
  MAP_ROWS,
  TILE_SIZE,
  createInitialRooms,
  isSolidTile,
} from "./maps";
import type { SfxKind } from "./sound";
import type {
  AbilityId,
  Direction,
  EnemyState,
  GamePhase,
  GameState,
  InputState,
  NpcState,
  RoomId,
} from "./types";
import { OPENING_STORY, ROOM_STORY_EVENTS, buildEndingStory } from "./types";

const PLAYER_SPEED = 78;
const ROLL_SPEED = 170;
const ROLL_TIME = 0.2;
const ROLL_COOLDOWN = 0.7;
const BOW_COOLDOWN = 0.45;
const ARROW_SPEED = 220;
const ARROW_LIFE = 1.0;
const PLAYER_HITBOX = { ox: 3, oy: 6, w: 10, h: 9 };

/** Message shown when an NPC teaches Rio an ability. */
export const ABILITY_NOTES: Record<AbilityId, string> = {
  roll: "『風のブーツ』を授かった！ Shift（または回避ボタン）で素早く転がり、攻撃をかわせる。",
  bow: "『翠光の弓』を授かった！ Q（または矢ボタン）で星の矢を放てる。ひび割れた岩も砕ける。",
};

export type SoundCallback = (sfx: SfxKind) => void;

export function createInitialState(phase: GamePhase = "title"): GameState {
  return {
    phase,
    roomId: "village",
    rooms: createInitialRooms(),
    player: {
      x: 7 * TILE_SIZE,
      y: 6 * TILE_SIZE,
      dir: "down",
      hp: 6,
      maxHp: 6,
      coins: 0,
      shards: 0,
      walkTimer: 0,
      attackTimer: 0,
      attackCooldown: 0,
      invulnTimer: 0,
      knockVx: 0,
      knockVy: 0,
      rollTimer: 0,
      rollVx: 0,
      rollVy: 0,
      rollCooldown: 0,
      bowCooldown: 0,
    },
    particles: [],
    dialogue: null,
    banner: phase === "playing" ? { text: "始まりの村・ミドリ", timer: 2.2 } : null,
    shrineUnlocked: false,
    bossDefeated: false,
    bossTalked: false,
    time: 0,
    nextEntityId: 1,
    intro:
      phase === "intro" ? { story: OPENING_STORY, panelIndex: 0, lineIndex: 0, fade: 0 } : null,
    seenRooms: {},
    flags: {},
    abilities: {},
    arrows: [],
  };
}

export function startIntro(state: GameState, playSfx?: SoundCallback) {
  state.phase = "intro";
  state.intro = { story: OPENING_STORY, panelIndex: 0, lineIndex: 0, fade: 0 };
  playSfx?.("talk");
}

function startEnding(state: GameState, playSfx?: SoundCallback) {
  state.phase = "ending";
  state.intro = { story: buildEndingStory(state.flags), panelIndex: 0, lineIndex: 0, fade: 0 };
  playSfx?.("unlock");
}

export function advanceIntro(state: GameState, playSfx?: SoundCallback): boolean {
  if (!state.intro) return false;
  const { story, panelIndex, lineIndex } = state.intro;
  const panel = story[panelIndex];
  if (!panel) return false;

  if (lineIndex + 1 < panel.lines.length) {
    state.intro.lineIndex = lineIndex + 1;
    playSfx?.("talk");
    return true;
  }

  if (panelIndex + 1 < story.length) {
    state.intro.panelIndex = panelIndex + 1;
    state.intro.lineIndex = 0;
    state.intro.fade = 0;
    playSfx?.("unlock");
    return true;
  }

  // Story finished
  if (state.phase === "ending") {
    state.phase = "victory";
    state.intro = null;
    playSfx?.("victory");
    return false;
  }
  // Opening finished — transition to playing
  state.phase = "playing";
  state.intro = null;
  state.banner = { text: "始まりの村・ミドリ", timer: 2.2 };
  playSfx?.("pickup");
  return false;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function spawnBurst(state: GameState, x: number, y: number, color: string, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (i % 2) * 0.25;
    const speed = 28 + (i % 3) * 18;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35,
      maxLife: 0.35,
      color,
      size: i % 2 === 0 ? 3 : 2,
    });
  }
}

function setFlag(state: GameState, name: string) {
  state.flags[name] = true;
}

function dirVector(dir: Direction): { x: number; y: number } {
  if (dir === "left") return { x: -1, y: 0 };
  if (dir === "right") return { x: 1, y: 0 };
  if (dir === "up") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function isBlockedAt(state: GameState, x: number, y: number, w: number, h: number): boolean {
  const room = state.rooms[state.roomId];
  const left = Math.floor(x / TILE_SIZE);
  const right = Math.floor((x + w - 0.01) / TILE_SIZE);
  const top = Math.floor(y / TILE_SIZE);
  const bottom = Math.floor((y + h - 0.01) / TILE_SIZE);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (tx < 0 || tx >= MAP_COLS || ty < 0 || ty >= MAP_ROWS) continue;
      const tile = room.tiles[ty]?.[tx];
      if (tile && isSolidTile(tile)) return true;
    }
  }

  for (const chest of room.chests) {
    if (rectsOverlap(x, y, w, h, chest.tx * TILE_SIZE + 2, chest.ty * TILE_SIZE + 4, 12, 10)) {
      return true;
    }
  }
  for (const npc of room.npcs) {
    if (rectsOverlap(x, y, w, h, npc.tx * TILE_SIZE + 3, npc.ty * TILE_SIZE + 4, 10, 10)) {
      return true;
    }
  }
  return false;
}

export function unlockShrineIfReady(state: GameState, playSfx?: SoundCallback) {
  if (state.shrineUnlocked || state.player.shards < 2) return;
  state.shrineUnlocked = true;
  const shrine = state.rooms.shrine;
  for (let ty = 0; ty < shrine.tiles.length; ty++) {
    const row = shrine.tiles[ty];
    if (!row) continue;
    for (let tx = 0; tx < row.length; tx++) {
      if (row[tx] === "gate") {
        row[tx] = "floor";
      }
    }
  }
  state.banner = { text: "翠光の神殿の封印が解かれた！", timer: 3.0 };
  playSfx?.("unlock");
}

export function getSwordHitbox(state: GameState): { x: number; y: number; w: number; h: number } {
  const p = state.player;
  if (p.dir === "down") return { x: p.x + 1, y: p.y + 14, w: 14, h: 14 };
  if (p.dir === "up") return { x: p.x + 1, y: p.y - 12, w: 14, h: 14 };
  if (p.dir === "left") return { x: p.x - 12, y: p.y + 1, w: 14, h: 14 };
  return { x: p.x + 14, y: p.y + 1, w: 14, h: 14 };
}

/** Breaks a cracked rock opened by a star arrow, revealing whatever is behind it. */
function breakCrack(state: GameState, tx: number, ty: number, playSfx?: SoundCallback) {
  const room = state.rooms[state.roomId];
  const row = room.tiles[ty];
  if (!row || row[tx] !== "crack") return;
  row[tx] = "floor";
  spawnBurst(state, tx * TILE_SIZE + 8, ty * TILE_SIZE + 8, "#c9cfdc", 12);
  state.banner = { text: "ひび割れた岩が砕けた！", timer: 2.0 };
  playSfx?.("unlock");
}

export function startAttack(state: GameState, playSfx?: SoundCallback) {
  if (state.phase !== "playing") return;
  if (state.dialogue) {
    advanceDialogue(state, playSfx);
    return;
  }
  if (state.player.attackCooldown > 0) return;

  state.player.attackTimer = 0.18;
  state.player.attackCooldown = 0.28;
  playSfx?.("slash");

  const box = getSwordHitbox(state);
  const room = state.rooms[state.roomId];

  // Cut bushes inside sword hitbox; the sword clinks off cracked rock
  const minTx = Math.max(0, Math.floor(box.x / TILE_SIZE));
  const maxTx = Math.min(MAP_COLS - 1, Math.floor((box.x + box.w) / TILE_SIZE));
  const minTy = Math.max(0, Math.floor(box.y / TILE_SIZE));
  const maxTy = Math.min(MAP_ROWS - 1, Math.floor((box.y + box.h) / TILE_SIZE));

  for (let ty = minTy; ty <= maxTy; ty++) {
    const row = room.tiles[ty];
    if (!row) continue;
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (row[tx] === "crack") {
        spawnBurst(state, tx * TILE_SIZE + 8, ty * TILE_SIZE + 8, "#9aa3b8", 3);
      }
      if (row[tx] === "bush") {
        row[tx] = "grass";
        spawnBurst(state, tx * TILE_SIZE + 8, ty * TILE_SIZE + 8, "#55a85e", 6);
        const roll = (tx * 13 + ty * 7 + state.nextEntityId) % 5;
        if (roll === 0) {
          room.drops.push({
            id: `drop-${state.nextEntityId++}`,
            kind: "heart",
            x: tx * TILE_SIZE + 2,
            y: ty * TILE_SIZE + 2,
            bobPhase: 0,
          });
        } else if (roll === 1 || roll === 2) {
          room.drops.push({
            id: `drop-${state.nextEntityId++}`,
            kind: "coin",
            x: tx * TILE_SIZE + 2,
            y: ty * TILE_SIZE + 2,
            bobPhase: 0,
          });
        }
      }
    }
  }

  // Hit enemies
  for (const enemy of room.enemies) {
    if (!enemy.alive || enemy.hitTimer > 0) continue;
    if (rectsOverlap(box.x, box.y, box.w, box.h, enemy.x, enemy.y, enemy.size, enemy.size)) {
      damageEnemy(state, enemy, 1, playSfx);
    }
  }
}

/** Dodge roll with the wind boots: short burst in the facing direction, briefly invulnerable. */
export function startRoll(state: GameState, playSfx?: SoundCallback) {
  if (state.phase !== "playing" || state.dialogue) return;
  if (!state.abilities.roll) return;
  const p = state.player;
  if (p.rollCooldown > 0 || p.rollTimer > 0) return;
  const v = dirVector(p.dir);
  p.rollVx = v.x * ROLL_SPEED;
  p.rollVy = v.y * ROLL_SPEED;
  p.rollTimer = ROLL_TIME;
  p.rollCooldown = ROLL_COOLDOWN;
  p.invulnTimer = Math.max(p.invulnTimer, ROLL_TIME + 0.05);
  p.attackTimer = 0;
  spawnBurst(state, p.x + 8, p.y + 8, "#c9f3ff", 6);
  playSfx?.("pickup");
}

/** Fires a star arrow in the facing direction. Arrows break cracked rock. */
export function startShoot(state: GameState, playSfx?: SoundCallback) {
  if (state.phase !== "playing" || state.dialogue) return;
  if (!state.abilities.bow) return;
  const p = state.player;
  if (p.bowCooldown > 0 || p.rollTimer > 0) return;
  const v = dirVector(p.dir);
  p.bowCooldown = BOW_COOLDOWN;
  state.arrows.push({
    id: `arrow-${state.nextEntityId++}`,
    x: p.x + 8 + v.x * 6,
    y: p.y + 8 + v.y * 6,
    vx: v.x * ARROW_SPEED,
    vy: v.y * ARROW_SPEED,
    life: ARROW_LIFE,
  });
  playSfx?.("slash");
}

function updateArrows(state: GameState, dt: number, playSfx?: SoundCallback) {
  const room = state.rooms[state.roomId];
  state.arrows = state.arrows.filter((arrow) => {
    arrow.life -= dt;
    if (arrow.life <= 0) return false;
    arrow.x += arrow.vx * dt;
    arrow.y += arrow.vy * dt;
    if (arrow.x < 0 || arrow.x > CANVAS_WIDTH || arrow.y < 0 || arrow.y > CANVAS_HEIGHT)
      return false;

    const tx = Math.floor(arrow.x / TILE_SIZE);
    const ty = Math.floor(arrow.y / TILE_SIZE);
    const tile = room.tiles[ty]?.[tx];
    if (tile === "crack") {
      breakCrack(state, tx, ty, playSfx);
      return false;
    }
    if (tile && isSolidTile(tile)) {
      spawnBurst(state, arrow.x, arrow.y, "#e8ecf5", 3);
      return false;
    }

    for (const enemy of room.enemies) {
      if (!enemy.alive || enemy.hitTimer > 0) continue;
      if (rectsOverlap(arrow.x - 3, arrow.y - 3, 6, 6, enemy.x, enemy.y, enemy.size, enemy.size)) {
        damageEnemy(state, enemy, 1, playSfx);
        return false;
      }
    }
    return true;
  });
}

export function damageEnemy(
  state: GameState,
  enemy: EnemyState,
  amount: number,
  playSfx?: SoundCallback,
) {
  enemy.hp = Math.max(0, enemy.hp - amount);
  enemy.hitTimer = 0.25;
  const dx = enemy.x + enemy.size / 2 - (state.player.x + 8);
  const dy = enemy.y + enemy.size / 2 - (state.player.y + 8);
  const dist = Math.hypot(dx, dy) || 1;
  const knock = enemy.kind === "gorda" ? 55 : 115;
  enemy.knockVx = (dx / dist) * knock;
  enemy.knockVy = (dy / dist) * knock;
  playSfx?.("hit");
  spawnBurst(state, enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, "#7ef5e2", 6);

  if (enemy.hp <= 0) {
    enemy.alive = false;
    const room = state.rooms[state.roomId];
    spawnBurst(state, enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, "#ffe066", 12);
    if (enemy.kind === "gorda") {
      state.bossDefeated = true;
      room.drops.push({
        id: `drop-${state.nextEntityId++}`,
        kind: "shard",
        x: enemy.x + 6,
        y: enemy.y + 6,
        bobPhase: 0,
      });
      state.banner = { text: "古の番人ゴルダを倒した！星のかけらを取ろう！", timer: 3.5 };
      playSfx?.("unlock");
    } else {
      const dropKind = state.player.hp < state.player.maxHp ? "heart" : "coin";
      room.drops.push({
        id: `drop-${state.nextEntityId++}`,
        kind: dropKind,
        x: enemy.x + 1,
        y: enemy.y + 1,
        bobPhase: 0,
      });
    }
  }
}

export function advanceDialogue(state: GameState, playSfx?: SoundCallback) {
  if (!state.dialogue) return;
  if (state.dialogue.index + 1 < state.dialogue.lines.length) {
    state.dialogue.index += 1;
    playSfx?.("talk");
  } else {
    state.dialogue = null;
  }
}

/** Picks the first dialogue variant whose story flag has been set; otherwise the default lines. */
export function linesFor(npc: NpcState, flags: GameState["flags"]): string[] {
  const variant = npc.variants?.find((v) => flags[v.when]);
  return variant ? variant.lines : npc.lines;
}

export function interact(state: GameState, playSfx?: SoundCallback) {
  if (state.phase !== "playing") return;
  if (state.dialogue) {
    advanceDialogue(state, playSfx);
    return;
  }

  const box = getSwordHitbox(state);
  const room = state.rooms[state.roomId];

  // Check chests
  for (const chest of room.chests) {
    if (chest.opened) continue;
    if (
      rectsOverlap(box.x, box.y, box.w, box.h, chest.tx * TILE_SIZE, chest.ty * TILE_SIZE, 16, 16)
    ) {
      chest.opened = true;
      playSfx?.("chest");
      spawnBurst(state, chest.tx * TILE_SIZE + 8, chest.ty * TILE_SIZE + 6, "#ffe066", 12);
      if (chest.reward === "shard") {
        state.player.shards += 1;
        unlockShrineIfReady(state, playSfx);
      } else if (chest.reward === "heart_container") {
        state.player.maxHp += 2;
        state.player.hp = state.player.maxHp;
      } else {
        state.player.coins += 20;
      }
      chest.sets?.forEach((flag) => setFlag(state, flag));
      state.dialogue = { speaker: "宝箱", lines: [chest.message], index: 0 };
      return;
    }
  }

  // Check NPCs & signs
  for (const npc of room.npcs) {
    if (rectsOverlap(box.x, box.y, box.w, box.h, npc.tx * TILE_SIZE, npc.ty * TILE_SIZE, 16, 16)) {
      const lines = [...linesFor(npc, state.flags)];
      if (npc.grants && !state.abilities[npc.grants]) {
        state.abilities[npc.grants] = true;
        lines.push(ABILITY_NOTES[npc.grants]);
        state.banner = { text: "新しい技を覚えた！", timer: 2.5 };
        playSfx?.("unlock");
      }
      npc.sets?.forEach((flag) => setFlag(state, flag));
      state.dialogue = { speaker: npc.name, lines, index: 0 };
      playSfx?.("talk");
      return;
    }
  }
}

export function damagePlayer(
  state: GameState,
  amount: number,
  fromX: number,
  fromY: number,
  playSfx?: SoundCallback,
) {
  const p = state.player;
  if (p.invulnTimer > 0 || state.phase !== "playing") return;
  p.hp = Math.max(0, p.hp - amount);
  p.invulnTimer = 0.9;
  const dx = p.x + 8 - fromX;
  const dy = p.y + 8 - fromY;
  const dist = Math.hypot(dx, dy) || 1;
  p.knockVx = (dx / dist) * 120;
  p.knockVy = (dy / dist) * 120;
  spawnBurst(state, p.x + 8, p.y + 8, "#e64553", 8);
  if (p.hp <= 0) {
    state.phase = "gameover";
    playSfx?.("gameover");
  } else {
    playSfx?.("hurt");
  }
}

function transitionRoom(state: GameState, dir: Direction) {
  const current = state.rooms[state.roomId];
  const nextId: RoomId | undefined = current.exits[dir];
  if (!nextId) return;
  state.roomId = nextId;
  state.particles = [];
  state.arrows = [];
  if (dir === "right") state.player.x = 6;
  if (dir === "left") state.player.x = CANVAS_WIDTH - 22;
  if (dir === "down") state.player.y = 6;
  if (dir === "up") state.player.y = CANVAS_HEIGHT - 22;

  const storyEvent = ROOM_STORY_EVENTS[nextId];
  if (storyEvent && !state.seenRooms[nextId]) {
    // First arrival: show the chapter title, then the story beat.
    state.seenRooms[nextId] = true;
    state.banner = { text: storyEvent.chapter, timer: 2.5 };
    state.dialogue = { speaker: storyEvent.speaker, lines: storyEvent.lines, index: 0 };
    return;
  }
  state.banner = { text: state.rooms[nextId].name, timer: 2.0 };
}

/**
 * What Rio should do next. The main goal follows the boss and shard progress;
 * the side goal points at the next optional story beat.
 */
export function getObjectives(state: GameState): { main: string; side: string | null } {
  const shards = state.player.shards;
  let main: string;
  if (state.bossDefeated) {
    main = shards >= 3 ? "翠光の塔で儀式を行い、光を取り戻す" : "ゴルダが残した星のかけらを拾う";
  } else if (state.shrineUnlocked) {
    main = "翠光の神殿で番人ゴルダを倒す";
  } else {
    main = `星のかけらを2つ集めて神殿の封印を解く（${Math.min(shards, 2)}/2）`;
  }

  let side: string | null = null;
  if (!state.flags["metNagi"]) side = "（寄り道）砂風の砂漠の旅商人ナギに話を聞く";
  else if (!state.flags["metHomura"]) side = "（寄り道）火山の語り部ホムラに会う";
  else if (!state.flags["pocketFound"]) side = "（寄り道）火山のひび割れを星の矢で砕く";
  return { main, side };
}

export function stepGame(state: GameState, input: InputState, dt: number, playSfx?: SoundCallback) {
  const clampedDt = Math.min(dt, 0.05);
  state.time += clampedDt;
  if (state.banner) {
    state.banner.timer -= clampedDt;
    if (state.banner.timer <= 0) state.banner = null;
  }
  if (state.phase === "intro" || state.phase === "ending") {
    if (state.intro) {
      state.intro.fade = Math.min(1, state.intro.fade + clampedDt * 1.8);
    }
    // Drift ambient star particles during intro/ending
    if (Math.random() < clampedDt * 4) {
      state.particles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1.2,
        maxLife: 1.2,
        color: Math.random() < 0.5 ? "#52e5b2" : "#dfe8f5",
        size: 1,
      });
    }
    state.particles = state.particles.filter((pt) => {
      pt.x += pt.vx * clampedDt;
      pt.y += pt.vy * clampedDt;
      pt.life -= clampedDt;
      return pt.life > 0;
    });
    return;
  }
  if (state.phase !== "playing" || state.dialogue) return;

  const p = state.player;
  p.attackTimer = Math.max(0, p.attackTimer - clampedDt);
  p.attackCooldown = Math.max(0, p.attackCooldown - clampedDt);
  p.invulnTimer = Math.max(0, p.invulnTimer - clampedDt);
  p.rollTimer = Math.max(0, p.rollTimer - clampedDt);
  p.rollCooldown = Math.max(0, p.rollCooldown - clampedDt);
  p.bowCooldown = Math.max(0, p.bowCooldown - clampedDt);

  // Player movement (a roll overrides input until it ends)
  const rolling = p.rollTimer > 0;
  let vx = 0;
  let vy = 0;
  if (rolling) {
    vx = p.rollVx;
    vy = p.rollVy;
  } else if (p.attackTimer <= 0.06) {
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    if (input.up) vy -= 1;
    if (input.down) vy += 1;
  }
  if (!rolling && (vx !== 0 || vy !== 0)) {
    const len = Math.hypot(vx, vy);
    vx = (vx / len) * PLAYER_SPEED;
    vy = (vy / len) * PLAYER_SPEED;
    if (Math.abs(vx) >= Math.abs(vy)) {
      p.dir = vx < 0 ? "left" : "right";
    } else {
      p.dir = vy < 0 ? "up" : "down";
    }
  }
  if (vx !== 0 || vy !== 0) {
    p.walkTimer += clampedDt;
  }

  const totalVx = vx + p.knockVx;
  const totalVy = vy + p.knockVy;
  p.knockVx *= Math.pow(0.001, clampedDt);
  p.knockVy *= Math.pow(0.001, clampedDt);

  const nextX = p.x + totalVx * clampedDt;
  if (
    !isBlockedAt(
      state,
      nextX + PLAYER_HITBOX.ox,
      p.y + PLAYER_HITBOX.oy,
      PLAYER_HITBOX.w,
      PLAYER_HITBOX.h,
    )
  ) {
    p.x = nextX;
  } else if (vx !== 0 && vy === 0) {
    for (const nudge of [-4, 4, -7, 7]) {
      if (
        !isBlockedAt(
          state,
          nextX + PLAYER_HITBOX.ox,
          p.y + nudge + PLAYER_HITBOX.oy,
          PLAYER_HITBOX.w,
          PLAYER_HITBOX.h,
        )
      ) {
        p.y += Math.sign(nudge) * PLAYER_SPEED * 0.65 * clampedDt;
        break;
      }
    }
  }
  const nextY = p.y + totalVy * clampedDt;
  if (
    !isBlockedAt(
      state,
      p.x + PLAYER_HITBOX.ox,
      nextY + PLAYER_HITBOX.oy,
      PLAYER_HITBOX.w,
      PLAYER_HITBOX.h,
    )
  ) {
    p.y = nextY;
  } else if (vy !== 0 && vx === 0) {
    for (const nudge of [-4, 4, -7, 7]) {
      if (
        !isBlockedAt(
          state,
          p.x + nudge + PLAYER_HITBOX.ox,
          nextY + PLAYER_HITBOX.oy,
          PLAYER_HITBOX.w,
          PLAYER_HITBOX.h,
        )
      ) {
        p.x += Math.sign(nudge) * PLAYER_SPEED * 0.65 * clampedDt;
        break;
      }
    }
  }

  // Room exits
  const room = state.rooms[state.roomId];
  if (p.x < 2 && room.exits.left) transitionRoom(state, "left");
  else if (p.x > CANVAS_WIDTH - 18 && room.exits.right) transitionRoom(state, "right");
  else if (p.y < 2 && room.exits.up) transitionRoom(state, "up");
  else if (p.y > CANVAS_HEIGHT - 18 && room.exits.down) transitionRoom(state, "down");
  else {
    p.x = Math.max(0, Math.min(CANVAS_WIDTH - 16, p.x));
    p.y = Math.max(0, Math.min(CANVAS_HEIGHT - 16, p.y));
  }

  // Healing spring check
  const centerTx = Math.floor((p.x + 8) / TILE_SIZE);
  const centerTy = Math.floor((p.y + 10) / TILE_SIZE);
  const currentRoom = state.rooms[state.roomId];
  if (currentRoom.tiles[centerTy]?.[centerTx] === "spring" && p.hp < p.maxHp) {
    p.hp = p.maxHp;
    spawnBurst(state, p.x + 8, p.y + 8, "#58d4e8", 10);
    state.banner = { text: "癒やしの泉で体力が全回復した！", timer: 2.0 };
    playSfx?.("pickup");
  }

  // Update enemies
  for (const enemy of currentRoom.enemies) {
    if (!enemy.alive) continue;
    enemy.hitTimer = Math.max(0, enemy.hitTimer - clampedDt);

    let evx = enemy.knockVx;
    let evy = enemy.knockVy;
    enemy.knockVx *= Math.pow(0.002, clampedDt);
    enemy.knockVy *= Math.pow(0.002, clampedDt);

    if (enemy.kind === "gorda") {
      if (state.shrineUnlocked) {
        enemy.dashTimer -= clampedDt;
        const dx = p.x + 8 - (enemy.x + enemy.size / 2);
        const dy = p.y + 8 - (enemy.y + enemy.size / 2);
        const dist = Math.hypot(dx, dy) || 1;
        const speed = enemy.dashTimer < 0.55 ? 64 : 26;
        if (enemy.dashTimer <= 0) enemy.dashTimer = 2.4;
        evx += (dx / dist) * speed;
        evy += (dy / dist) * speed;
      }
    } else if (enemy.kind === "hibachi") {
      // Fire enemy: darts toward player in bursts
      enemy.moveTimer -= clampedDt;
      if (enemy.moveTimer <= 0) {
        const dx = p.x + 8 - (enemy.x + enemy.size / 2);
        const dy = p.y + 8 - (enemy.y + enemy.size / 2);
        const dist = Math.hypot(dx, dy) || 1;
        evx += (dx / dist) * 50;
        evy += (dy / dist) * 50;
        enemy.moveTimer = 1.5;
      }
    } else if (enemy.kind === "fuyubi") {
      // Ice enemy: drifts slowly toward player
      const dx = p.x + 8 - (enemy.x + enemy.size / 2);
      const dy = p.y + 8 - (enemy.y + enemy.size / 2);
      const dist = Math.hypot(dx, dy) || 1;
      evx += (dx / dist) * 18;
      evy += (dy / dist) * 18;
    } else {
      enemy.moveTimer -= clampedDt;
      if (enemy.moveTimer <= 0) {
        const dirs: Direction[] = ["up", "down", "left", "right"];
        const idx = Math.floor((state.time * 13 + enemy.x + enemy.y) % 4);
        enemy.dir = dirs[idx] ?? "down";
        enemy.moveTimer = 0.8 + (idx % 3) * 0.35;
      }
      const speed = enemy.kind === "kagebito" ? 36 : enemy.kind === "togemushi" ? 32 : 24;
      if (enemy.dir === "left") evx -= speed;
      if (enemy.dir === "right") evx += speed;
      if (enemy.dir === "up") evy -= speed;
      if (enemy.dir === "down") evy += speed;
    }

    const nx = enemy.x + evx * clampedDt;
    if (!isBlockedAt(state, nx, enemy.y, enemy.size, enemy.size)) {
      enemy.x = Math.max(16, Math.min(CANVAS_WIDTH - 16 - enemy.size, nx));
    }
    const ny = enemy.y + evy * clampedDt;
    if (!isBlockedAt(state, enemy.x, ny, enemy.size, enemy.size)) {
      enemy.y = Math.max(16, Math.min(CANVAS_HEIGHT - 16 - enemy.size, ny));
    }

    // Player contact damage
    if (
      rectsOverlap(
        p.x + PLAYER_HITBOX.ox,
        p.y + PLAYER_HITBOX.oy,
        PLAYER_HITBOX.w,
        PLAYER_HITBOX.h,
        enemy.x + 2,
        enemy.y + 2,
        enemy.size - 4,
        enemy.size - 4,
      )
    ) {
      damagePlayer(
        state,
        enemy.kind === "gorda" ? 2 : 1,
        enemy.x + enemy.size / 2,
        enemy.y + enemy.size / 2,
        playSfx,
      );
    }
  }

  updateArrows(state, clampedDt, playSfx);

  // Pickup drops
  currentRoom.drops = currentRoom.drops.filter((drop) => {
    if (rectsOverlap(p.x + 2, p.y + 2, 12, 12, drop.x, drop.y, 12, 12)) {
      if (drop.kind === "heart") {
        p.hp = Math.min(p.maxHp, p.hp + 2);
        playSfx?.("pickup");
      } else if (drop.kind === "coin") {
        p.coins += 5;
        playSfx?.("pickup");
      } else {
        p.shards += 1;
        spawnBurst(state, p.x + 8, p.y + 8, "#52e5b2", 16);
        if (p.shards >= 3) {
          // Boss defeated with 3 shards — go to ending
          if (state.bossDefeated) {
            state.roomId = "tower";
            startEnding(state, playSfx);
          } else {
            unlockShrineIfReady(state, playSfx);
            playSfx?.("chest");
          }
        } else {
          unlockShrineIfReady(state, playSfx);
          playSfx?.("chest");
        }
      }
      return false;
    }
    return true;
  });

  // Update particles
  state.particles = state.particles.filter((pt) => {
    pt.x += pt.vx * clampedDt;
    pt.y += pt.vy * clampedDt;
    pt.life -= clampedDt;
    return pt.life > 0;
  });
}
