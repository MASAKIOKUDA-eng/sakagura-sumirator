/**
 * 醸造エンジン（フロントエンドと Lambda で共有）
 *
 * 純粋関数のみ。同じシードと判断からは必ず同じ結果になるため、
 * サーバー側で再計算してスコアの改ざんを防げる。
 */

export const VETERANS = ['kashira', 'koji', 'moto', 'kama'] as const;
export const RICES = ['yamadanishiki', 'omachi', 'gohyakumangoku', 'miyamanishiki', 'hanmai'] as const;
export const POLISHES = [35, 50, 60, 70] as const;
export const SOAKS = [0, 1, 2] as const;
export const KOJI_STYLES = ['tsukihaze', 'sohaze'] as const;
export const DEKOJI_HOURS = [40, 45, 50] as const;
export const SHUBOS = ['sokujo', 'kimoto', 'yamahai'] as const;
export const YEASTS = ['k7', 'k9', 'k1801'] as const;
export const TEMP_ACTIONS = [-1, 0, 1] as const;
export const PRESS_TIMINGS = ['early', 'standard', 'late'] as const;
export const ALCOHOLS = ['none', 'added'] as const;
export const PRESS_METHODS = ['fukuro', 'fune', 'yabuta'] as const;
export const HIIRES = ['nama', 'once', 'twice'] as const;
export const ORDERS = ['competition', 'shokuchu', 'kanzake', 'banshaku'] as const;
export const HARDNESSES = ['soft', 'normal', 'hard'] as const;
export const WINTERS = ['cold', 'normal', 'warm'] as const;

export type Veteran = (typeof VETERANS)[number];
export type Rice = (typeof RICES)[number];
export type Polish = (typeof POLISHES)[number];
export type Soak = (typeof SOAKS)[number];
export type KojiStyle = (typeof KOJI_STYLES)[number];
export type DekojiHours = (typeof DEKOJI_HOURS)[number];
export type Shubo = (typeof SHUBOS)[number];
export type Yeast = (typeof YEASTS)[number];
export type TempAction = (typeof TEMP_ACTIONS)[number];
export type PressTiming = (typeof PRESS_TIMINGS)[number];
export type Alcohol = (typeof ALCOHOLS)[number];
export type PressMethod = (typeof PRESS_METHODS)[number];
export type Hiire = (typeof HIIRES)[number];
export type OrderId = (typeof ORDERS)[number];
export type Hardness = (typeof HARDNESSES)[number];
export type Winter = (typeof WINTERS)[number];

export interface Decisions {
  veteran: Veteran;
  rice: Rice;
  polish: Polish;
  soak: Soak;
  koji: KojiStyle;
  dekoji: DekojiHours;
  shubo: Shubo;
  yeast: Yeast;
  moromi: [TempAction, TempAction, TempAction];
  pressTiming: PressTiming;
  alcohol: Alcohol;
  press: PressMethod;
  hiire: Hiire;
}

export interface Conditions {
  seed: number;
  hardness: Hardness;
  winter: Winter;
  order: OrderId;
}

export type Tone = 'good' | 'warn' | 'bad';
export interface Feedback {
  stage: string;
  tone: Tone;
  text: string;
}

export interface MoromiPoint {
  day: number;
  temp: number;
  idealTemp: number;
  baume: number;
  alcohol: number;
}

export interface BrewResult {
  className: string;
  flavorType: string;
  servingTip: string;
  aroma: number;
  umami: number;
  kire: number;
  clean: number;
  smv: number;
  acidity: number;
  amino: number;
  alcohol: number;
  costIndex: number;
  fitness: number;
  score: number;
  rank: string;
  moromi: MoromiPoint[];
  feedback: Feedback[];
}

export const MAX_SEED = 2 ** 31 - 1;

// ---------- 乱数・ユーティリティ ----------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const pick = <T>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)];

// ---------- 条件 ----------

export function conditionsFromSeed(seed: number): Conditions {
  const rng = mulberry32(seed);
  return {
    seed,
    hardness: pick(rng, HARDNESSES),
    winter: pick(rng, WINTERS),
    order: pick(rng, ORDERS),
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * MAX_SEED) + 1;
}

/** 浸漬時間（分）。精米歩合が高い（よく磨いた）米ほど短時間で水を吸う。 */
export function soakMinutes(polish: Polish): readonly [number, number, number] {
  if (polish <= 50) return [6, 9, 12];
  if (polish === 60) return [10, 15, 20];
  return [20, 40, 60];
}

export function idealSoak(c: Conditions): Soak {
  return c.hardness === 'soft' ? 0 : c.hardness === 'normal' ? 1 : 2;
}

export function idealDekoji(c: Conditions): DekojiHours {
  return c.hardness === 'hard' ? 50 : 45;
}

// ---------- 醪（もろみ）の推移 ----------

const WINTER_OFFSET: Record<Winter, number> = { cold: -2, normal: 0, warm: 2 };
const BASELINE_TEMP = [9, 12, 11];
const BAUME_DROP = [2.8, 3.0, 2.5];
export const START_BAUME = 8;
const MIN_BAUME = -1.5;

export function isGinjoStyle(polish: Polish): boolean {
  return polish <= 60;
}

export function idealTemps(polish: Polish): number[] {
  return isGinjoStyle(polish) ? [8, 10, 9] : [10, 13, 12];
}

export function checkpointDays(polish: Polish): number[] {
  return isGinjoStyle(polish) ? [6, 16, 30] : [5, 12, 21];
}

export function alcoholFromBaume(baume: number): number {
  return round1(clamp((START_BAUME - baume) * 2.1, 0, 20.5));
}

/** 操作前の品温（その時点までの判断を反映した予測） */
export function moromiTempBefore(c: Conditions, actions: readonly TempAction[], index: number): number {
  const applied = actions.slice(0, index).reduce<number>((s, a) => s + a, 0);
  return round1(BASELINE_TEMP[index] + WINTER_OFFSET[c.winter] + 1.5 * applied);
}

/**
 * 留添え（day 4）から各チェックポイントまでの推移。
 * actions は 0〜3 個（途中経過の表示にも使う）。
 */
export function moromiTrace(c: Conditions, polish: Polish, actions: readonly TempAction[]): MoromiPoint[] {
  const ideals = idealTemps(polish);
  const days = checkpointDays(polish);
  const points: MoromiPoint[] = [
    { day: 4, temp: round1(7 + WINTER_OFFSET[c.winter] / 2), idealTemp: 7, baume: START_BAUME, alcohol: 0 },
  ];
  let baume = START_BAUME;
  for (let i = 0; i < actions.length && i < 3; i++) {
    // 操作後の品温 = 操作しなかった場合の予測 + 今回の操作
    const t = round1(moromiTempBefore(c, actions, i) + 1.5 * actions[i]);
    const rate = clamp(1 + 0.15 * (t - ideals[i]), 0.35, 1.8);
    // 糖を食べ尽くすとボーメはそれ以上下がらない
    baume = round1(Math.max(MIN_BAUME, baume - BAUME_DROP[i] * rate));
    points.push({ day: days[i], temp: t, idealTemp: ideals[i], baume, alcohol: alcoholFromBaume(baume) });
  }
  return points;
}

// ---------- 検証 ----------

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function oneOf<T>(list: readonly T[], v: unknown): v is T {
  return (list as readonly unknown[]).includes(v);
}

export function validateDecisions(input: unknown): ValidationResult<Decisions> {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'decisions must be an object' };
  const d = input as Record<string, unknown>;
  const checks: [string, readonly unknown[]][] = [
    ['veteran', VETERANS],
    ['rice', RICES],
    ['polish', POLISHES],
    ['soak', SOAKS],
    ['koji', KOJI_STYLES],
    ['dekoji', DEKOJI_HOURS],
    ['shubo', SHUBOS],
    ['yeast', YEASTS],
    ['pressTiming', PRESS_TIMINGS],
    ['alcohol', ALCOHOLS],
    ['press', PRESS_METHODS],
    ['hiire', HIIRES],
  ];
  for (const [key, list] of checks) {
    if (!oneOf(list, d[key])) return { ok: false, error: `invalid ${key}` };
  }
  const m = d.moromi;
  if (!Array.isArray(m) || m.length !== 3 || !m.every((a) => oneOf(TEMP_ACTIONS, a))) {
    return { ok: false, error: 'invalid moromi' };
  }
  const value: Decisions = {
    veteran: d.veteran as Veteran,
    rice: d.rice as Rice,
    polish: d.polish as Polish,
    soak: d.soak as Soak,
    koji: d.koji as KojiStyle,
    dekoji: d.dekoji as DekojiHours,
    shubo: d.shubo as Shubo,
    yeast: d.yeast as Yeast,
    moromi: [m[0], m[1], m[2]] as [TempAction, TempAction, TempAction],
    pressTiming: d.pressTiming as PressTiming,
    alcohol: d.alcohol as Alcohol,
    press: d.press as PressMethod,
    hiire: d.hiire as Hiire,
  };
  return { ok: true, value };
}

export function validateSeed(input: unknown): input is number {
  return typeof input === 'number' && Number.isInteger(input) && input >= 1 && input <= MAX_SEED;
}

// ---------- 酒質計算 ----------

const AROMA_BY_POLISH: Record<Polish, number> = { 35: 62, 50: 52, 60: 40, 70: 26 };
const UMAMI_BY_POLISH: Record<Polish, number> = { 35: 22, 50: 32, 60: 44, 70: 56 };
const KIRE_BY_POLISH: Record<Polish, number> = { 35: 58, 50: 55, 60: 52, 70: 46 };
const CLEAN_BY_POLISH: Record<Polish, number> = { 35: 12, 50: 8, 60: 3, 70: -4 };
const RICE_PRICE: Record<Rice, number> = { yamadanishiki: 100, omachi: 95, gohyakumangoku: 70, miyamanishiki: 70, hanmai: 40 };

export function className(polish: Polish, alcohol: Alcohol): string {
  const junmai = alcohol === 'none';
  if (polish <= 50) return junmai ? '純米大吟醸酒' : '大吟醸酒';
  if (polish === 60) return junmai ? '純米吟醸酒' : '吟醸酒';
  return junmai ? '純米酒' : '本醸造酒';
}

export function rankOf(score: number): string {
  if (score >= 85) return '金賞級';
  if (score >= 72) return '入賞級';
  if (score >= 58) return '蔵の定番級';
  return '修行中';
}

interface Target {
  key: 'aroma' | 'umami' | 'kire' | 'clean' | 'acidity' | 'costIndex';
  op: 'min' | 'max' | 'near';
  value: number;
  tol?: number;
  weight: number;
  message: string;
}

export const ORDER_TARGETS: Record<OrderId, Target[]> = {
  competition: [
    { key: 'aroma', op: 'min', value: 78, weight: 1.2, message: '鑑評会では華やかな吟醸香が求められます（香り 78 以上）' },
    { key: 'clean', op: 'min', value: 85, weight: 1.2, message: '雑味のない綺麗な酒質が必須です（綺麗さ 85 以上）' },
    { key: 'umami', op: 'max', value: 45, weight: 0.6, message: '旨味が重すぎると香りを邪魔します（旨味 45 以下）' },
  ],
  shokuchu: [
    { key: 'aroma', op: 'near', value: 45, tol: 12, weight: 0.8, message: '香りは料理の邪魔をしない程度に（香り 33〜57）' },
    { key: 'umami', op: 'near', value: 55, tol: 12, weight: 0.8, message: '料理に寄り添うほどよい旨味を（旨味 43〜67）' },
    { key: 'kire', op: 'min', value: 65, weight: 1.0, message: '後味のキレで次の一口を誘います（キレ 65 以上）' },
    { key: 'acidity', op: 'near', value: 1.55, tol: 0.2, weight: 40, message: '酸が料理の脂を切ります（酸度 1.35〜1.75）' },
  ],
  kanzake: [
    { key: 'umami', op: 'min', value: 72, weight: 1.2, message: '燗で膨らむ旨味が主役です（旨味 72 以上）' },
    { key: 'acidity', op: 'min', value: 1.7, weight: 40, message: '燗映えにはしっかりした酸が必要です（酸度 1.7 以上）' },
    { key: 'aroma', op: 'max', value: 45, weight: 0.8, message: '華やかな香りは燗にすると崩れます（香り 45 以下）' },
  ],
  banshaku: [
    { key: 'costIndex', op: 'max', value: 30, weight: 1.2, message: '手頃な価格に収まる原価で（原価指数 30 以下）' },
    { key: 'kire', op: 'min', value: 62, weight: 1.0, message: '毎日飲み飽きないキレを（キレ 62 以上）' },
    { key: 'clean', op: 'min', value: 62, weight: 0.8, message: '安くても雑味は許されません（綺麗さ 62 以上）' },
  ],
};

function evaluateOrder(order: OrderId, m: Record<Target['key'], number>, feedback: Feedback[]): number {
  let fitness = 100;
  for (const t of ORDER_TARGETS[order]) {
    const v = m[t.key];
    let gap = 0;
    if (t.op === 'min') gap = Math.max(0, t.value - v);
    else if (t.op === 'max') gap = Math.max(0, v - t.value);
    else gap = Math.max(0, Math.abs(v - t.value) - (t.tol ?? 0));
    if (gap > 0) {
      fitness -= gap * t.weight;
      feedback.push({ stage: '蔵元の注文', tone: gap * t.weight > 12 ? 'bad' : 'warn', text: t.message });
    }
  }
  return Math.round(clamp(fitness, 0, 100));
}

export function simulate(c: Conditions, d: Decisions): BrewResult {
  const fb: Feedback[] = [];
  const noise = mulberry32((c.seed ^ 0x9e3779b9) >>> 0);
  const jitter = () => (noise() - 0.5) * 4;

  let aroma = AROMA_BY_POLISH[d.polish];
  let umami = UMAMI_BY_POLISH[d.polish];
  let kire = KIRE_BY_POLISH[d.polish];
  let clean = 70 + CLEAN_BY_POLISH[d.polish];
  let acidity = 1.3;
  let amino = { 35: 0.8, 50: 1.0, 60: 1.2, 70: 1.4 }[d.polish];

  // 蔵人の配置
  const kamaF = d.veteran === 'kama' ? 0.5 : 1;
  const kojiF = d.veteran === 'koji' ? 0.5 : 1;
  const motoF = d.veteran === 'moto' ? 0.4 : 1;
  const kashiraF = d.veteran === 'kashira' ? 0.6 : 1;

  // 原料米
  aroma += { yamadanishiki: 6, omachi: 3, gohyakumangoku: 2, miyamanishiki: 2, hanmai: -6 }[d.rice];
  umami += { yamadanishiki: 6, omachi: 12, gohyakumangoku: 0, miyamanishiki: 2, hanmai: 4 }[d.rice];
  kire += { yamadanishiki: 2, omachi: -4, gohyakumangoku: 8, miyamanishiki: 5, hanmai: -2 }[d.rice];
  if (d.rice === 'hanmai') {
    clean -= 8;
    acidity += 0.1;
    fb.push({ stage: '原料米', tone: 'warn', text: '飯米は心白がなく溶けにくいため雑味が出やすい一方、原価は抑えられます。' });
  }
  if (d.rice === 'yamadanishiki' && d.polish <= 50) {
    fb.push({ stage: '原料米', tone: 'good', text: '「酒米の王様」山田錦を高精白。大吟醸の王道の組み合わせです。' });
  }

  // 洗米・浸漬（米の硬さを読む）
  const soakDiff = d.soak - idealSoak(c);
  if (soakDiff > 0) {
    clean -= 12 * soakDiff * kamaF;
    umami += 4 * soakDiff;
    fb.push({ stage: '洗米・浸漬', tone: soakDiff * kamaF >= 1 ? 'bad' : 'warn', text: '吸水させすぎて蒸米が柔らかくなり、雑味が出ました。杜氏は米の硬さを見て秒単位で吸水を管理します。' });
  } else if (soakDiff < 0) {
    clean -= 8 * -soakDiff * kamaF;
    kire += 3;
    fb.push({ stage: '洗米・浸漬', tone: 'warn', text: '吸水不足で蒸米が硬く、醪で溶けにくくなりました。今年の米の硬さに合わせましょう。' });
  } else {
    clean += 3;
    fb.push({ stage: '洗米・浸漬', tone: 'good', text: '米の硬さを見極めた理想的な吸水。外硬内軟の良い蒸米になりました。' });
  }
  if (d.veteran === 'kama') clean += 2;

  // 製麹
  if (d.koji === 'tsukihaze') {
    aroma += 6;
    kire += 5;
    if (!isGinjoStyle(d.polish)) {
      umami -= 4;
      fb.push({ stage: '製麹', tone: 'warn', text: '突きハゼ麹は吟醸造り向き。精米歩合 70% の酒では旨味が物足りなくなります。' });
    }
  } else {
    umami += 12;
    aroma -= 3;
    amino += 0.3;
    acidity += 0.1;
    if (isGinjoStyle(d.polish)) {
      clean -= 4;
      fb.push({ stage: '製麹', tone: 'warn', text: '総ハゼ麹は力強い分、吟醸造りでは香りを覆い重さが出ます。' });
    }
  }
  const dekojiDiff = Math.abs(d.dekoji - idealDekoji(c)) / 5;
  if (dekojiDiff > 0) {
    clean -= 10 * dekojiDiff * kojiF;
    fb.push({
      stage: '製麹',
      tone: dekojiDiff * kojiF >= 1 ? 'bad' : 'warn',
      text: c.hardness === 'hard' ? '硬い米は菌糸が中まで入りにくく、出麹を遅らせる判断が必要でした。' : '出麹の時間が麹の出来に合っていませんでした。',
    });
  }
  if (d.dekoji === 50) {
    umami += 6;
    amino += 0.2;
  } else if (d.dekoji === 40) {
    umami -= 5;
    aroma += 2;
  }
  if (d.veteran === 'koji') {
    aroma += 3;
    umami += 3;
  }

  // 酒母
  if (d.shubo === 'sokujo') {
    aroma += 3;
    kire += 4;
  } else {
    acidity += d.shubo === 'kimoto' ? 0.35 : 0.45;
    umami += d.shubo === 'kimoto' ? 14 : 18;
    amino += 0.4;
    if (d.shubo === 'yamahai') aroma -= 4;
    else kire += 3;
    const risk = { cold: 0, normal: 5, warm: 15 }[c.winter] * motoF;
    if (risk > 0) {
      clean -= risk;
      fb.push({
        stage: '酒母',
        tone: risk >= 10 ? 'bad' : 'warn',
        text: '暖冬で生酛系酒母の乳酸菌管理が難しく、雑菌の影響が出ました。酛屋の腕の見せ所です。',
      });
    } else {
      fb.push({ stage: '酒母', tone: 'good', text: '寒い冬を活かし、生酛系の酒母が健全に育ちました。' });
    }
  }
  if (d.veteran === 'moto') clean += 2;

  // 酵母
  aroma += { k7: 4, k9: 12, k1801: 22 }[d.yeast];
  umami += { k7: 4, k9: 0, k1801: -4 }[d.yeast];
  kire += { k7: 0, k9: 3, k1801: 0 }[d.yeast];
  acidity += { k7: 0.05, k9: 0, k1801: -0.1 }[d.yeast];
  const yeastSens = { k7: 0.8, k9: 1, k1801: 1.2 }[d.yeast] * kashiraF;

  // 醪
  const trace = moromiTrace(c, d.polish, d.moromi);
  let overheated = false;
  let stalled = false;
  for (const p of trace.slice(1)) {
    const diff = p.temp - p.idealTemp;
    if (diff > 1) {
      const e = diff - 1;
      clean -= e * 6 * yeastSens;
      aroma -= e * 5;
      umami += e * 2;
      acidity += e * 0.08;
      amino += e * 0.1;
      overheated = true;
    } else if (diff < -1) {
      const e = -diff - 1;
      aroma += Math.min(e, 1.5) * 3;
      if (-diff > 2.5) {
        clean -= (-diff - 2.5) * 10 * yeastSens;
        acidity += 0.1;
        stalled = true;
      }
    } else {
      clean += 1;
    }
  }
  if (overheated) fb.push({ stage: '醪', tone: 'bad', text: '品温が上がりすぎ、香りが飛んで酸と雑味が増えました。暖冬の年は早めに冷やす判断が要ります。' });
  if (stalled) fb.push({ stage: '醪', tone: 'bad', text: '品温が低すぎて発酵が停滞しました。酵母が弱り、甘く重たい酒になっています。' });
  if (!overheated && !stalled) fb.push({ stage: '醪', tone: 'good', text: '品温をよく管理し、ボーメとアルコールが計画通りに推移しました。' });

  // 上槽・アル添・搾り
  let baume = Math.max(
    MIN_BAUME - 0.3,
    trace[trace.length - 1].baume + { early: 0.5, standard: 0, late: -0.5 }[d.pressTiming],
  );
  umami += { early: 6, standard: 0, late: -6 }[d.pressTiming];
  kire += { early: -8, standard: 0, late: 10 }[d.pressTiming];
  if (d.pressTiming === 'late' && overheated) {
    clean -= 5;
    fb.push({ stage: '上槽', tone: 'warn', text: '発酵が進みすぎた醪をさらに引っ張り、酵母の自己消化臭が出かけています。' });
  }
  if (d.alcohol === 'added') {
    aroma += 6;
    umami -= 10;
    kire += 12;
  }
  aroma += { fukuro: 7, fune: 3, yabuta: 0 }[d.press];
  umami += { fukuro: -2, fune: 3, yabuta: 0 }[d.press];
  kire += { fukuro: 0, fune: 0, yabuta: 2 }[d.press];
  clean += { fukuro: 6, fune: 3, yabuta: 0 }[d.press];

  // 火入れ
  aroma += { nama: 4, once: 1, twice: -5 }[d.hiire];
  umami += { nama: 0, once: 0, twice: 2 }[d.hiire];
  kire += { nama: 0, once: 0, twice: 4 }[d.hiire];

  const genshu = alcoholFromBaume(baume);
  baume = round1(baume);
  const smv = Math.round(-10 * baume + (d.alcohol === 'added' ? 3 : 0));
  const alcohol = round1(clamp(genshu - 1.5 + (d.alcohol === 'added' ? 0.5 : 0), 13, 17.5));

  // 原価
  // 削った分だけ玄米が多く必要になり、精米の時間もかかるため指数的に高くなる
  const costRaw = RICE_PRICE[d.rice] / (d.polish / 100) ** 1.5;
  let costIndex = ((costRaw - 50) / 400) * 100;
  if (d.press === 'fukuro') costIndex += 15;
  if (d.shubo !== 'sokujo') costIndex += 8;
  if (isGinjoStyle(d.polish)) costIndex += 5;
  if (d.alcohol === 'added' && !isGinjoStyle(d.polish)) costIndex -= 5;
  costIndex = Math.round(clamp(costIndex, 0, 100));

  const m = {
    aroma: Math.round(clamp(aroma + jitter(), 0, 100)),
    umami: Math.round(clamp(umami + jitter(), 0, 100)),
    kire: Math.round(clamp(kire + jitter(), 0, 100)),
    clean: Math.round(clamp(clean + jitter(), 0, 100)),
    acidity: round1(clamp(acidity, 0.8, 2.8)),
    costIndex,
  };

  const fitness = evaluateOrder(c.order, m, fb);
  const individuality = Math.max(m.aroma, m.umami, m.kire);
  const score = Math.round(0.45 * m.clean + 0.45 * fitness + 0.1 * individuality);

  let flavorType = '爽酒';
  let servingTip = '冷やして（10℃前後）、さっぱりした料理と。';
  if (m.aroma >= 55 && m.aroma >= m.umami) {
    flavorType = '薫酒';
    servingTip = 'ワイングラスで冷やして（10〜15℃）、香りを楽しんで。';
  } else if (m.umami >= 55) {
    flavorType = '醇酒';
    servingTip = 'ぬる燗（40℃）〜常温で、味の濃い料理と。';
  }

  return {
    className: className(d.polish, d.alcohol),
    flavorType,
    servingTip,
    aroma: m.aroma,
    umami: m.umami,
    kire: m.kire,
    clean: m.clean,
    smv,
    acidity: m.acidity,
    amino: round1(clamp(amino, 0.5, 3)),
    alcohol,
    costIndex,
    fitness,
    score,
    rank: rankOf(score),
    moromi: trace,
    feedback: fb,
  };
}
