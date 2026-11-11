/**
 * 酒蔵のイラスト。
 * 画像は「杜氏の一季 ブラッシュアップ画像アセット」（web/src/images/*.svg、320×320・背景込み）を加工せずに使う。
 * 配色：生成り #F7F3E9、藍 #243B53、墨 #222B2F、朱 #C44B3F、杉・麹の緑 #52745A、木・米の淡い金 #C9A875
 */

import fermentationTank from './images/fermentation-tank.svg';
import kojiTray from './images/koji-tray.svg';
import komodaru from './images/komodaru.svg';
import pressingBag from './images/pressing-bag.svg';
import riceGrainImg from './images/rice-grain.svg';
import riceSack from './images/rice-sack.svg';
import sakeBottle from './images/sake-bottle.svg';
import steamingKettle from './images/steaming-kettle.svg';
import sugitama from './images/sugitama.svg';
import tojiImg from './images/toji.svg';
import woodenTub from './images/wooden-tub.svg';

// ビルド時にハッシュ付きの URL（例：/images/toji-3F2A1B.svg）に置き換わる
const IMAGES = {
  toji: tojiImg,
  komodaru,
  sugitama,
  'rice-sack': riceSack,
  'koji-tray': kojiTray,
  'wooden-tub': woodenTub,
  'steaming-kettle': steamingKettle,
  'sake-bottle': sakeBottle,
  'pressing-bag': pressingBag,
  'rice-grain': riceGrainImg,
  'fermentation-tank': fermentationTank,
} as const;

type ImageName = keyof typeof IMAGES;

/** 画像タグ。alt が空なら装飾として読み上げ対象から外す */
function img(name: ImageName, alt = ''): string {
  return `<img class="illust" src="${IMAGES[name]}" width="320" height="320" alt="${alt}"${
    alt ? '' : ' aria-hidden="true"'
  } decoding="async">`;
}

export const toji = (alt = '杜氏') => img('toji', alt);
export const taru = (alt = '菰樽') => img('komodaru', alt);
export const sugidama = (alt = '杉玉') => img('sugitama', alt);
export const riceGrain = (alt = '米粒') => img('rice-grain', alt);

/** 工程ごとの挿絵（仕込み暦・各ステップの見出し用） */
export const PHASE_ICONS: Record<string, () => string> = {
  蔵入り: () => img('sugitama'),
  原料処理: () => img('rice-sack'),
  製麹: () => img('koji-tray'),
  酒母: () => img('wooden-tub'),
  醪: () => img('fermentation-tank'),
  上槽: () => img('pressing-bag'),
  '火入れ・貯蔵': () => img('komodaru'),
  完成: () => img('sake-bottle'),
};

/** 蔵人の持ち場ごとの挿絵 */
export const ROLE_ICONS: Record<string, () => string> = {
  toji: () => img('toji'),
  kashira: () => img('fermentation-tank'),
  koji: () => img('koji-tray'),
  moto: () => img('wooden-tub'),
  kama: () => img('steaming-kettle'),
};

/** トップの情景：杜氏を中心に、杉玉と菰樽を添える */
export function heroScene(): string {
  return `<div class="scene" role="img" aria-label="杜氏と杉玉、菰樽のイラスト">
    <div class="scene-main">${img('toji')}</div>
    <div class="scene-side">${img('sugitama')}${img('komodaru')}</div>
  </div>`;
}
