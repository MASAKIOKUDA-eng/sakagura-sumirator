import type { MoromiPoint } from '../../shared/engine';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

// ---------- ツールチップ（全チャートで 1 つを共有） ----------

let tip: HTMLDivElement | null = null;
function tooltip(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.setAttribute('role', 'status');
    document.body.appendChild(tip);
  }
  return tip;
}

function bindTip(target: Element, text: string) {
  const show = (x: number, y: number) => {
    const t = tooltip();
    t.textContent = text;
    t.style.opacity = '1';
    const w = t.offsetWidth;
    t.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2))}px`;
    t.style.top = `${y - t.offsetHeight - 12 + window.scrollY}px`;
  };
  const hide = () => {
    if (tip) tip.style.opacity = '0';
  };
  target.addEventListener('pointerenter', (e) => {
    const ev = e as PointerEvent;
    show(ev.clientX, ev.clientY);
  });
  target.addEventListener('pointermove', (e) => {
    const ev = e as PointerEvent;
    show(ev.clientX, ev.clientY);
  });
  target.addEventListener('pointerleave', hide);
  target.addEventListener('focus', () => {
    const r = (target as SVGGraphicsElement).getBoundingClientRect();
    show(r.left + r.width / 2, r.top);
  });
  target.addEventListener('blur', hide);
}

// ---------- 横棒グラフ（味わいの 4 指標、0〜100） ----------

export function barChart(items: { label: string; value: number }[], title: string): HTMLElement {
  const fig = document.createElement('figure');
  fig.className = 'chart chart-bars';
  const W = 400;
  const rowH = 34;
  const labelW = 64;
  const valueW = 36;
  const H = items.length * rowH + 8;
  const plotW = W - labelW - valueW;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });

  // 目盛り（50 と 100）
  for (const v of [50, 100]) {
    const x = labelW + (plotW * v) / 100;
    svg.appendChild(el('line', { x1: x, x2: x, y1: 0, y2: H - 4, class: 'grid' }));
  }

  items.forEach((it, i) => {
    const y = 6 + i * rowH;
    const label = el('text', { x: labelW - 8, y: y + 15, 'text-anchor': 'end', class: 'axis-label' });
    label.textContent = it.label;
    svg.appendChild(label);
    const w = Math.max(4, (plotW * it.value) / 100);
    const bar = el('rect', { x: labelW, y: y + 4, width: w, height: 16, rx: 4, class: 'bar', tabindex: 0 });
    svg.appendChild(bar);
    // 当たり判定は行全体
    const hit = el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' });
    svg.appendChild(hit);
    bindTip(hit, `${it.label}: ${it.value} / 100`);
    bindTip(bar, `${it.label}: ${it.value} / 100`);
    const val = el('text', { x: labelW + w + 6, y: y + 16, class: 'value-label' });
    val.textContent = String(it.value);
    svg.appendChild(val);
  });

  const cap = document.createElement('figcaption');
  cap.textContent = title;
  fig.append(cap, svg);
  return fig;
}

// ---------- 折れ線グラフ（醪の推移） ----------

interface LineOpts {
  title: string;
  unit: string;
  key: 'temp' | 'baume' | 'alcohol';
  /** 比較用の目標線（品温のみ） */
  idealKey?: 'idealTemp';
  yMin: number;
  yMax: number;
  maxDay: number;
}

export function lineChart(points: MoromiPoint[], o: LineOpts): HTMLElement {
  const fig = document.createElement('figure');
  fig.className = 'chart';
  const W = 360;
  const H = 180;
  const m = { l: 36, r: 14, t: 12, b: 28 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const x = (day: number) => m.l + (pw * day) / o.maxDay;
  // 範囲外の値はプロット領域の端に寄せる（線が軸の外にはみ出さないように）
  const y = (v: number) => m.t + ph * (1 - (Math.min(o.yMax, Math.max(o.yMin, v)) - o.yMin) / (o.yMax - o.yMin));

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.title });

  // 横グリッドと目盛り
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = o.yMin + ((o.yMax - o.yMin) * i) / ticks;
    svg.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid' }));
    const t = el('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' });
    t.textContent = String(Math.round(v * 10) / 10);
    svg.appendChild(t);
  }
  for (let d = 0; d <= o.maxDay; d += 5) {
    const t = el('text', { x: x(d), y: H - 8, 'text-anchor': 'middle', class: 'tick' });
    t.textContent = `${d}日`;
    svg.appendChild(t);
  }

  if (o.idealKey && points.length > 1) {
    const ideal = points.map((p) => `${x(p.day)},${y(p[o.idealKey!])}`).join(' ');
    svg.appendChild(el('polyline', { points: ideal, class: 'ideal-line' }));
  }

  if (points.length > 1) {
    const line = points.map((p) => `${x(p.day)},${y(p[o.key])}`).join(' ');
    svg.appendChild(el('polyline', { points: line, class: 'series-line' }));
  }
  points.forEach((p, i) => {
    const cx = x(p.day);
    const cy = y(p[o.key]);
    svg.appendChild(el('circle', { cx, cy, r: 4.5, class: 'series-dot' }));
    const hit = el('circle', { cx, cy, r: 14, fill: 'transparent', tabindex: 0 });
    const ideal = o.idealKey ? `（目標 ${p[o.idealKey]}${o.unit}）` : '';
    bindTip(hit, `${p.day}日目: ${p[o.key]}${o.unit}${ideal}`);
    svg.appendChild(hit);
    // 直接ラベルは最後の点だけ
    if (i === points.length - 1) {
      const t = el('text', { x: cx, y: cy - 10, 'text-anchor': 'middle', class: 'value-label' });
      t.textContent = `${p[o.key]}${o.unit}`;
      svg.appendChild(t);
    }
  });

  const cap = document.createElement('figcaption');
  cap.innerHTML = o.idealKey
    ? `${o.title}<span class="legend"><span class="key key-series"></span>実際<span class="key key-ideal"></span>目標</span>`
    : o.title;
  fig.append(cap, svg);
  return fig;
}

export function moromiCharts(points: MoromiPoint[], maxDay: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'chart-pair';
  wrap.append(
    lineChart(points, { title: '品温（℃）', unit: '℃', key: 'temp', idealKey: 'idealTemp', yMin: 4, yMax: 20, maxDay }),
    lineChart(points, { title: 'ボーメ（糖分の目安）', unit: '', key: 'baume', yMin: -2, yMax: 9, maxDay }),
  );
  return wrap;
}
