import { describe, expect, it } from 'vitest';
import {
  type Conditions,
  type Decisions,
  className,
  conditionsFromSeed,
  moromiTempBefore,
  moromiTrace,
  simulate,
  validateDecisions,
} from '../shared/engine';

const base: Decisions = {
  veteran: 'kashira',
  rice: 'yamadanishiki',
  polish: 35,
  soak: 1,
  koji: 'tsukihaze',
  dekoji: 45,
  shubo: 'sokujo',
  yeast: 'k1801',
  moromi: [0, 0, 0],
  pressTiming: 'standard',
  alcohol: 'added',
  press: 'fukuro',
  hiire: 'once',
};

const cond = (over: Partial<Conditions> = {}): Conditions => ({
  seed: 12345,
  hardness: 'normal',
  winter: 'normal',
  order: 'competition',
  ...over,
});

describe('conditionsFromSeed', () => {
  it('同じシードからは同じ条件になる', () => {
    expect(conditionsFromSeed(42)).toEqual(conditionsFromSeed(42));
  });
  it('いろいろなシードで全ての注文が出現する', () => {
    const orders = new Set(Array.from({ length: 200 }, (_, i) => conditionsFromSeed(i + 1).order));
    expect(orders.size).toBe(4);
  });
});

describe('simulate', () => {
  it('決定的である（サーバー再計算と一致する）', () => {
    expect(simulate(cond(), base)).toEqual(simulate(cond(), base));
  });

  it('値は範囲内に収まる', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = simulate(conditionsFromSeed(seed), base);
      for (const v of [r.aroma, r.umami, r.kire, r.clean, r.fitness, r.score, r.costIndex]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(r.feedback.length).toBeGreaterThan(0);
      expect(r.smv).toBeGreaterThanOrEqual(-30);
      expect(r.smv).toBeLessThanOrEqual(21);
      expect(r.moromi).toHaveLength(4);
    }
  });

  it('鑑評会の注文に王道の大吟醸で応えると高得点', () => {
    const r = simulate(cond(), { ...base, moromi: [-1, 0, 0] });
    expect(r.className).toBe('大吟醸酒');
    expect(r.score).toBeGreaterThanOrEqual(72);
  });

  it('米の硬さに合わない浸漬は綺麗さを下げ、釜屋のベテランが失敗を和らげる', () => {
    const ok = simulate(cond(), base).clean;
    const ng = simulate(cond(), { ...base, soak: 2 }).clean;
    const ngWithKama = simulate(cond(), { ...base, soak: 2, veteran: 'kama' }).clean;
    expect(ng).toBeLessThan(ok);
    expect(ngWithKama).toBeGreaterThan(ng);
  });

  it('暖冬に温度を上げ続けると醪の失敗になるが、日本酒度は現実的な範囲に収まる', () => {
    const r = simulate(cond({ winter: 'warm' }), { ...base, moromi: [1, 1, 1], pressTiming: 'late' });
    expect(r.smv).toBeLessThanOrEqual(21);
    expect(r.feedback.some((f) => f.stage === '醪' && f.tone === 'bad')).toBe(true);
  });

  it('燗酒の注文には山廃・総ハゼ・70% が合う', () => {
    const c = cond({ order: 'kanzake', winter: 'cold' });
    const kan = simulate(c, {
      ...base,
      rice: 'omachi',
      polish: 70,
      koji: 'sohaze',
      dekoji: 45,
      shubo: 'yamahai',
      yeast: 'k7',
      alcohol: 'none',
      press: 'fune',
      hiire: 'twice',
    });
    const ginjo = simulate(c, base);
    expect(kan.fitness).toBeGreaterThan(ginjo.fitness);
  });
});

describe('moromi', () => {
  it('温度操作が品温に反映される', () => {
    const c = cond();
    expect(moromiTempBefore(c, [-1], 1)).toBe(moromiTempBefore(c, [0], 1) - 1.5);
    const trace = moromiTrace(c, 50, [0, 0]);
    expect(trace).toHaveLength(3);
    expect(trace[2].baume).toBeLessThan(trace[1].baume);
  });
});

describe('className', () => {
  it.each([
    [35, 'none', '純米大吟醸酒'],
    [50, 'added', '大吟醸酒'],
    [60, 'none', '純米吟醸酒'],
    [60, 'added', '吟醸酒'],
    [70, 'none', '純米酒'],
    [70, 'added', '本醸造酒'],
  ] as const)('%i%% / %s → %s', (p, a, name) => {
    expect(className(p, a)).toBe(name);
  });
});

describe('validateDecisions', () => {
  it('正しい入力を受け付ける', () => {
    expect(validateDecisions(base).ok).toBe(true);
  });
  it.each([
    ['rice', 'sasanishiki'],
    ['polish', 40],
    ['soak', '1'],
    ['moromi', [0, 0]],
    ['moromi', [0, 0, 2]],
  ])('%s=%j を拒否する', (key, value) => {
    expect(validateDecisions({ ...base, [key]: value }).ok).toBe(false);
  });
  it('余分なプロパティは結果に含めない', () => {
    const r = validateDecisions({ ...base, evil: 'x' });
    expect(r.ok && 'evil' in r.value).toBe(false);
  });
});
