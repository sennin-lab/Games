export type Direction = "down" | "up" | "left" | "right";

export type RoomId =
  | "village"
  | "forest"
  | "ruins"
  | "cave"
  | "lake"
  | "shrine"
  | "tower"
  | "desert"
  | "volcano"
  | "marsh"
  | "tomb";

export type TileType =
  | "grass"
  | "flower"
  | "bush"
  | "tree"
  | "water"
  | "path"
  | "wall"
  | "floor"
  | "bridge"
  | "gate"
  | "spring"
  | "crystal"
  | "lava"
  | "rock"
  | "sand"
  | "ice"
  | "crack";

export type EnemyKind = "doromu" | "togemushi" | "kagebito" | "gorda" | "hibachi" | "fuyubi";

export type DropKind = "heart" | "coin" | "shard";

/** Abilities Rio learns from NPCs during the story. */
export type AbilityId = "roll" | "bow";

export type ChestReward = "shard" | "heart_container" | "coins";

export interface PlayerState {
  x: number;
  y: number;
  dir: Direction;
  hp: number;
  maxHp: number;
  coins: number;
  shards: number;
  walkTimer: number;
  attackTimer: number;
  attackCooldown: number;
  invulnTimer: number;
  knockVx: number;
  knockVy: number;
  /** Remaining time of an active dodge roll (seconds). */
  rollTimer: number;
  rollVx: number;
  rollVy: number;
  rollCooldown: number;
  bowCooldown: number;
}

export interface Arrow {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface EnemyState {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  size: number;
  hp: number;
  maxHp: number;
  dir: Direction;
  moveTimer: number;
  hitTimer: number;
  knockVx: number;
  knockVy: number;
  dashTimer: number;
  alive: boolean;
}

export interface ChestState {
  id: string;
  tx: number;
  ty: number;
  reward: ChestReward;
  opened: boolean;
  message: string;
  /** Story flags set when the chest is opened. */
  sets?: string[];
}

/** Lore stone hidden in each area. Walking over it records it in the travel journal. */
export interface TabletState {
  id: string;
  tx: number;
  ty: number;
  title: string;
  text: string;
  found: boolean;
}

/** Alternative dialogue used once a story flag has been set. Earlier entries win. */
export interface NpcVariant {
  when: string;
  lines: string[];
}

export interface NpcState {
  id: string;
  name: string;
  role: "elder" | "smith" | "sign" | "spirit" | "fisher" | "astrologer" | "merchant";
  tx: number;
  ty: number;
  lines: string[];
  variants?: NpcVariant[];
  /** Story flags set after the first conversation. */
  sets?: string[];
  /** Ability taught on the first conversation. */
  grants?: AbilityId;
  /** The ritual keeper: talking to them with all shards starts the ending. */
  ritual?: boolean;
  /** Lines spoken during the ritual when all shards are gathered. */
  ritualLines?: string[];
}

export interface DropItem {
  id: string;
  kind: DropKind;
  x: number;
  y: number;
  bobPhase: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface RoomRuntime {
  id: RoomId;
  name: string;
  tiles: TileType[][];
  enemies: EnemyState[];
  chests: ChestState[];
  npcs: NpcState[];
  drops: DropItem[];
  tablets: TabletState[];
  exits: Partial<Record<Direction, RoomId>>;
}

export type GamePhase = "title" | "intro" | "playing" | "gameover" | "victory" | "ending";

export interface StoryPanel {
  speaker: string;
  lines: string[];
  /** Optional visual mood for the cinematic backdrop. Defaults to the scene's own mood. */
  mood?: "night" | "dawn" | "dark";
}

export const OPENING_STORY: StoryPanel[] = [
  {
    speaker: "― 遠い昔 ―",
    lines: [
      "翠星（すいせい）エルディア諸島は、三つの星のかけらが放つ翠光に守られ、永き平和を謳歌していた。",
      "しかし、ある夜、空から降りた黒き影が神殿の番人ゴルダを狂わせ、かけらを四方に散らした。",
      "翠光が消え、島には魔物が跋扈するようになった。",
    ],
    mood: "night",
  },
  {
    speaker: "― 十年前の夜 ―",
    lines: [
      "黒き影を追い、一人の剣士が北の火山へ旅立った。その名はアレス。",
      "「必ず帰る。だからリオ、良い子で待っていてくれ」",
      "それが、幼い息子と交わした最後の言葉だった。",
    ],
    mood: "dark",
  },
  {
    speaker: "― ミドリの村・森のほとり ―",
    lines: [
      "かくて十年。村の端に眠る少年リオの体に、微かな翠光が灯った。",
      "星のかけらの欠片が、彼を呼び覚ましたのだ。",
      "「……おじいさん？ この光、いったい何が起きてるの？」",
    ],
    mood: "dawn",
  },
  {
    speaker: "長老ハル",
    lines: [
      "リオよ、ついにその時が来たか。",
      "お前の体に残る翠の光は、散った星のかけらの導き。",
      "東の『ささやきの森』に一つ、北の『星見の遺跡』に一つ。",
      "そして南の『氷晶の洞窟』にも一つ眠っていると言い伝えられている。",
      "かけらが2つ揃えば翠光の神殿の封が解け、番人ゴルダに挑める。三つ目は……あやつが持っている。",
    ],
  },
  {
    speaker: "リオ",
    lines: [
      "十年前のあの夜、姿を消した父さん……",
      "ゴルダが、知っているのかもしれない。",
      "よし、行こう。この剣と、この光がある限り。",
    ],
  },
  {
    speaker: "",
    lines: ["   ― 翠星の旅人、リオの冒険が始まる ―"],
  },
];

const ENDING_STORY_BASE: StoryPanel[] = [
  {
    speaker: "リオ",
    lines: ["……ゴルダ。あなたは本当は、かけらを守っていたんだね。"],
    mood: "dark",
  },
  {
    speaker: "古の番人ゴルダ（最期の声）",
    lines: [
      "……翠光の……勇者よ……",
      "我は……十年前……黒き影に……蝕まれし……番人……",
      "お前の父……アレスは……我に挑み……我が暴走を……食い止め……",
      "自らの命と引き換えに……我を……封じたのだ……",
    ],
    mood: "dark",
  },
  {
    speaker: "リオ",
    lines: ["父さんが……ゴルダを止めるために……！"],
    mood: "dark",
  },
  {
    speaker: "ゴルダ",
    lines: [
      "アレスは……最後に……こう言い残した……",
      "「いつか翠光の導きし者が現れる……その時、我を解放せよ」と……",
      "……その者が……お前だ……リオ……",
      "三つのかけらを……揃え……翠光を……取り戻せ……",
    ],
    mood: "dawn",
  },
  {
    speaker: "リオ",
    lines: [
      "……うん。父さんの意思を、僕が引き継ぐ。",
      "三つのかけらを、翠光の塔に返せば、きっと……！",
    ],
    mood: "dawn",
  },
  {
    speaker: "",
    lines: [
      "リオは三つのかけらを手に、翠光の塔へと向かった。",
      "塔の頂でかけらが共鳴し、失われた翠光が再び島に降り注ぐ。",
      "エルディア諸島に、十年ぶりの光が戻った。",
    ],
    mood: "dawn",
  },
  {
    speaker: "― エピローグ ―",
    lines: [
      "魔物は姿を消し、村には平和が戻った。",
      "リオは父アレスの墓前に立ち、静かに剣を捧げた。",
      "「父さん、ありがとう。僕はまた旅に出るよ。この光がある限り」",
      "  ― 翠星の旅人、リオの物語は終わらない ―",
    ],
    mood: "dawn",
  },
];

/** Extra beat when Rio has read every lore stone. */
const TRUE_ENDING_PANELS: StoryPanel[] = [
  {
    speaker: "― 十一の石板 ―",
    lines: [
      "島じゅうの石板を読み終えたリオの胸に、父の言葉が静かに響いた。",
      "「影を封じたのは、誰かを救いたいと願ったからだ。お前も、同じ心で生きてくれ」",
      "父は最後まで、息子の未来を信じていたのだ。",
    ],
    mood: "dawn",
  },
  {
    speaker: "リオ",
    lines: ["……父さん。僕は、もう迷わない。"],
    mood: "dawn",
  },
];

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface GameState {
  phase: GamePhase;
  roomId: RoomId;
  rooms: Record<RoomId, RoomRuntime>;
  player: PlayerState;
  particles: Particle[];
  dialogue: { speaker: string; lines: string[]; index: number } | null;
  banner: { text: string; timer: number } | null;
  shrineUnlocked: boolean;
  bossDefeated: boolean;
  bossTalked: boolean;
  time: number;
  /** Real play time in seconds (only counted while exploring). Gates the final area. */
  playSeconds: number;
  /** True once every other area is cleared and the resonance hour has passed. */
  towerUnlocked: boolean;
  /** Travel journal overlay is open; the world is paused while it is. */
  journalOpen: boolean;
  /** Set when the ritual dialogue ends; the ending then begins. */
  pendingEnding: boolean;
  nextEntityId: number;
  intro: { story: StoryPanel[]; panelIndex: number; lineIndex: number; fade: number } | null;
  /** Rooms whose first-entry story event has already played. */
  seenRooms: Partial<Record<RoomId, true>>;
  /** Story progress flags (metNagi, gotBow, talk:<npc>, tablet:<id>, ...). */
  flags: Partial<Record<string, true>>;
  abilities: Partial<Record<AbilityId, true>>;
  arrows: Arrow[];
}

/** Story beats that play once, the first time Rio enters a room. */
export interface RoomStoryEvent {
  speaker: string;
  lines: string[];
  /** Short chapter title shown in the banner on arrival. */
  chapter: string;
}

export const ROOM_STORY_EVENTS: Partial<Record<RoomId, RoomStoryEvent>> = {
  shrine: {
    chapter: "第四章 翠光の神殿",
    speaker: "番人ゴルダ",
    lines: [
      "……来たか、星のかけらを持つ者よ。",
      "我の中の影は、お前の父が封じた今も、我を内側から責め続けている。",
      "門を開きたくば、三つのかけらを携えてこい。我を止めてくれ、リオ。",
    ],
  },
  desert: {
    chapter: "第二章 砂風の砂漠",
    speaker: "リオ",
    lines: [
      "……ここが砂風の砂漠か。父さんがこの先を旅していたなら、何か痕跡が残っているはず。",
      "砂の下から、奇妙な翠の脈動が伝わってくる……。",
    ],
  },
  volcano: {
    chapter: "第三章 灼熱の火山",
    speaker: "リオ",
    lines: [
      "熱い……。それに、この黒い靄……ゴルダを蝕んでいたものと同じだ。",
      "この火山の奥で、父さんは最後の戦いをしたんだ。",
    ],
  },
  marsh: {
    chapter: "幕間 霧の湿地",
    speaker: "リオ",
    lines: [
      "一面の霧……。どちらが北かも分からなくなりそうだ。",
      "霧の向こうから、誰かが歌うような声が聞こえる……？",
    ],
  },
  tomb: {
    chapter: "第五章 古の墓所",
    speaker: "リオ",
    lines: [
      "ここが、父さんの眠る墓所……？ 誰が、こんな遠い場所に墓を建てたんだろう。",
      "石壁の一部が、ひび割れている。奥に何かが隠されているのかもしれない。",
    ],
  },
  tower: {
    chapter: "終章 翠光の塔",
    speaker: "リオ",
    lines: [
      "ついに、ここまで来た……。島じゅうの記憶が、この塔に集まっている。",
      "三つのかけらが、共鳴を求めて震えている。",
    ],
  },
};

/**
 * Ending text with a few extra beats depending on what Rio found on the way.
 * Story flags are set by NPCs, chests and room events.
 */
export function buildEndingStory(
  flags: Partial<Record<string, true>>,
  trueEnding = false,
): StoryPanel[] {
  const panels = ENDING_STORY_BASE.map((p) => ({ ...p, lines: [...p.lines] }));
  const extra: StoryPanel[] = [];
  if (flags["sheathFound"]) {
    extra.push({
      speaker: "リオ",
      lines: ["……父さんの剣の鞘。ずっと、僕がここへ来るのを待っていてくれたんだね。"],
      mood: "dawn",
    });
  }
  if (flags["gotBow"]) {
    extra.push({
      speaker: "リオ",
      lines: ["翠光の弓が、かけらと共鳴している……。影を射抜いたのは、この光だ。"],
      mood: "dawn",
    });
  }
  // Insert right after Gorda's last voice (index 1), before Rio's reply.
  if (extra.length > 0) panels.splice(2, 0, ...extra);
  if (trueEnding) {
    // Just before the epilogue: the father's words from every stone.
    panels.splice(panels.length - 1, 0, ...TRUE_ENDING_PANELS.map((p) => ({ ...p, lines: [...p.lines] })));
  }
  return panels;
}

export const ENDING_STORY = ENDING_STORY_BASE;
