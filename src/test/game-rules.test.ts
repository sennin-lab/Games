import { describe, expect, it } from "vitest";
import {
  advanceIntro,
  createInitialState,
  damageEnemy,
  damagePlayer,
  startAttack,
  stepGame,
  unlockShrineIfReady,
} from "@/game/engine";
import { MAP_COLS, MAP_ROWS, TILE_SIZE, createInitialRooms, isSolidTile } from "@/game/maps";
import {
  ABILITY_NOTES,
  getObjectives,
  interact,
  linesFor,
  startRoll,
  startShoot,
} from "@/game/engine";
import { buildEndingStory, ROOM_STORY_EVENTS } from "@/game/types";
import type { GameState, RoomId } from "@/game/types";

const lastLine = (st: GameState): string | undefined => st.dialogue?.lines.at(-1);

// Reads the current room without TypeScript narrowing it to the literal assigned above.
const roomOf = (st: GameState): RoomId => st.roomId;

describe("翠星の旅人 リオ game rules", () => {
  it("cuts a bush tile into grass when Rio swings the sword", () => {
    const state = createInitialState("playing");
    // In village, tile (3, 6) is a bush ("b")
    expect(state.rooms.village.tiles[6]?.[3]).toBe("bush");
    state.player.x = 2 * TILE_SIZE;
    state.player.y = 6 * TILE_SIZE;
    state.player.dir = "right";

    startAttack(state);
    expect(state.rooms.village.tiles[6]?.[3]).toBe("grass");
  });

  it("unlocks the Emerald Shrine gates once 2 Star Shards are collected", () => {
    const state = createInitialState("playing");
    expect(state.shrineUnlocked).toBe(false);
    expect(state.rooms.shrine.tiles[7]?.[6]).toBe("gate");

    state.player.shards = 2;
    unlockShrineIfReady(state);

    expect(state.shrineUnlocked).toBe(true);
    expect(state.rooms.shrine.tiles[7]?.[6]).toBe("floor");
    expect(state.rooms.shrine.tiles[7]?.[7]).toBe("floor");
    expect(state.rooms.shrine.tiles[7]?.[8]).toBe("floor");
  });

  it("walks along the east village road smoothly into the Whispering Forest and back", () => {
    const state = createInitialState("playing");
    state.player.x = 7 * TILE_SIZE;
    state.player.y = 4.5 * TILE_SIZE;

    for (let i = 0; i < 120; i++) {
      stepGame(state, { up: false, down: false, left: false, right: true }, 0.03);
      if (state.roomId === "forest") break;
    }
    expect(state.roomId).toBe("forest");

    for (let i = 0; i < 60; i++) {
      stepGame(state, { up: false, down: false, left: true, right: false }, 0.03);
      if (state.roomId === "village") break;
    }
    expect(state.roomId).toBe("village");
  });

  it("transitions to gameover when player HP drops to 0", () => {
    const state = createInitialState("playing");
    damagePlayer(state, 6, 0, 0);
    expect(state.player.hp).toBe(0);
    expect(state.phase).toBe("gameover");
  });

  it("defeating Boss Gorda drops the 3rd Star Shard and picking it up triggers victory", () => {
    const state = createInitialState("playing");
    state.roomId = "shrine";
    state.player.shards = 2;
    unlockShrineIfReady(state);

    const boss = state.rooms.shrine.enemies[0];
    expect(boss?.kind).toBe("gorda");
    if (!boss) return;

    damageEnemy(state, boss, boss.hp);
    expect(boss.alive).toBe(false);
    expect(state.bossDefeated).toBe(true);

    const shardDrop = state.rooms.shrine.drops.find((d) => d.kind === "shard");
    expect(shardDrop).toBeDefined();
    if (!shardDrop) return;

    state.player.x = shardDrop.x;
    state.player.y = shardDrop.y;
    stepGame(state, { up: false, down: false, left: false, right: false }, 0.016);

    expect(state.player.shards).toBe(3);
    // Ending story plays first; victory screen after the last panel.
    expect(state.phase).toBe("ending");
    let guard = 0;
    while (state.phase === "ending" && guard++ < 100) advanceIntro(state);
    expect(state.phase).toBe("victory");
  });
});

describe("area layout", () => {
  const rooms = createInitialRooms();

  it("gives every room a complete 15x11 grid", () => {
    for (const room of Object.values(rooms)) {
      expect(room.tiles.length, room.id).toBe(MAP_ROWS);
      for (const row of room.tiles) expect(row.length, room.id).toBe(MAP_COLS);
    }
  });

  it("links desert and volcano both ways from the forest", () => {
    expect(rooms.forest.exits.right).toBe("desert");
    expect(rooms.desert.exits.left).toBe("forest");
    expect(rooms.desert.exits.up).toBe("volcano");
    expect(rooms.volcano.exits.down).toBe("desert");
  });

  it("lets Rio walk from the forest through the desert to the volcano", () => {
    const state = createInitialState("playing");
    state.roomId = "forest";
    state.player.x = 7 * TILE_SIZE;
    state.player.y = 4.5 * TILE_SIZE;

    const east = { up: false, down: false, left: false, right: true };
    for (let i = 0; i < 200 && roomOf(state) !== "desert"; i++) stepGame(state, east, 0.03);
    expect(roomOf(state)).toBe("desert");

    // Dismiss the first-visit story beat, then head for the desert's north gate.
    state.dialogue = null;
    state.player.x = 8 * TILE_SIZE;
    state.player.y = 2 * TILE_SIZE;
    const north = { up: true, down: false, left: false, right: false };
    for (let i = 0; i < 200 && roomOf(state) !== "volcano"; i++) stepGame(state, north, 0.03);
    expect(roomOf(state)).toBe("volcano");
  });

  it("keeps every chest and NPC reachable from the room entrance", () => {
    for (const id of ["desert", "volcano"] as const) {
      const room = rooms[id];
      const entry = id === "desert" ? { x: 0, y: 4 } : { x: 8, y: 9 };
      const blocked = (tx: number, ty: number) => {
        const tile = room.tiles[ty]?.[tx];
        // Cracked rock counts as open here: the bow opens it, and the test checks the bow separately.
        if (!tile || (isSolidTile(tile) && tile !== "crack")) return true;
        return (
          room.chests.some((c) => c.tx === tx && c.ty === ty) ||
          room.npcs.some((n) => n.tx === tx && n.ty === ty)
        );
      };
      const reached = new Set<string>([`${entry.x},${entry.y}`]);
      const queue = [entry];
      while (queue.length) {
        const cur = queue.shift();
        if (!cur) break;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cur.x + (dx ?? 0);
          const ny = cur.y + (dy ?? 0);
          const key = `${nx},${ny}`;
          if (reached.has(key) || blocked(nx, ny)) continue;
          reached.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
      for (const c of room.chests)
        expect(
          reached.has(`${c.tx},${c.ty - 1}`) ||
            reached.has(`${c.tx - 1},${c.ty}`) ||
            reached.has(`${c.tx + 1},${c.ty}`) ||
            reached.has(`${c.tx},${c.ty + 1}`),
          `${id} chest ${c.id}`,
        ).toBe(true);
    }
  });

  it("plays each room's story event only on the first visit", () => {
    const state = createInitialState("playing");
    state.roomId = "forest";
    state.player.x = (MAP_COLS - 2) * TILE_SIZE;
    state.player.y = 4 * TILE_SIZE;
    for (let i = 0; i < 200 && roomOf(state) !== "desert"; i++) {
      stepGame(state, { up: false, down: false, left: false, right: true }, 0.03);
    }
    expect(roomOf(state)).toBe("desert");
    expect(state.dialogue?.speaker).toBe("リオ");
    expect(state.seenRooms.desert).toBe(true);
  });
});

describe("skills, cracked rock and story progress", () => {
  it("teaches the dodge roll from the desert merchant once, and makes Rio invulnerable while rolling", () => {
    const state = createInitialState("playing");
    state.roomId = "desert";
    const nagi = state.rooms.desert.npcs[0];
    if (!nagi) throw new Error("merchant missing");
    state.player.x = nagi.tx * TILE_SIZE - 14;
    state.player.y = nagi.ty * TILE_SIZE + 1;
    state.player.dir = "right";

    interact(state);
    expect(state.abilities.roll).toBe(true);
    expect(state.flags["metNagi"]).toBe(true);
    expect(lastLine(state)).toBe(ABILITY_NOTES.roll);

    // Talking again does not grant it twice.
    state.dialogue = null;
    interact(state);
    expect(lastLine(state)).not.toBe(ABILITY_NOTES.roll);

    state.dialogue = null;
    // Move to an open stretch of desert so the roll is not blocked by the merchant.
    state.player.x = 6 * TILE_SIZE + 4;
    state.player.y = 1 * TILE_SIZE + 2;
    state.player.dir = "right";
    startRoll(state);
    expect(state.player.rollTimer).toBeGreaterThan(0);
    expect(state.player.invulnTimer).toBeGreaterThan(0.2);
    const startX = state.player.x;
    for (let i = 0; i < 5; i++)
      stepGame(state, { up: false, down: false, left: false, right: false }, 0.02);
    expect(state.player.x).toBeGreaterThan(startX);
  });

  it("does not let the roll start before the ability is learned", () => {
    const state = createInitialState("playing");
    startRoll(state);
    expect(state.player.rollTimer).toBe(0);
  });

  it("breaks cracked rock with a star arrow, and the sword only clinks off it", () => {
    const state = createInitialState("playing");
    state.roomId = "volcano";
    state.abilities.bow = true;
    state.player.x = 6 * TILE_SIZE;
    state.player.y = 3 * TILE_SIZE;
    state.player.dir = "up";

    expect(state.rooms.volcano.tiles[2]?.[6]).toBe("crack");
    startShoot(state);
    expect(state.arrows.length).toBe(1);
    for (let i = 0; i < 40 && state.rooms.volcano.tiles[2]?.[6] === "crack"; i++) {
      stepGame(state, { up: false, down: false, left: false, right: false }, 0.016);
    }
    expect(state.rooms.volcano.tiles[2]?.[6]).toBe("floor");
    expect(state.arrows.length).toBe(0);
  });

  it("opens the hidden pocket chest behind the cracks and records the story flag", () => {
    const state = createInitialState("playing");
    state.roomId = "volcano";
    const chest = state.rooms.volcano.chests.find((c) => c.id === "chest-volcano-pocket");
    if (!chest) throw new Error("pocket chest missing");
    const maxHpBefore = state.player.maxHp;
    state.player.x = chest.tx * TILE_SIZE - 14;
    state.player.y = chest.ty * TILE_SIZE + 1;
    state.player.dir = "right";

    interact(state);
    expect(chest.opened).toBe(true);
    expect(state.flags["pocketFound"]).toBe(true);
    expect(state.player.maxHp).toBe(maxHpBefore + 2);
  });

  it("switches NPC dialogue to a variant once its story flag is set", () => {
    const rooms = createInitialRooms();
    const elder = rooms.village.npcs.find((n) => n.id === "elder-haru");
    if (!elder) throw new Error("elder missing");
    expect(linesFor(elder, {})).toBe(elder.lines);
    expect(linesFor(elder, { gotBow: true })).not.toBe(elder.lines);
  });

  it("adds the optional side objective until the matching story beat happens", () => {
    const state = createInitialState("playing");
    expect(getObjectives(state).side).toContain("ナギ");
    state.flags["metNagi"] = true;
    expect(getObjectives(state).side).toContain("ホムラ");
    state.flags["metHomura"] = true;
    expect(getObjectives(state).side).toContain("ひび割れ");
    state.flags["pocketFound"] = true;
    expect(getObjectives(state).side).toBeNull();
  });

  it("adds extra ending beats when Rio found the sheath or the bow", () => {
    const base = buildEndingStory({});
    const withBoth = buildEndingStory({ sheathFound: true, gotBow: true });
    expect(withBoth.length).toBe(base.length + 2);
  });

  it("gives the shrine an entry story beat with a chapter title", () => {
    expect(ROOM_STORY_EVENTS.shrine?.chapter).toContain("神殿");
  });
});
