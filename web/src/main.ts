import {
  type BrewResult,
  type Conditions,
  type Decisions,
  type TempAction,
  checkpointDays,
  conditionsFromSeed,
  idealTemps,
  moromiTempBefore,
  moromiTrace,
  randomSeed,
  simulate,
  validateDecisions,
} from '../../shared/engine';
import { ApiError, type BrewSummary, getBrew, listBrews, listMine, ranking, saveBrew } from './api';
import { authEnabled, currentEmail, initAuth, isLoggedIn, login, logout } from './auth';
import { PHASE_ICONS, ROLE_ICONS, heroScene, taru, toji } from './illustrations';
import { barChart, moromiCharts } from './charts';
import {
  FINISH_STEPS,
  HARDNESS_LABEL,
  MOROMI_POINT,
  MOROMI_STAGES,
  ORDER_INFO,
  ROLE_INFO,
  STEPS,
  type Step,
  WINTER_LABEL,
} from './catalog';

// ---------- 状態 ----------

type Draft = Partial<Omit<Decisions, 'moromi'>> & { moromi?: TempAction[] };

interface Session {
  seed: number;
  screen: number;
  d: Draft;
  savedId?: string;
}

type Screen =
  | { kind: 'intro' }
  | { kind: 'step'; step: Step }
  | { kind: 'moromi'; index: number }
  | { kind: 'result' };

const SCREENS: Screen[] = [
  { kind: 'intro' },
  ...STEPS.map((step) => ({ kind: 'step' as const, step })),
  { kind: 'moromi', index: 0 },
  { kind: 'moromi', index: 1 },
  { kind: 'moromi', index: 2 },
  ...FINISH_STEPS.map((step) => ({ kind: 'step' as const, step })),
  { kind: 'result' },
];

const PHASES = ['蔵入り', '原料処理', '製麹', '酒母', '醪', '上槽', '火入れ・貯蔵', '完成'];

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // プライベートブラウズ等では保存しない
    }
  },
};

let session: Session | null = loadSession();

function loadSession(): Session | null {
  const raw = store.get('sakagura.session');
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    return typeof s.seed === 'number' && typeof s.screen === 'number' ? s : null;
  } catch {
    return null;
  }
}

function saveSession() {
  if (session) store.set('sakagura.session', JSON.stringify(session));
}

function newSession(seed = randomSeed()) {
  session = { seed, screen: 0, d: {} };
  saveSession();
}

// ---------- DOM ヘルパー ----------

const app = document.getElementById('app')!;

function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function setNav(route: string) {
  document.querySelectorAll<HTMLAnchorElement>('.nav a').forEach((a) => {
    const active = a.dataset.route === route;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function renderAccount() {
  const box = document.getElementById('account');
  if (!box) return;
  box.innerHTML = '';
  if (!authEnabled()) return;
  if (isLoggedIn()) {
    box.append(
      h(`<span class="account-name" title="${esc(currentEmail() ?? '')}">${esc(currentEmail() ?? 'ログイン中')}</span>`),
      h('<button class="btn small" type="button" id="logout">ログアウト</button>'),
    );
    box.querySelector('#logout')!.addEventListener('click', () => logout());
  } else {
    box.append(h('<button class="btn small" type="button" id="login">ログイン</button>'));
    box.querySelector('#login')!.addEventListener('click', () => void login());
  }
}

function focusMain() {
  app.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

// ---------- ルーティング ----------

function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, arg] = hash.split('/');
  app.innerHTML = '';
  renderAccount();
  switch (page) {
    case 'brew':
      setNav('brew');
      renderBrew();
      break;
    case 'learn':
      setNav('learn');
      renderLearn();
      break;
    case 'records':
      setNav('records');
      if (arg) void renderRecord(arg);
      else void renderRecords();
      break;
    default:
      setNav('home');
      renderHome();
  }
  focusMain();
}

window.addEventListener('hashchange', route);

// ---------- ホーム ----------

function renderHome() {
  const name = store.get('sakagura.brewer') ?? '';
  const resumable = session && session.screen > 0 && session.screen < SCREENS.length - 1;
  app.append(
    h(`
    <section class="hero">
      <h1 class="hero-title">杜氏の一季<span class="seal" aria-hidden="true">蔵</span></h1>
      <div class="hero-copy">
      <p class="eyebrow">酒蔵シミュレーター</p>
      <p class="lead">あなたは今季、この蔵の<strong>杜氏（とうじ）</strong>に任命されました。
      蔵元の注文に応えるため、米を選び、蔵人を配し、冬の間ずっと醪と向き合う――
      酒造りの「判断」を体験して、杜氏の仕事を知りましょう。</p>
      <form class="start-form" id="start">
        <label for="brewer">杜氏名</label>
        <input id="brewer" name="brewer" maxlength="20" placeholder="例：南部 太郎" value="${esc(name)}" autocomplete="nickname">
        <button class="btn primary" type="submit">新しい仕込みを始める</button>
        ${resumable ? '<button class="btn" type="button" id="resume">続きから</button>' : ''}
      </form>
      </div>
      ${heroScene()}
    </section>`),
    h(`
    <section class="cards three">
      <a class="card link" href="#/learn"><div class="card-icon">${ROLE_ICONS.koji()}</div><div><h2>杜氏の仕事を知る</h2><p>杜氏と蔵人の役割、酒造りの工程をやさしく解説します。</p></div></a>
      <a class="card link" href="#/brew"><div class="card-icon">${PHASE_ICONS['醪']()}</div><div><h2>仕込みを体験する</h2><p>約10の判断で一本の酒を醸します。所要時間は5分ほど。</p></div></a>
      <a class="card link" href="#/records"><div class="card-icon">${PHASE_ICONS['火入れ・貯蔵']()}</div><div><h2>蔵の記録帳</h2><p>みんなが醸した酒の記録と番付を見られます。</p></div></a>
    </section>`),
  );
  const form = document.getElementById('start') as HTMLFormElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (form.elements.namedItem('brewer') as HTMLInputElement).value.trim();
    if (v) store.set('sakagura.brewer', v);
    newSession();
    location.hash = '#/brew';
  });
  document.getElementById('resume')?.addEventListener('click', () => {
    location.hash = '#/brew';
  });
}

// ---------- 仕込み ----------

function renderBrew() {
  if (!session) newSession();
  const s = session!;
  const c = conditionsFromSeed(s.seed);
  const screen = SCREENS[s.screen];

  app.append(progressBar(screen));

  if (screen.kind === 'intro') renderIntro(c);
  else if (screen.kind === 'step') renderStep(c, screen.step);
  else if (screen.kind === 'moromi') renderMoromi(c, screen.index);
  else renderResultScreen(c);
}

function phaseOf(screen: Screen): string {
  if (screen.kind === 'intro') return '蔵入り';
  if (screen.kind === 'moromi') return '醪';
  if (screen.kind === 'result') return '完成';
  return screen.step.phase;
}

function progressBar(screen: Screen): HTMLElement {
  const current = PHASES.indexOf(phaseOf(screen));
  return h(`
    <ol class="calendar" aria-label="仕込み暦">
      ${PHASES.map(
        (p, i) =>
          `<li class="${i < current ? 'done' : i === current ? 'now' : ''}" ${i === current ? 'aria-current="step"' : ''}><div class="cal-icon">${PHASE_ICONS[p]()}</div>${p}</li>`,
      ).join('')}
    </ol>`);
}

function go(delta: number) {
  if (!session) return;
  session.screen = Math.max(0, Math.min(SCREENS.length - 1, session.screen + delta));
  saveSession();
  app.innerHTML = '';
  renderBrew();
  focusMain();
}

function conditionsCard(c: Conditions): string {
  const o = ORDER_INFO[c.order];
  return `
    <div class="order">
      <p class="order-label">蔵元からの注文</p>
      <p class="order-title">「${esc(o.title)}」</p>
      <p>${esc(o.detail)}</p>
      <dl class="conditions">
        <div><dt>今年の米</dt><dd>${HARDNESS_LABEL[c.hardness]}</dd></div>
        <div><dt>今年の冬</dt><dd>${WINTER_LABEL[c.winter]}</dd></div>
        <div><dt>仕込み番号</dt><dd>No.${c.seed % 100000}</dd></div>
      </dl>
    </div>`;
}

/** 工程の見出し（右に工程の挿絵） */
function stepHead(eyebrow: string, title: string, phase: string): string {
  const icon = PHASE_ICONS[phase];
  return `<div class="step-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1></div>${
    icon ? `<div class="step-icon">${icon()}</div>` : ''
  }</div>`;
}

/** 蔵人からの報告（蔵人の挿絵つき） */
function reportBox(text: string): string {
  return `<div class="report"><div class="report-icon">${toji('')}</div><div><p class="point-label">蔵人からの報告</p><p>${esc(text)}</p></div></div>`;
}

function renderIntro(c: Conditions) {
  app.append(
    h(`
    <section class="panel">
      ${stepHead('秋・蔵入り', '今季の仕込みが始まります', '蔵入り')}
      <p>秋、稲刈りを終えた杜氏と蔵人たちが蔵にやってきます。杜氏はまず<strong>蔵元（経営者）</strong>から、今季どんな酒を造るかの注文を受けます。
      注文に応えつつ、その年の米と気候に合わせて造りを組み立てるのが杜氏の腕です。</p>
      ${conditionsCard(c)}
      <div class="actions">
        <button class="btn" id="reroll" type="button">別の年にする</button>
        <button class="btn primary" id="next" type="button">注文を受ける</button>
      </div>
    </section>`),
  );
  document.getElementById('next')!.addEventListener('click', () => go(1));
  document.getElementById('reroll')!.addEventListener('click', () => {
    newSession();
    app.innerHTML = '';
    renderBrew();
  });
}

function renderStep(c: Conditions, step: Step) {
  const s = session!;
  const report = step.report?.(c, s.d as Partial<Decisions>);
  const panel = h(`
    <section class="panel">
      ${stepHead(step.phase, step.title, step.phase)}
      <div class="point"><p class="point-label">杜氏の判断ポイント</p><p>${esc(step.point)}</p></div>
      ${report ? reportBox(report) : ''}
      <form class="fields"></form>
      <div class="actions">
        <button class="btn" type="button" id="back">戻る</button>
        <button class="btn primary" type="button" id="next">決定</button>
      </div>
    </section>`);
  const form = panel.querySelector('form')!;

  for (const f of step.fields) {
    const current = s.d[f.key as keyof Draft];
    const fs = h(`<fieldset><legend>${esc(f.label)}</legend><div class="options"></div></fieldset>`);
    const box = fs.querySelector('.options')!;
    for (const opt of f.options(s.d as Partial<Decisions>)) {
      const id = `${f.key}-${opt.value}`;
      const checked = current === opt.value ? 'checked' : '';
      box.append(
        h(`
        <label class="option" for="${id}">
          <input type="radio" name="${f.key}" id="${id}" value="${opt.value}" ${checked}>
          <span class="option-title">${esc(opt.label)}</span>
          <span class="option-desc">${esc(opt.desc)}</span>
        </label>`),
      );
    }
    form.append(fs);
  }

  const next = panel.querySelector<HTMLButtonElement>('#next')!;
  const update = () => {
    for (const f of step.fields) {
      const checked = form.querySelector<HTMLInputElement>(`input[name="${f.key}"]:checked`);
      if (checked) {
        const raw = checked.value;
        (s.d as Record<string, unknown>)[f.key] = /^-?\d+$/.test(raw) ? Number(raw) : raw;
      }
    }
    // 精米歩合を変えたら浸漬時間の選択肢が変わるため選び直してもらう
    next.disabled = !step.fields.every((f) => s.d[f.key as keyof Draft] !== undefined);
    saveSession();
  };
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'polish') delete s.d.soak;
    update();
  });
  update();
  panel.querySelector('#back')!.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  app.append(panel);
}

function renderMoromi(c: Conditions, index: number) {
  const s = session!;
  const polish = s.d.polish ?? 60;
  const actions = (s.d.moromi ?? []).slice(0, index);
  const days = checkpointDays(polish);
  const trace = moromiTrace(c, polish, actions);
  const tempNow = moromiTempBefore(c, actions, index);
  const ideal = idealTemps(polish)[index];
  const last = trace[trace.length - 1];
  const chosen = s.d.moromi?.[index];

  const reportText =
    tempNow > ideal + 1
      ? '頭より「品温が上がってきています。泡も高い。冷やしますか？」'
      : tempNow < ideal - 1
        ? '頭より「品温が低く、発酵の勢いが弱いようです」'
        : '頭より「品温は計画通りです」';

  const panel = h(`
    <section class="panel">
      ${stepHead(`醪・${MOROMI_STAGES[index]}`, `醪の温度管理（${index + 1} / 3）`, '醪')}
      ${index === 0 ? `<div class="point"><p class="point-label">杜氏の判断ポイント</p><p>${esc(MOROMI_POINT)}</p></div>` : ''}
      <dl class="readings">
        <div><dt>日数</dt><dd>${days[index]}日目まで</dd></div>
        <div><dt>現在の品温</dt><dd>${tempNow}℃</dd></div>
        <div><dt>計画品温</dt><dd>${ideal}℃</dd></div>
        <div><dt>ボーメ</dt><dd>${last.baume}</dd></div>
        <div><dt>アルコール</dt><dd>${last.alcohol}%</dd></div>
      </dl>
      ${reportBox(reportText)}
      <div class="chart-slot"></div>
      <form class="fields">
        <fieldset><legend>タンクの温度操作</legend><div class="options three">
          ${(
            [
              [-1, '冷やす', '冷水を通した暖気樽（だきだる）で約1.5℃下げる'],
              [0, '保つ', 'このまま様子を見る'],
              [1, '温める', 'お湯を入れた暖気樽で約1.5℃上げる'],
            ] as const
          )
            .map(
              ([v, label, desc]) => `
            <label class="option" for="t${v}">
              <input type="radio" name="temp" id="t${v}" value="${v}" ${chosen === v ? 'checked' : ''}>
              <span class="option-title">${label}</span><span class="option-desc">${desc}</span>
            </label>`,
            )
            .join('')}
        </div></fieldset>
      </form>
      <div class="actions">
        <button class="btn" type="button" id="back">戻る</button>
        <button class="btn primary" type="button" id="next" ${chosen === undefined ? 'disabled' : ''}>決定</button>
      </div>
    </section>`);
  panel.querySelector('.chart-slot')!.append(moromiCharts(trace, days[2] + 2));
  panel.querySelector('form')!.addEventListener('change', (e) => {
    const v = Number((e.target as HTMLInputElement).value) as TempAction;
    const m = (s.d.moromi ?? []).slice(0, index);
    m[index] = v;
    s.d.moromi = m;
    panel.querySelector<HTMLButtonElement>('#next')!.disabled = false;
    saveSession();
  });
  panel.querySelector('#back')!.addEventListener('click', () => go(-1));
  panel.querySelector('#next')!.addEventListener('click', () => go(1));
  app.append(panel);
}

function renderResultScreen(c: Conditions) {
  const s = session!;
  const valid = validateDecisions(s.d);
  if (!valid.ok) {
    app.append(h(`<section class="panel"><p>判断が揃っていません。最初からやり直してください。</p><a class="btn primary" href="#/">ホームへ</a></section>`));
    return;
  }
  const result = simulate(c, valid.value);
  const view = resultView(c, result, null);
  app.append(view);

  const save = h(`
    <section class="panel save">
      <h2>蔵の記録帳に残す</h2>
      <form id="save-form" class="save-form">
        <label>杜氏名<input name="brewerName" maxlength="20" required value="${esc(store.get('sakagura.brewer') ?? '')}"></label>
        <label>酒銘<input name="sakeName" maxlength="30" required placeholder="例：初雪"></label>
        <button class="btn primary" type="submit">記録する</button>
      </form>
      <p class="save-status" role="status"></p>
      <div class="actions">
        <button class="btn" type="button" id="retry">同じ年でやり直す</button>
        <button class="btn" type="button" id="again">新しい年で仕込む</button>
      </div>
    </section>`);
  const status = save.querySelector<HTMLElement>('.save-status')!;
  const form = save.querySelector<HTMLFormElement>('#save-form')!;
  const askLogin = (message: string) => {
    form.hidden = true;
    status.innerHTML = '';
    status.append(
      h(`<span>${esc(message)}</span>`),
      h('<button class="btn primary small" type="button">ログイン / 新規登録</button>'),
    );
    status.querySelector('button')!.addEventListener('click', () => void login('#/brew'));
  };
  if (s.savedId) {
    form.hidden = true;
    status.innerHTML = `記録済みです。<a href="#/records/${esc(s.savedId)}">記録を見る</a>`;
  } else if (!authEnabled()) {
    form.hidden = true;
    status.textContent = '記録機能は AWS にデプロイした環境で利用できます。';
  } else if (!isLoggedIn()) {
    askLogin('記録帳に残すにはログインが必要です（メールアドレスで無料登録できます）。結果はログイン後もこの画面に残ります。');
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const brewerName = String(fd.get('brewerName') ?? '').trim();
    const sakeName = String(fd.get('sakeName') ?? '').trim();
    if (!brewerName || !sakeName) return;
    store.set('sakagura.brewer', brewerName);
    const btn = form.querySelector('button')!;
    btn.disabled = true;
    status.textContent = '記録しています…';
    try {
      const rec = await saveBrew({ brewerName, sakeName, seed: s.seed, decisions: valid.value });
      s.savedId = rec.id;
      saveSession();
      form.hidden = true;
      status.innerHTML = `記録しました。<a href="#/records/${esc(rec.id)}">記録を見る</a>（このリンクで友人と共有できます）`;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        renderAccount();
        askLogin('ログインの有効期限が切れました。もう一度ログインしてください。');
        return;
      }
      status.textContent = (err as Error).message;
      btn.disabled = false;
    }
  });
  save.querySelector('#retry')!.addEventListener('click', () => {
    newSession(s.seed);
    session!.screen = 1;
    saveSession();
    app.innerHTML = '';
    renderBrew();
    focusMain();
  });
  save.querySelector('#again')!.addEventListener('click', () => {
    newSession();
    app.innerHTML = '';
    renderBrew();
    focusMain();
  });
  app.append(save);
}

function resultView(c: Conditions, r: BrewResult, meta: { sakeName: string; brewerName: string; createdAt: string } | null): HTMLElement {
  const o = ORDER_INFO[c.order];
  const toneLabel = { good: '良', warn: '注意', bad: '失敗' } as const;
  const view = h(`
    <section class="panel result">
      <p class="eyebrow">${meta ? '蔵の記録帳' : '皆造（かいぞう）――今季の造りを終えて'}</p>
      <div class="label-card">
        <div class="label-taru">${taru('', '新酒')}</div>
        <div class="label-main">
          <p class="label-class">${esc(r.className)}</p>
          <p class="label-name">${meta ? esc(meta.sakeName) : '（銘柄未定）'}</p>
          ${meta ? `<p class="label-brewer">杜氏 ${esc(meta.brewerName)}　${esc(new Date(meta.createdAt).toLocaleDateString('ja-JP'))}</p>` : ''}
        </div>
        <div class="score">
          <span class="rank">${esc(r.rank)}</span>
          <span class="score-num">${r.score}<span class="score-unit">点</span></span>
        </div>
      </div>
      <p class="order-line">注文：「${esc(o.title)}」 ／ 米：${HARDNESS_LABEL[c.hardness]} ／ 冬：${WINTER_LABEL[c.winter]}</p>
      <dl class="specs">
        <div><dt>注文への適合</dt><dd>${r.fitness}</dd></div>
        <div><dt>綺麗さ</dt><dd>${r.clean}</dd></div>
        <div><dt>日本酒度</dt><dd>${r.smv > 0 ? '+' : ''}${r.smv}</dd></div>
        <div><dt>酸度</dt><dd>${r.acidity.toFixed(1)}</dd></div>
        <div><dt>アミノ酸度</dt><dd>${r.amino.toFixed(1)}</dd></div>
        <div><dt>アルコール</dt><dd>${r.alcohol}%</dd></div>
        <div><dt>原価指数</dt><dd>${r.costIndex}</dd></div>
        <div><dt>タイプ</dt><dd>${esc(r.flavorType)}</dd></div>
      </dl>
      <p class="tip"><span class="tip-icon">${PHASE_ICONS['完成']()}</span><span>おすすめの飲み方：${esc(r.servingTip)}</span></p>
      <div class="chart-grid"></div>
      <h2>杜氏の振り返り</h2>
      <ul class="feedback">
        ${r.feedback.map((f) => `<li class="${f.tone}"><span class="tone">${toneLabel[f.tone]}</span><span class="stage">${esc(f.stage)}</span>${esc(f.text)}</li>`).join('')}
      </ul>
      <p class="note">評価 ＝ 綺麗さ（造りの確かさ）45% ＋ 注文への適合 45% ＋ 個性 10%</p>
    </section>`);
  const grid = view.querySelector('.chart-grid')!;
  grid.append(
    barChart(
      [
        { label: '香り', value: r.aroma },
        { label: '旨味', value: r.umami },
        { label: 'キレ', value: r.kire },
        { label: '綺麗さ', value: r.clean },
      ],
      '味わい（0〜100）',
    ),
    moromiCharts(r.moromi, r.moromi[r.moromi.length - 1].day + 2),
  );
  return view;
}

// ---------- 解説 ----------

function renderLearn() {
  const roles = Object.entries(ROLE_INFO)
    .map(
      ([key, r]) =>
        `<div class="role"><div class="role-icon">${ROLE_ICONS[key]?.() ?? ''}</div><div><h3>${esc(r.name)}<small>${esc(r.reading)}</small></h3><p>${esc(r.desc)}</p></div></div>`,
    )
    .join('');
  app.append(
    h(`
    <section class="panel prose">
      <div class="learn-head"><div><p class="eyebrow">杜氏の仕事を知る</p><h1>杜氏とは</h1></div><div class="learn-toji">${toji()}</div></div>
      <p><strong>杜氏（とうじ）</strong>は、酒蔵で酒造りを取り仕切る製造の最高責任者です。蔵の持ち主である<strong>蔵元</strong>から「どんな酒を造るか」の注文を受け、
      <strong>蔵人（くらびと）</strong>と呼ばれる職人たちを率いて、米の処理から搾り・貯蔵までのすべてを指揮します。</p>
      <p>酒造りは生き物（麹菌・酵母）相手の仕事です。同じ品種の米でも年によって硬さが違い、冬の寒さも毎年変わります。
      杜氏は毎日の観察から状態を読み取り、浸漬の秒数、麹室の温度、醪の品温を決めていきます。<strong>経験に裏打ちされた判断の連続</strong>こそが杜氏の仕事です。</p>

      <h2>蔵人の持ち場</h2>
      <div class="roles">${roles}</div>

      <h2>酒造りの流れと杜氏の判断</h2>
      <ol class="flow">
        <li><strong>精米</strong>：どこまで米を削るか。削るほど綺麗で香り高いが原価が上がる。</li>
        <li><strong>洗米・浸漬</strong>：米の硬さを見て、吸水を秒単位で止める「限定吸水」。</li>
        <li><strong>蒸米</strong>：外は硬く中は軟らかい「外硬内軟」の蒸米を目指す。</li>
        <li><strong>製麹</strong>：約2日、麹室で麹菌を育てる。「一麹、二酛、三造り」の一番目。</li>
        <li><strong>酒母</strong>：酵母を大量に育てる。速醸か、生酛・山廃か。</li>
        <li><strong>醪</strong>：三段仕込みで約3〜5週間。品温とボーメを毎日測り、冷やすか温めるかを決める。</li>
        <li><strong>上槽</strong>：搾る日、搾り方を決める。</li>
        <li><strong>火入れ・貯蔵</strong>：加熱殺菌して熟成させ、出荷の時期を見極める。</li>
      </ol>

      <h2>杜氏の流派と今</h2>
      <p>かつて杜氏や蔵人は、農閑期の冬に出稼ぎで酒蔵に来る農家の人々でした。南部杜氏（岩手）、越後杜氏（新潟）、但馬杜氏（兵庫）などが知られ、
      それぞれに技と気風を受け継いできました。近年は蔵元自らが造る<strong>蔵元杜氏</strong>や、年間を通して働く<strong>社員杜氏</strong>も増え、
      伝統の勘とデータ（温度・ボーメの記録）を組み合わせた酒造りが広がっています。</p>
      <p class="actions"><a class="btn primary" href="#/brew">杜氏として仕込んでみる</a></p>
    </section>`),
  );
}

// ---------- 記録帳 ----------

function recordRows(items: BrewSummary[], withRank: boolean): string {
  if (items.length === 0) return '<p class="empty">まだ記録がありません。最初の一本を醸しましょう。</p>';
  return `<ol class="records ${withRank ? 'ranked' : ''}">
    ${items
      .map(
        (it, i) => `
      <li><a href="#/records/${esc(it.id)}">
        ${withRank ? `<span class="pos">${['横綱', '大関', '関脇', '小結'][i] ?? `前頭${i - 3}`}</span>` : ''}
        <span class="rec-name">${esc(it.sakeName)}<small>${esc(it.className)}</small></span>
        <span class="rec-brewer">杜氏 ${esc(it.brewerName)}</span>
        <span class="rec-score">${esc(it.rank)} ${esc(it.score)}点</span>
      </a></li>`,
      )
      .join('')}
  </ol>`;
}

async function renderRecords() {
  const panel = h(`
    <section class="panel">
      <div class="records-head"><div><p class="eyebrow">蔵の記録帳</p><h1>みんなの仕込み</h1></div><div class="records-taru">${taru('', '番付')}${taru('', '記録')}</div></div>
      <div class="two-col">
        ${isLoggedIn() ? '<div><h2>自分の記録</h2><div id="mine" class="loading">読み込み中…</div></div>' : ''}
        <div><h2>番付</h2><div id="ranking" class="loading">読み込み中…</div></div>
        <div><h2>最近の記録</h2><div id="recent" class="loading">読み込み中…</div></div>
      </div>
    </section>`);
  app.append(panel);
  const fill = async (id: string, load: () => Promise<{ items: BrewSummary[] }>, ranked: boolean) => {
    const slot = panel.querySelector<HTMLElement>(`#${id}`)!;
    try {
      const { items } = await load();
      slot.innerHTML = recordRows(items, ranked);
    } catch (err) {
      slot.innerHTML = `<p class="empty">${esc((err as Error).message)}</p>`;
    }
    slot.classList.remove('loading');
  };
  await Promise.all([
    fill('ranking', ranking, true),
    fill('recent', () => listBrews(20), false),
    ...(isLoggedIn() ? [fill('mine', listMine, false)] : []),
  ]);
}

async function renderRecord(id: string) {
  const slot = h('<div class="loading">読み込み中…</div>');
  app.append(slot);
  try {
    const rec = await getBrew(id);
    slot.replaceWith(
      resultView(conditionsFromSeed(rec.seed), rec.result, rec),
      h(`<p class="actions"><a class="btn" href="#/records">記録帳へ戻る</a><a class="btn primary" href="#/brew" id="same">この年に挑戦する</a></p>`),
    );
    document.getElementById('same')!.addEventListener('click', () => newSession(rec.seed));
  } catch (err) {
    slot.replaceWith(h(`<section class="panel"><p>${esc((err as Error).message)}</p><a class="btn" href="#/records">記録帳へ戻る</a></section>`));
  }
}

// 認証の初期化（ログイン画面からの戻りを含む）を終えてから描画する
void initAuth().finally(route);
