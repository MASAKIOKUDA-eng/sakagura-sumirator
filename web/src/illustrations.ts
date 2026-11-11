/**
 * 酒蔵のイラスト（すべてこのアプリ用に描いた SVG）。
 * 色は墨・藍・木・藁・朱・杉の 6 系統に絞り、線は墨色で太さをそろえる。
 */

const INK = '#1d1b18';
const AI = '#1f3a5f'; // 藍
const AI_DEEP = '#162a45';
const WOOD = '#c48a4c';
const WOOD_DARK = '#8a5a2b';
const STRAW = '#ecdcae';
const STRAW_DARK = '#c9ae6a';
const SHU = '#b4322a'; // 朱
const SUGI = '#5b7a3a'; // 杉
const SUGI_DARK = '#3f5a26';
const SKIN = '#f2d6b8';
const PAPER = '#ffffff';

const svg = (viewBox: string, body: string, label?: string, cls = '') =>
  `<svg class="illust ${cls}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" ${
    label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"'
  } fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** 杜氏：鉢巻・法被・前掛け姿で櫂を持つ */
export function toji(label = '櫂を持つ杜氏'): string {
  return svg(
    '0 0 200 300',
    `
    <!-- 櫂 -->
    <line x1="166" y1="22" x2="166" y2="276" stroke="${WOOD_DARK}" stroke-width="5"/>
    <rect x="148" y="270" width="36" height="16" rx="2" fill="${WOOD}"/>
    <!-- 足と雪駄 -->
    <path d="M82 262 V286 M110 262 V286" stroke-width="9" stroke="${AI_DEEP}"/>
    <path d="M70 290 h22 M100 290 h22" stroke-width="4"/>
    <!-- 法被 -->
    <path d="M58 100 Q96 88 134 100 L148 222 Q96 232 44 222 Z" fill="${AI}"/>
    <!-- 襟 -->
    <path d="M84 96 L98 150 L112 96" stroke="${PAPER}" stroke-width="7"/>
    <path d="M84 96 L98 150 L112 96" stroke-width="1.2"/>
    <!-- 前掛け -->
    <path d="M64 156 H132 L128 268 H68 Z" fill="${AI_DEEP}"/>
    <path d="M58 156 H138" stroke-width="3"/>
    <text x="98" y="222" text-anchor="middle" font-family="'Noto Serif JP','Yu Mincho',serif" font-size="38" font-weight="800" fill="${PAPER}" stroke="none">酒</text>
    <!-- 腕 -->
    <path d="M132 108 Q156 120 162 136" stroke="${AI}" stroke-width="16"/>
    <path d="M62 112 Q72 150 120 160 Q144 160 160 168" stroke="${AI}" stroke-width="16"/>
    <circle cx="166" cy="140" r="7.5" fill="${SKIN}"/>
    <circle cx="166" cy="172" r="7.5" fill="${SKIN}"/>
    <!-- 首と頭 -->
    <rect x="90" y="80" width="16" height="16" fill="${SKIN}" stroke="none"/>
    <circle cx="98" cy="58" r="26" fill="${SKIN}"/>
    <path d="M73 52 Q76 30 98 30 Q120 30 123 52 Q112 42 98 43 Q84 42 73 52 Z" fill="${INK}"/>
    <!-- 鉢巻 -->
    <path d="M72 50 Q98 40 124 50" stroke="${PAPER}" stroke-width="7"/>
    <path d="M72 46 Q98 36 124 46 M72 54 Q98 44 124 54" stroke-width="1.2"/>
    <path d="M124 48 l12 -6 M124 50 l13 4" stroke-width="3"/>
    <!-- 顔 -->
    <path d="M88 62 h6 M104 62 h6" stroke-width="2.6"/>
    <path d="M92 74 Q98 78 104 74" stroke-width="1.8"/>
    `,
    label,
    'toji',
  );
}

/** 菰樽：藁で包み縄を掛けた酒樽 */
export function taru(label = '菰樽', mark = '銘酒'): string {
  const ropes = [0, 1, 2, 3, 4, 5, 6]
    .map((i) => `<path d="M${26 + i * 18} 50 l9 12 l9 -12" stroke="${WOOD_DARK}" stroke-width="2"/>`)
    .join('');
  const ropesBottom = [0, 1, 2, 3, 4, 5, 6]
    .map((i) => `<path d="M${26 + i * 18} 148 l9 -12 l9 12" stroke="${WOOD_DARK}" stroke-width="2"/>`)
    .join('');
  const straws = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    .map((i) => `<line x1="${30 + i * 10}" y1="66" x2="${30 + i * 10}" y2="132" stroke="${STRAW_DARK}" stroke-width="1.2"/>`)
    .join('');
  return svg(
    '0 0 180 170',
    `
    <path d="M22 44 Q22 30 90 30 Q158 30 158 44 V150 Q158 162 90 162 Q22 162 22 150 Z" fill="${STRAW}"/>
    ${straws}
    <ellipse cx="90" cy="40" rx="64" ry="11" fill="${WOOD}"/>
    <ellipse cx="90" cy="40" rx="50" ry="7" stroke="${WOOD_DARK}" stroke-width="1.4"/>
    ${ropes}${ropesBottom}
    <rect x="66" y="70" width="48" height="62" fill="${PAPER}"/>
    <rect x="70" y="74" width="40" height="54" stroke="${SHU}" stroke-width="1.6"/>
    <text x="90" y="98" text-anchor="middle" font-family="'Noto Serif JP','Yu Mincho',serif" font-size="18" font-weight="800" fill="${SHU}" stroke="none">${mark.slice(0, 1)}</text>
    <text x="90" y="120" text-anchor="middle" font-family="'Noto Serif JP','Yu Mincho',serif" font-size="18" font-weight="800" fill="${SHU}" stroke="none">${mark.slice(1, 2)}</text>
    `,
    label,
    'taru',
  );
}

/** 杉玉：新酒ができたことを知らせる酒蔵の目印 */
export function sugidama(label = '杉玉'): string {
  const tufts = [
    [50, 62], [36, 74], [64, 74], [28, 92], [50, 88], [72, 92], [36, 108], [62, 108], [50, 122], [44, 100], [58, 98],
  ]
    .map(([x, y]) => `<path d="M${x - 5} ${y + 2} l5 -6 l5 6" stroke="${SUGI_DARK}" stroke-width="1.6"/>`)
    .join('');
  return svg(
    '0 0 100 160',
    `
    <line x1="50" y1="0" x2="50" y2="50" stroke="${WOOD_DARK}" stroke-width="3"/>
    <circle cx="50" cy="92" r="40" fill="${SUGI}"/>
    ${tufts}
    <line x1="50" y1="132" x2="50" y2="140" stroke="${WOOD_DARK}" stroke-width="2"/>
    <rect x="40" y="140" width="20" height="18" fill="${WOOD}" stroke-width="1.6"/>
    `,
    label,
    'sugidama',
  );
}

/** 米俵 */
function tawara(): string {
  return svg(
    '0 0 120 100',
    `
    <rect x="14" y="26" width="92" height="56" rx="26" fill="${STRAW}"/>
    <ellipse cx="22" cy="54" rx="10" ry="27" fill="${STRAW_DARK}"/>
    <ellipse cx="98" cy="54" rx="10" ry="27" fill="${STRAW_DARK}"/>
    <path d="M40 27 V82 M60 26 V82 M80 27 V82" stroke="${WOOD_DARK}" stroke-width="3"/>
    <path d="M34 40 h52 M34 68 h52" stroke="${STRAW_DARK}" stroke-width="1.2"/>
    `,
  );
}

/** 麹蓋（麹を育てる木の箱）と麹 */
function kojibuta(): string {
  const grains = [
    [36, 46], [48, 42], [60, 40], [72, 42], [84, 46], [42, 54], [54, 50], [66, 50], [78, 54], [60, 58],
  ]
    .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3.4" fill="${PAPER}" stroke-width="1.4"/>`)
    .join('');
  return svg(
    '0 0 120 100',
    `
    <path d="M24 60 Q60 22 96 60" fill="#f5f2ea"/>
    ${grains}
    <path d="M10 60 H110 L102 80 H18 Z" fill="${WOOD}"/>
    <path d="M18 70 H102" stroke="${WOOD_DARK}" stroke-width="1.4"/>
    `,
  );
}

/** 木桶（櫂を入れた醪・酒母のタンク） */
function oke(withKai = true, small = false): string {
  const w = small ? 64 : 84;
  const x = 60 - w / 2;
  const staves = Array.from({ length: small ? 4 : 6 }, (_, i) => x + ((i + 1) * w) / (small ? 5 : 7))
    .map((sx) => `<line x1="${sx}" y1="${small ? 52 : 34}" x2="${sx}" y2="88" stroke="${WOOD_DARK}" stroke-width="1.2"/>`)
    .join('');
  const top = small ? 52 : 34;
  return svg(
    '0 0 120 100',
    `
    ${withKai ? `<line x1="78" y1="4" x2="58" y2="${top + 8}" stroke="${WOOD_DARK}" stroke-width="4"/>` : ''}
    <path d="M${x} ${top} H${x + w} L${x + w - 6} 90 H${x + 6} Z" fill="${WOOD}"/>
    ${staves}
    <path d="M${x + 1} ${top + 10} H${x + w - 1} M${x + 4} 78 H${x + w - 4}" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="60" cy="${top}" rx="${w / 2}" ry="6" fill="#f7f3e8"/>
    <circle cx="${52}" cy="${top - 1}" r="2.4" fill="${PAPER}" stroke-width="1"/>
    <circle cx="${66}" cy="${top}" r="3" fill="${PAPER}" stroke-width="1"/>
    `,
  );
}

/** 甑（米を蒸す道具）と湯気 */
function koshiki(): string {
  return svg(
    '0 0 120 100',
    `
    <path d="M44 26 q-6 -8 0 -14 M60 24 q-6 -8 0 -16 M76 26 q-6 -8 0 -14" stroke="#9aa3ad" stroke-width="2"/>
    <path d="M28 36 H92 L86 70 H34 Z" fill="${WOOD}"/>
    <path d="M28 44 H92" stroke="${INK}" stroke-width="3"/>
    <path d="M20 70 H100 Q100 90 60 90 Q20 90 20 70 Z" fill="#3b3b3b"/>
    <path d="M24 70 h-8 M96 70 h8" stroke-width="3"/>
    `,
  );
}

/** 袋吊り：吊るした酒袋から雫が落ちる */
function fukurozuri(): string {
  return svg(
    '0 0 120 100',
    `
    <line x1="20" y1="8" x2="100" y2="8" stroke="${WOOD_DARK}" stroke-width="4"/>
    <path d="M44 8 V16 M76 8 V16" stroke-width="1.6"/>
    <path d="M36 16 H52 Q54 50 44 56 Q34 50 36 16 Z" fill="#f4efe1"/>
    <path d="M68 16 H84 Q86 50 76 56 Q66 50 68 16 Z" fill="#f4efe1"/>
    <path d="M44 62 q-3 5 0 7 q3 -2 0 -7 Z M76 66 q-3 5 0 7 q3 -2 0 -7 Z" fill="#cfe3f0" stroke-width="1.2"/>
    <path d="M24 74 H96 L92 94 H28 Z" fill="${WOOD}"/>
    <ellipse cx="60" cy="76" rx="34" ry="3" fill="#e9f2f7" stroke-width="1"/>
    `,
  );
}

/** 徳利とお猪口 */
function tokkuri(): string {
  return svg(
    '0 0 120 100',
    `
    <path d="M44 10 h14 v8 q-2 6 6 16 q12 16 6 36 q-6 20 -19 20 q-13 0 -19 -20 q-6 -20 6 -36 q8 -10 6 -16 Z" fill="#f4efe6"/>
    <path d="M36 54 q15 6 30 0" stroke="${AI}" stroke-width="3"/>
    <path d="M78 66 h26 l-4 20 h-18 Z" fill="#f4efe6"/>
    <ellipse cx="91" cy="72" rx="7" ry="3" stroke="${AI}" stroke-width="2"/>
    `,
  );
}

/** 工程ごとの小さな挿絵（仕込み暦・各ステップの見出し用） */
export const PHASE_ICONS: Record<string, () => string> = {
  蔵入り: () => sugidama(''),
  原料処理: tawara,
  製麹: kojibuta,
  酒母: () => oke(false, true),
  醪: () => oke(true),
  上槽: fukurozuri,
  '火入れ・貯蔵': () => taru(''),
  完成: tokkuri,
};

/** 蔵人の持ち場ごとの挿絵 */
export const ROLE_ICONS: Record<string, () => string> = {
  toji: () => toji(''),
  kashira: () => oke(true),
  koji: kojibuta,
  moto: () => oke(false, true),
  kama: koshiki,
};

/** トップの情景：杉玉の下で樽の横に立つ杜氏 */
export function heroScene(): string {
  return `<div class="scene" role="img" aria-label="杉玉が下がる酒蔵の前で、櫂を持って立つ杜氏と菰樽">
    <div class="scene-sugidama">${sugidama('')}</div>
    <div class="scene-toji">${toji('')}</div>
    <div class="scene-taru scene-taru-1">${taru('', '杜氏')}</div>
    <div class="scene-taru scene-taru-2">${taru('', '一季')}</div>
    <div class="scene-taru scene-taru-3">${taru('', '銘酒')}</div>
  </div>`;
}
