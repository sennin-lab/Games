import type {
  ChestState,
  EnemyState,
  NpcState,
  RoomId,
  RoomRuntime,
  TabletState,
  TileType,
} from "./types";

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

type EnemySpec = Omit<
  EnemyState,
  "moveTimer" | "hitTimer" | "knockVx" | "knockVy" | "dashTimer" | "alive"
>;

interface RoomBlueprint {
  id: RoomId;
  name: string;
  grid: string[];
  exits: RoomRuntime["exits"];
  enemies: EnemySpec[];
  chests: Omit<ChestState, "opened">[];
  npcs: NpcState[];
  tablets: Omit<TabletState, "found">[];
}

/**
 * World layout (every exit connects to the matching border of its neighbour):
 *
 *            [tower]
 *               |up (gated)
 *   [cave]   [lake] ─right─ [village] ─up─ [ruins] ─right─ [shrine]
 *      up        ↑                |                             |
 *      └─────────┘ down           right                       down
 *                                 ↓                             ↓
 *   [volcano]─down─[desert]─right─[tomb]        [marsh]─up─[forest]
 *                    ↑  └─left─[forest]─right─┘
 *
 * (Compact notes only; see tests/reach script for the verified graph.)
 */
const BLUEPRINTS: Record<RoomId, RoomBlueprint> = {
  village: {
    id: "village",
    name: "始まりの村・ミドリ",
    grid: [
      "TTTTTTpppTTTTTT",
      "T.,...ppp...b.T",
      "T.bb..ppp..~S~T",
      "T.....ppp..~~~T",
      "p.,...ppppppppp",
      "p.....ppppppppp",
      "T..b..ppp...,.T",
      "T.....ppp..bb.T",
      "T.,...ppp.....T",
      "T.bb.......,,.T",
      "TTTTTTpppTTTTTT",
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
          "かけらが2つ揃えば神殿の扉が開く。島の全ての場所を巡れば、最後の塔への道も開けるぞ。",
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
    tablets: [
      {
        id: "tab-village",
        tx: 13,
        ty: 9,
        title: "始まりの村の石碑",
        text: "星が空から降った夜、村人は皆、灯をともして祈った。翠光が戻るまで、この灯は消さない。",
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
      "T..b..ppp.~~.bT",
      "T.,...ppp~~~..T",
      "T.bb..ppp.~~.,T",
      "T.....ppp.....T",
      "TTTTTTpppTTTTTT",
    ],
    exits: { left: "village", up: "shrine", right: "desert", down: "marsh" },
    enemies: [
      { id: "f-d1", kind: "doromu", x: 10 * 16, y: 2 * 16, size: 14, hp: 2, maxHp: 2, dir: "left" },
      { id: "f-d2", kind: "doromu", x: 5 * 16, y: 7 * 16, size: 14, hp: 2, maxHp: 2, dir: "right" },
      {
        id: "f-t1",
        kind: "togemushi",
        x: 12 * 16,
        y: 5 * 16,
        size: 14,
        hp: 3,
        maxHp: 3,
        dir: "up",
      },
    ],
    chests: [
      {
        id: "chest-forest-shard",
        tx: 13,
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
          "この森の奥には、かつて旅人が残した石板が眠っているという。",
          "南の霧深い湿地へ続く道もあるが、迷いやすいので気をつけよ。",
        ],
      },
    ],
    tablets: [
      {
        id: "tab-forest",
        tx: 1,
        ty: 1,
        title: "ささやきの森の古歌",
        text: "森は風に語りかける。『翠の子よ、迷うな。まっすぐ光を見よ』と。",
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
    tablets: [
      {
        id: "tab-ruins",
        tx: 12,
        ty: 1,
        title: "星見の遺跡の石板",
        text: "星の巡りが三つの欠片を結ぶ。欠けた星は、いずれ同じ空の下に集う。",
      },
    ],
  },
  cave: {
    id: "cave",
    name: "氷晶の洞窟",
    grid: [
      "RRRRRRpppRRRRRR",
      "RiiiiRpppRiiiiR",
      "R....ppppp....R",
      "RiiiR.ppp.RiiiR",
      "R.i.R.ppp.R.i.R",
      "R.i...ppp...i.R",
      "RiiR.ppppp.RiiR",
      "R....ppp....iiR",
      "R.iR.ppp.R.iiiR",
      "R.ii.ppp.Ri..iR",
      "RRRRRRRRRRRRRRR",
    ],
    exits: { up: "village" },
    enemies: [
      { id: "c-f1", kind: "fuyubi", x: 3 * 16, y: 5 * 16, size: 14, hp: 3, maxHp: 3, dir: "right" },
      { id: "c-f2", kind: "fuyubi", x: 11 * 16, y: 5 * 16, size: 14, hp: 3, maxHp: 3, dir: "left" },
      { id: "c-k1", kind: "kagebito", x: 9 * 16, y: 7 * 16, size: 14, hp: 3, maxHp: 3, dir: "down" },
      { id: "c-f3", kind: "fuyubi", x: 1 * 16, y: 9 * 16, size: 14, hp: 3, maxHp: 3, dir: "up" },
    ],
    chests: [
      {
        id: "chest-cave-shard",
        tx: 2,
        ty: 2,
        reward: "shard",
        message: "『星のかけら（洞窟）』を手に入れた！冷たい光が透き通る。",
      },
      {
        id: "chest-cave-coins",
        tx: 12,
        ty: 2,
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
          "この洞窟のかけらは、氷の迷路の奥に隠されている。凍てつく魔物に気をつけるのだ。",
          "東の宝箱には古き星貨が眠っている。道中に役立てよ。",
        ],
      },
    ],
    tablets: [
      {
        id: "tab-cave",
        tx: 10,
        ty: 5,
        title: "氷晶の石板",
        text: "凍てついた水の底に、かつての翠光が眠る。割れた欠片は、いつか必ず溶ける。",
      },
    ],
  },
  lake: {
    id: "lake",
    name: "星影の湖",
    grid: [
      "TTTTTTGGGTTTTTT",
      "T.,..ppp..bb,.T",
      "T.bb.ppp.~~~..T",
      "T,..=ppp=~~~,.T",
      "Tpppppppppppppp",
      "Tpppppppppppppp",
      "T..==~~~~~==..T",
      "T,.~~~~~~~~~..T",
      "T.bb~~~~~~~bb.T",
      "T.,..~~~~~..,.T",
      "TTTTTTTTTTTTTTT",
    ],
    exits: { right: "village", up: "tower" },
    enemies: [
      { id: "l-h1", kind: "hibachi", x: 4 * 16, y: 2 * 16, size: 14, hp: 2, maxHp: 2, dir: "right" },
      { id: "l-h2", kind: "hibachi", x: 13 * 16, y: 8 * 16, size: 14, hp: 2, maxHp: 2, dir: "left" },
      { id: "l-d1", kind: "doromu", x: 1 * 16, y: 6 * 16, size: 14, hp: 2, maxHp: 2, dir: "down" },
    ],
    chests: [
      {
        id: "chest-lake-heart",
        tx: 1,
        ty: 9,
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
          "湖の中央の宝箱は、湖の精が守っていた命の器だ。",
          "北の翠光の塔は、今は封印されて入れない。",
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
          "塔の封印は、星のかけらを集め、島の全ての場所を巡り終えた者にのみ開く。",
          "そして星のかけらの共鳴が翠光を満たすには、一時間の刻が必要だという。",
        ],
      },
    ],
    tablets: [
      {
        id: "tab-lake",
        tx: 13,
        ty: 8,
        title: "湖底の石板",
        text: "湖は塔の影を映す。影の中にこそ、光の道は隠れているのだ。",
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
      "######GGG######",
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
        hp: 14,
        maxHp: 14,
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
    tablets: [
      {
        id: "tab-shrine",
        tx: 13,
        ty: 5,
        title: "翠光の神殿の碑文",
        text: "番人は門の内に立つ。影に抗い続けた心を、我らは忘れぬ。",
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
        ritual: true,
        lines: [
          "……来たか、翠光の勇者よ。私は星読みのセツナ。",
          "儀式には三つのかけらが必要だ。まだ揃っていないようだな。",
        ],
        ritualLines: [
          "……三つのかけらが揃ったか。島の全ての場所を巡ったのだな。",
          "ゴルダの影は祓われ、アレスの願いは今、お前の手の中にある。",
          "さあ、翠光を取り戻そう。",
        ],
      },
    ],
    tablets: [
      {
        id: "tab-tower",
        tx: 13,
        ty: 1,
        title: "翠光の塔の伝承",
        text: "三つの欠片は、ひとつの心から生まれる。光を信じる者の手で、塔は目を覚ます。",
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
      "ppppsss.ss.s..p",
      "p..bb...s..b..p",
      "R..s..RRR..s..R",
      "Rs.....s....s.R",
      "R.bs..b....ss.R",
      "R..sss.....s..R",
      "RRRRRRRpppRRRRR",
    ],
    exits: { left: "forest", up: "volcano", right: "tomb" },
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
              "東の果てには、古い墓所もあると聞く。そこにも何か手がかりがあるかもしれん。",
            ],
          },
          {
            when: "gotRoll",
            lines: ["風のブーツ、ちゃんと使ってるかい？ 砂嵐の中でも転がれば無事で済むさ。"],
          },
        ],
      },
    ],
    tablets: [
      {
        id: "tab-desert",
        tx: 1,
        ty: 9,
        title: "砂に刻まれた旅人の歌",
        text: "砂は昼に焼かれ、夜に凍る。それでも旅人は、星を頼りに北へ歩く。",
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
    tablets: [
      {
        id: "tab-volcano",
        tx: 13,
        ty: 1,
        title: "アレスの火山の石板",
        text: "我が息子リオへ。この火の底で影を封じる。お前が強くなった時、必ず光を。――アレス",
      },
    ],
  },
  marsh: {
    id: "marsh",
    name: "霧の湿地",
    grid: [
      "TTTTTTpppTTTTTT",
      "T,..~ppp~..,.bT",
      "T.b.~ppp~.bb..T",
      "T~~~=ppp=~~.,.T",
      "T.,..ppppp.,..T",
      "T~~.~ppp~~~~..T",
      "T..b.ppp.bb.,.T",
      "T.~~.ppp.~~..bT",
      "T.,..ppp..,.~~T",
      "T..bb.ppp.bb..T",
      "TTTTTTTTTTTTTTT",
    ],
    exits: { up: "forest" },
    enemies: [
      { id: "m-d1", kind: "doromu", x: 3 * 16, y: 2 * 16, size: 14, hp: 2, maxHp: 2, dir: "right" },
      { id: "m-d2", kind: "doromu", x: 13 * 16, y: 4 * 16, size: 14, hp: 2, maxHp: 2, dir: "left" },
      { id: "m-k1", kind: "kagebito", x: 1 * 16, y: 9 * 16, size: 14, hp: 3, maxHp: 3, dir: "up" },
      { id: "m-t1", kind: "togemushi", x: 11 * 16, y: 4 * 16, size: 14, hp: 3, maxHp: 3, dir: "down" },
    ],
    chests: [
      {
        id: "chest-marsh-left",
        tx: 1,
        ty: 6,
        reward: "coins",
        message: "霧に沈んだ木箱を開けると、20星貨が出てきた！",
      },
      {
        id: "chest-marsh-right",
        tx: 13,
        ty: 6,
        reward: "coins",
        message: "湿地の奥で、古びた星貨の袋を見つけた！20星貨を手に入れた！",
      },
    ],
    npcs: [
      {
        id: "marsh-ferry",
        name: "霧の渡し守ユイ",
        role: "spirit",
        tx: 7,
        ty: 8,
        lines: [
          "……あら、人がここへ来るなんて珍しい。霧は、迷う者の心に寄ってくるの。",
          "この湿地の石板は、霧が晴れた時にだけ光るわ。よく探してみて。",
          "昔、金色の髪の剣士さんが、ここで道を尋ねていったわ。確か、リオ……あなたに少し似ていたかも。",
        ],
      },
    ],
    tablets: [
      {
        id: "tab-marsh",
        tx: 13,
        ty: 3,
        title: "霧の湿地の石板",
        text: "霧の中で迷う者は、己の影を見失う。影を取り戻したとき、道は開かれる。",
      },
    ],
  },
  tomb: {
    id: "tomb",
    name: "古の墓所",
    grid: [
      "RRRRRRRRRRRRRRR",
      "RfffffffffffffR",
      "RRRRRRRXRRRRRRR",
      "RfffffffffffffR",
      "pffRfRfffRfRffR",
      "pfffffffffffffR",
      "RffRfffRfffRffR",
      "RfffffffffffffR",
      "RffsffffffffsfR",
      "RfffffffffffffR",
      "RRRRRRRRRRRRRRR",
    ],
    exits: { left: "desert" },
    enemies: [
      { id: "t-k1", kind: "kagebito", x: 3 * 16, y: 7 * 16, size: 14, hp: 3, maxHp: 3, dir: "right" },
      { id: "t-d1", kind: "doromu", x: 11 * 16, y: 8 * 16, size: 14, hp: 2, maxHp: 2, dir: "left" },
      { id: "t-k2", kind: "kagebito", x: 12 * 16, y: 3 * 16, size: 14, hp: 3, maxHp: 3, dir: "down" },
    ],
    chests: [
      {
        id: "chest-tomb-heart",
        tx: 11,
        ty: 1,
        reward: "heart_container",
        message:
          "崩れた石壁の奥に隠された『命の器』を見つけた！ 最大ハートが増え、全回復した！",
      },
    ],
    npcs: [
      {
        id: "tomb-grave",
        name: "アレスの墓碑",
        role: "sign",
        tx: 7,
        ty: 5,
        lines: [
          "――翠光を守り、影に還った勇者アレスの墓。",
          "墓碑の足元には、古びた木の人形がひとつ供えられている。",
          "胸元に刻まれた字は、幼い子供の字で『パパへ』と読める。",
        ],
      },
    ],
    tablets: [
      {
        id: "tab-tomb",
        tx: 2,
        ty: 1,
        title: "アレスの遺言",
        text: "剣は鞘に納まり、光は導きとなる。リオよ、迷わず前へ進め。――アレス",
      },
    ],
  },
};

/** Every area in the order it appears in the travel journal. */
export const ROOM_ORDER: RoomId[] = [
  "village",
  "forest",
  "marsh",
  "ruins",
  "shrine",
  "desert",
  "tomb",
  "volcano",
  "cave",
  "lake",
  "tower",
];

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
      tablets: bp.tablets.map((t) => ({ ...t, found: false })),
    };
    return [bp.id, room] as const;
  });
  return Object.fromEntries(entries) as Record<RoomId, RoomRuntime>;
}
