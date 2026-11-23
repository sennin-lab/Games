import type { ChestState, EnemyState, NpcState, RoomId, RoomRuntime, TileType } from "./types";

export const TILE_SIZE = 16;
export const MAP_COLS = 15;
export const MAP_ROWS = 11;
export const CANVAS_WIDTH = MAP_COLS * TILE_SIZE; // 240
export const CANVAS_HEIGHT = MAP_ROWS * TILE_SIZE; // 176

const CHAR_TO_TILE: Record<string, TileType> = {
  ".": "grass",
  ",": "flower",
  b: "bush",
  T: "tree",
  "~": "water",
  p: "path",
  "#": "wall",
  f: "floor",
  "=": "bridge",
  G: "gate",
  S: "spring",
  C: "crystal",
  L: "lava",
  R: "rock",
  s: "sand",
  i: "ice",
  X: "crack",
};

function parseGrid(rows: string[]): TileType[][] {
  return rows.map((row) => row.split("").map((ch) => CHAR_TO_TILE[ch] ?? "grass"));
}

export function isSolidTile(tile: TileType): boolean {
  return (
    tile === "tree" ||
    tile === "water" ||
    tile === "wall" ||
    tile === "gate" ||
    tile === "bush" ||
    tile === "rock" ||
    tile === "lava" ||
    tile === "crystal" ||
    tile === "ice" ||
    tile === "crack"
  );
}

interface RoomBlueprint {
  id: RoomId;
  name: string;
  grid: string[];
  exits: RoomRuntime["exits"];
  enemies: Omit<
    EnemyState,
    "moveTimer" | "hitTimer" | "knockVx" | "knockVy" | "dashTimer" | "alive"
  >[];
  chests: Omit<ChestState, "opened">[];
  npcs: NpcState[];
}

const BLUEPRINTS: Record<RoomId, RoomBlueprint> = {
  village: {
    id: "village",
    name: "始まりの村・ミドリ",
    grid: [
      "TTTTTTpppTTTTTT",
      "T.,...ppp...b.T",
      "T.bb..ppp..~S~T",
      "T.....ppp..~~~T",
      "T.,...ppppppppp",
      "T.....ppppppppp",
      "T..b..ppp...,.T",
      "T.....ppp..bb.T",
      "T.,...ppp.....T",
      "T.bb.......,,.T",
      "TTTTTTTTTTTTTTT",
    ],
    exits: { up: "ruins", right: "forest", left: "lake", down: "cave" },
    enemies: [],
    chests: [],
    npcs: [
      {
        id: "elder-haru",
        name: "長老ハル",
        role: "elder",
        tx: 5,
        ty: 3,
        lines: [
          "リオよ、よくぞ起きてくれた。北東の『翠光の神殿』の封印が乱れておる。",
          "東の『ささやきの森』、北の『星見の遺跡』、南の『氷晶の洞窟』にかけらが眠る。",
          "かけらが2つ揃えば神殿の扉が開く。右上の泉に触れると体力が回復するぞ。",
        ],
        variants: [
          {
            when: "gotBow",
            lines: ["弓を授かったそうじゃな。アレスも若い頃、同じ弓で島を守っておった。"],
          },
          {
            when: "sheathFound",
            lines: ["アレスの鞘を見つけたか……。あやつは十年、お前を信じて待っておったのじゃ。"],
          },
        ],
      },
      {
        id: "village-sign",
        name: "道しるべ",
        role: "sign",
        tx: 9,
        ty: 6,
        lines: [
          "↑ 北：星見の遺跡 / → 東：ささやきの森",
          "← 西：星影の湖 / ↓ 南：氷晶の洞窟",
          "剣で茂みを刈ると、ハートや星貨が見つかることがあるぞ！",
        ],
      },
    ],
  },
  forest: {
    id: "forest",
    name: "ささやきの森",
    grid: [
      "TTTTTTpppTTTTTT",
      "T.bb..ppp..bb.T",
      "T.,...ppp...,.T",
      "T..TT.ppp.TT..T",
      "ppppppppp..b..p",
      "ppppppppppp...p",
      "T..b...p..bbb.T",
      "T.,..~=~...b..T",
      "T.bb.~~~..,...T",
      "T....~~~......T",
      "TTTTTTTTTTTTTTT",
    ],
    exits: { left: "village", up: "shrine", right: "desert" },
    enemies: [
      { id: "f-d1", kind: "doromu", x: 10 * 16, y: 2 * 16, size: 14, hp: 2, maxHp: 2, dir: "left" },
      { id: "f-d2", kind: "doromu", x: 5 * 16, y: 7 * 16, size: 14, hp: 2, maxHp: 2, dir: "right" },
      {
        id: "f-t1",
        kind: "togemushi",
        x: 11 * 16,
        y: 8 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "up",
      },
    ],
    chests: [
      {
        id: "chest-forest-shard",
        tx: 12,
        ty: 8,
        reward: "shard",
        message: "『星のかけら（森）』を手に入れた！淡い翠色の光を放っている。",
      },
    ],
    npcs: [
      {
        id: "forest-sign",
        name: "森の石碑",
        role: "sign",
        tx: 4,
        ty: 6,
        lines: [
          "この先の茂みの奥に星のかけらが眠る。",
          "北の『翠光の神殿』へ進むには、星のかけらが2つ必要だ。",
        ],
      },
    ],
  },
  ruins: {
    id: "ruins",
    name: "星見の遺跡",
    grid: [
      "###############",
      "#ff..#fff#..ff#",
      "#f..b#fff#b..f#",
      "#f...fffff...f#",
      "#ff###fff###ff#",
      "#fffffffffffff#",
      "#ff###fff###ff#",
      "#f....fff....f#",
      "#f.bb.ppppppppp",
      "#ff...ppppppppp",
      "######ppp######",
    ],
    exits: { down: "village", right: "shrine" },
    enemies: [
      {
        id: "r-k1",
        kind: "kagebito",
        x: 3 * 16,
        y: 3 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "right",
      },
      {
        id: "r-k2",
        kind: "kagebito",
        x: 11 * 16,
        y: 3 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "left",
      },
      {
        id: "r-t1",
        kind: "togemushi",
        x: 7 * 16,
        y: 6 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "down",
      },
    ],
    chests: [
      {
        id: "chest-ruins-shard",
        tx: 7,
        ty: 1,
        reward: "shard",
        message: "『星のかけら（遺跡）』を手に入れた！共鳴する音が響く。",
      },
      {
        id: "chest-ruins-heart",
        tx: 1,
        ty: 1,
        reward: "heart_container",
        message: "『命の器』を手に入れた！最大ハートが1つ増え、全回復した！",
      },
    ],
    npcs: [
      {
        id: "smith-ren",
        name: "旅の鍛冶師レン",
        role: "smith",
        tx: 12,
        ty: 7,
        lines: [
          "おおリオ！北の中央にある宝箱が星のかけらだ。北西には命の器もあるぜ。",
          "神殿の番人ゴルダは突進が強力だ。横にかわして反撃しな！",
        ],
      },
    ],
  },
  cave: {
    id: "cave",
    name: "氷晶の洞窟",
    grid: [
      "RRRRRRRRRRRRRRR",
      "R..i..iii..i..R",
      "R.iR..iii..Ri.R",
      "R.i...iii...i.R",
      "R.iRR.iii.RRi.R",
      "R.iiiiiiiiiii.R",
      "R.iRR.iii.RRi.R",
      "R.i...iii...i.R",
      "R.iR.ppppp.Ri.R",
      "R.ii.ppppp.ii.R",
      "RRRRRpppppRRRRR",
    ],
    exits: { up: "village" },
    enemies: [
      { id: "c-f1", kind: "fuyubi", x: 3 * 16, y: 3 * 16, size: 14, hp: 3, maxHp: 3, dir: "right" },
      { id: "c-f2", kind: "fuyubi", x: 11 * 16, y: 3 * 16, size: 14, hp: 3, maxHp: 3, dir: "left" },
      {
        id: "c-k1",
        kind: "kagebito",
        x: 7 * 16,
        y: 5 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "down",
      },
      { id: "c-f3", kind: "fuyubi", x: 4 * 16, y: 7 * 16, size: 14, hp: 3, maxHp: 3, dir: "up" },
    ],
    chests: [
      {
        id: "chest-cave-shard",
        tx: 7,
        ty: 1,
        reward: "shard",
        message: "『星のかけら（洞窟）』を手に入れた！冷たい光が透き通る。",
      },
      {
        id: "chest-cave-coins",
        tx: 13,
        ty: 5,
        reward: "coins",
        message: "古い星貨の袋を見つけた！20星貨を手に入れた！",
      },
    ],
    npcs: [
      {
        id: "cave-spirit",
        name: "氷の精霊",
        role: "spirit",
        tx: 7,
        ty: 5,
        lines: [
          "……ようこそ、翠光の勇者よ。我は氷晶の守り手。",
          "この洞窟のかけらは、北の祭壇に眠る。氷の魔物に気をつけるのだ。",
          "東の宝箱には古き星貨が眠っている。道中に役立てよ。",
        ],
      },
    ],
  },
  lake: {
    id: "lake",
    name: "星影の湖",
    grid: [
      "TTTTTTTTTTTTTTT",
      "T.,..~~~~~..,.T",
      "T.bb.~~~~~.bb.T",
      "T...=~~~~~....T",
      "T,.==~~~~~==..T",
      "T..===~~~===..T",
      "T,.==~~~~~==..T",
      "T...=~~~~~....T",
      "T.bb.~~~~~.bb.T",
      "T.,..~~~~~..,.T",
      "TTTTTpppppTTTTT",
    ],
    exits: { right: "village", up: "tower" },
    enemies: [
      {
        id: "l-h1",
        kind: "hibachi",
        x: 3 * 16,
        y: 2 * 16,
        size: 14,
        hp: 2,
        maxHp: 2,
        dir: "right",
      },
      {
        id: "l-h2",
        kind: "hibachi",
        x: 11 * 16,
        y: 8 * 16,
        size: 14,
        hp: 2,
        maxHp: 2,
        dir: "left",
      },
      { id: "l-d1", kind: "doromu", x: 7 * 16, y: 5 * 16, size: 14, hp: 2, maxHp: 2, dir: "down" },
    ],
    chests: [
      {
        id: "chest-lake-heart",
        tx: 7,
        ty: 5,
        reward: "heart_container",
        message: "湖の底から『命の器』が浮かび上がった！最大ハートが1つ増えた！",
      },
    ],
    npcs: [
      {
        id: "lake-fisher",
        name: "釣り人カイ",
        role: "fisher",
        tx: 3,
        ty: 4,
        lines: [
          "やあリオ！この湖には昔、星のかけらの光が反射して美しかったんだ。",
          "中央の宝箱は湖の精が守っていた命の器だ。",
          "北に見えるのが翠光の塔だが……今は封印されて入れない。",
        ],
      },
      {
        id: "lake-sign",
        name: "湖畔の碑",
        role: "sign",
        tx: 11,
        ty: 4,
        lines: [
          "星影の湖 —— 翠光の塔への道",
          "塔に入るには、ゴルダを倒し3つのかけらを揃える必要がある。",
        ],
      },
    ],
  },
  shrine: {
    id: "shrine",
    name: "翠光の神殿",
    grid: [
      "###############",
      "#fffffffffffff#",
      "#f#fffffffff#f#",
      "#fffffffffffff#",
      "#fffff...fffff#",
      "#fffffffffffff#",
      "#fffff...fffff#",
      "#f#fffGGGfff#f#",
      "pppppppppfffff#",
      "pppppppppfffff#",
      "######ppp######",
    ],
    exits: { down: "forest", left: "ruins" },
    enemies: [
      {
        id: "boss-gorda",
        kind: "gorda",
        x: 7 * 16 - 6,
        y: 3 * 16,
        size: 26,
        hp: 10,
        maxHp: 10,
        dir: "down",
      },
    ],
    chests: [],
    npcs: [
      {
        id: "shrine-sign",
        name: "神殿の碑文",
        role: "sign",
        tx: 10,
        ty: 9,
        lines: [
          "『2つの星のかけらを携えし者のみ、翠光の門を開く』",
          "門の奥に古の番人ゴルダが待つ。",
        ],
      },
    ],
  },
  tower: {
    id: "tower",
    name: "翠光の塔",
    grid: [
      "###############",
      "#fff#fff#fff#f#",
      "#f...........f#",
      "#f.CC.fff.CC.f#",
      "#f....fff....f#",
      "#ff#########ff#",
      "#ff#fffffff#ff#",
      "#ff#fffffff#ff#",
      "pppppppfffffff#",
      "pppppppfffffff#",
      "######ppp######",
    ],
    exits: { down: "lake" },
    enemies: [],
    chests: [],
    npcs: [
      {
        id: "tower-astrologer",
        name: "星読みのセツナ",
        role: "astrologer",
        tx: 7,
        ty: 3,
        lines: [
          "……来たか、翠光の勇者よ。私は星読みのセツナ。",
          "三つのかけらが揃った今、この塔で儀式を行えば翠光が復活する。",
          "だが、その前に……ゴルダの真実を知る必要がある。神殿へ向かうがよい。",
          "ゴルダを倒した後、ここに戻り、儀式を行うのだ。",
        ],
      },
    ],
  },
  desert: {
    id: "desert",
    name: "砂風の砂漠",
    grid: [
      "RRRRRRRpppRRRRR",
      "R..ssss..ss..sR",
      "Rs.RR.ss.RR.s.R",
      "Rss.....s.....R",
      "ppppsss.ss.s..R",
      "p..bb...s..b..R",
      "R..s..RRR..s..R",
      "Rs.....s....s.R",
      "R.bs..b....ss.R",
      "R..sss.....s..R",
      "RRRRRRRpppRRRRR",
    ],
    exits: { left: "forest", up: "volcano" },
    enemies: [
      {
        id: "d-k1",
        kind: "kagebito",
        x: 3 * 16,
        y: 3 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "right",
      },
      {
        id: "d-k2",
        kind: "kagebito",
        x: 11 * 16,
        y: 3 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "left",
      },
      { id: "d-t1", kind: "togemushi", x: 5 * 16, y: 9 * 16, size: 14, hp: 3, maxHp: 3, dir: "up" },
    ],
    chests: [
      {
        id: "chest-desert-note",
        tx: 13,
        ty: 8,
        reward: "coins",
        sets: ["noteFound"],
        message:
          "砂に埋もれた古い手記を見つけた！『翠光の導きし者よ、火の山の奥で待つ』と記されている。20星貨も一緒に見つかった！",
      },
    ],
    npcs: [
      {
        id: "desert-merchant",
        name: "砂漠の旅商人ナギ",
        role: "merchant",
        tx: 3,
        ty: 6,
        lines: [
          "おや、翠の光……。お前さん、アレスという男を探しているのかい？",
          "半月ほど前、黒いローブの男がこの砂漠を北へ歩いていったよ。『星見の遺跡の石板』を追っているようだった。",
          "北の火山は足を焼かれる熱さだ。ほら、これをやろう。砂嵐のときに役立つ『風のブーツ』だ。",
        ],
        grants: "roll",
        sets: ["metNagi", "gotRoll"],
        variants: [
          {
            when: "noteFound",
            lines: [
              "その手記を見つけたのかい。アレスは、火山の奥で何かを封じたらしい。",
              "北の語り部ホムラに会えば、もっと詳しく聞けるはずだ。",
            ],
          },
          {
            when: "gotRoll",
            lines: ["風のブーツ、ちゃんと使ってるかい？ 砂嵐の中でも転がれば無事で済むさ。"],
          },
        ],
      },
    ],
  },
  volcano: {
    id: "volcano",
    name: "灼熱の火山",
    grid: [
      "RRRRRRRRRRRRRRR",
      "RffffffRffffffR",
      "RXLLLLXRfLLLLfR",
      "RfLfffffffffLfR",
      "RffLLLLLLLLLffR",
      "RfffffffffffffR",
      "RfLLLLfffLLLLfR",
      "RfffffffffffffR",
      "RfLfffffffffLfR",
      "RfffffffffffffR",
      "RRRRRRRpppRRRRR",
    ],
    exits: { down: "desert" },
    enemies: [
      {
        id: "v-h1",
        kind: "hibachi",
        x: 3 * 16,
        y: 3 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "right",
      },
      {
        id: "v-h2",
        kind: "hibachi",
        x: 11 * 16,
        y: 3 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "left",
      },
      {
        id: "v-k1",
        kind: "kagebito",
        x: 7 * 16,
        y: 7 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "down",
      },
    ],
    chests: [
      {
        id: "chest-volcano-sheath",
        tx: 8,
        ty: 2,
        reward: "coins",
        message: "岩陰で、アレスの剣の鞘を見つけた……。『父さん……』20星貨も落ちていた。",
        sets: ["sheathFound"],
      },
      {
        id: "chest-volcano-pocket",
        tx: 3,
        ty: 1,
        reward: "heart_container",
        message: "ひび割れた岩の奥に隠された『命の器』を見つけた！ 最大ハートが増え、全回復した！",
        sets: ["pocketFound"],
      },
    ],
    npcs: [
      {
        id: "volcano-keeper",
        name: "灰の語り部ホムラ",
        role: "spirit",
        tx: 7,
        ty: 5,
        lines: [
          "ここは十年前、アレスが黒き影と戦った場所じゃ。",
          "影は番人ゴルダの心に巣食い、その力をこの火山の奥へ逃がしておった。",
          "アレスは己の命を楔として、その道を塞いだのじゃ。",
          "その証に、アレスは『翠光の弓』を残していった。影を射抜く星の矢を放てるぞ。",
          "岩の裂け目は剣では砕けぬ。弓で撃ち抜くのじゃ。",
        ],
        grants: "bow",
        sets: ["metHomura", "gotBow"],
        variants: [
          {
            when: "pocketFound",
            lines: [
              "裂け目の奥の宝は見つけたか。アレスも、あの場所に『命の器』を隠していたのじゃ。",
            ],
          },
          {
            when: "gotBow",
            lines: ["弓の扱いは慣れたかの。影を払うには、三つのかけらを携えて翠光の塔へ行け。"],
          },
        ],
      },
    ],
  },
};

export function createInitialRooms(): Record<RoomId, RoomRuntime> {
  const entries = Object.values(BLUEPRINTS).map((bp) => {
    const room: RoomRuntime = {
      id: bp.id,
      name: bp.name,
      tiles: parseGrid(bp.grid),
      exits: { ...bp.exits },
      enemies: bp.enemies.map((e) => ({
        ...e,
        moveTimer: 0.6,
        hitTimer: 0,
        knockVx: 0,
        knockVy: 0,
        dashTimer: 2.0,
        alive: true,
      })),
      chests: bp.chests.map((c) => ({ ...c, opened: false })),
      npcs: bp.npcs.map((n) => ({ ...n, lines: [...n.lines] })),
      drops: [],
    };
    return [bp.id, room] as const;
  });
  return Object.fromEntries(entries) as Record<RoomId, RoomRuntime>;
}
