// README のアーキテクチャ図を、AWS 公式アーキテクチャアイコンで描画して PNG に出力する。
//
// 使い方：
//   1. https://aws.amazon.com/architecture/icons/ から「Icon package」をダウンロードして展開
//   2. Playwright（Chromium）を用意：npm i -D playwright && npx playwright install chromium
//   3. node docs/diagrams/build-diagrams.mjs <展開したアイコンパッケージのフォルダ>
//
// 出力：docs/images/architecture.png, docs/images/deploy.png
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const pkg = process.argv[2];
if (!pkg) {
  console.error('usage: node docs/diagrams/build-diagrams.mjs <AWS icon package dir>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'docs', 'images');

// ---------- アイコン（ファイル名で検索） ----------
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === '__MACOSX') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.svg')) files.push(p);
  }
})(pkg);
const icon = (fileName) => {
  const hit = files.find((f) => f.endsWith(`/${fileName}`));
  if (!hit) throw new Error(`icon not found: ${fileName}`);
  return `data:image/svg+xml;base64,${readFileSync(hit).toString('base64')}`;
};
const I = {
  cloud: icon('AWS-Cloud-logo_32.svg'),
  region: icon('Region_32.svg'),
  cloudfront: icon('Arch_Amazon-CloudFront_64.svg'),
  waf: icon('Arch_AWS-WAF_64.svg'),
  s3: icon('Arch_Amazon-Simple-Storage-Service_64.svg'),
  lambda: icon('Arch_AWS-Lambda_64.svg'),
  dynamodb: icon('Arch_Amazon-DynamoDB_64.svg'),
  cognito: icon('Arch_Amazon-Cognito_64.svg'),
  cloudwatch: icon('Arch_Amazon-CloudWatch_64.svg'),
  users: icon('Res_Users_48_Light.svg'),
  user: icon('Res_User_48_Light.svg'),
  client: icon('Res_Client_48_Light.svg'),
  bucket: icon('Res_Amazon-Simple-Storage-Service_Bucket_48.svg'),
};

// ---------- 部品 ----------
const node = (x, y, img, title, sub = '', size = 64) => `
  <div class="node${size <= 40 ? ' sm' : ''}" style="left:${x - 90}px;top:${y - size / 2}px">
    <img src="${img}" width="${size}" height="${size}" alt="">
    <div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}
  </div>`;
const box = (x, y, w, h, cls, label, img = '') => `
  <div class="group ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">
    <div class="glabel">${img ? `<img src="${img}" width="32" height="32" alt="">` : ''}<span>${label}</span></div>
  </div>`;
const text = (x, y, s, cls = 'el') => `<div class="${cls}" style="left:${x}px;top:${y}px">${s}</div>`;
const line = (pts, dashed = false) =>
  `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" class="${dashed ? 'dash' : ''}" marker-end="url(#a)"/>`;

const page = (w, h, body, lines) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
  body{margin:0;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;color:#232F3E}
  .canvas{position:relative;width:${w}px;height:${h}px;background:#fff}
  .group{position:absolute;box-sizing:border-box}
  .group .glabel{position:absolute;left:0;top:0;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
  .cloud{border:2px solid #232F3E}
  .region{border:2px dashed #00A4A6}.region .glabel{color:#00A4A6}
  .generic{border:2px dashed #7D8998}.generic .glabel{color:#5A6B7B;left:10px;top:6px}
  .stack{border:1px solid #7D8998;background:#F7F8F9;border-radius:4px}.stack .glabel{left:10px;top:6px;color:#232F3E;font-size:13px}
  .node{position:absolute;width:180px;text-align:center}
  .node img{display:block;margin:0 auto 6px}
  .node .t{font-size:14px;font-weight:600;line-height:1.3}
  .node .s{font-size:12px;color:#545B64;line-height:1.35}
  .tool{position:absolute;border:1.5px solid #545B64;border-radius:6px;padding:10px 12px;background:#fff;text-align:center;font-size:13px;line-height:1.4;width:150px;box-sizing:border-box}
  .tool b{display:block;font-size:14px}
  .el{position:absolute;font-size:12px;color:#232F3E;background:#fff;padding:0 4px;white-space:nowrap}
  .title{position:absolute;font-size:20px;font-weight:700}
  .node.sm .t{font-size:12px}
  .note{position:absolute;font-size:12px;color:#545B64}
  svg{position:absolute;left:0;top:0}
  polyline{fill:none;stroke:#545B64;stroke-width:2}
  polyline.dash{stroke-dasharray:6 5}
</style></head><body><div class="canvas">
<svg width="${w}" height="${h}"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#545B64"/></marker></defs>${lines}</svg>
${body}</div></body></html>`;

// ---------- 1. アーキテクチャ ----------
const arch = page(
  1240,
  830,
  [
    text(24, 14, '杜氏の一季 アーキテクチャ', 'title'),
    box(200, 60, 1020, 720, 'cloud', 'AWS Cloud', I.cloud),
    box(230, 300, 330, 260, 'generic', 'グローバル（エッジ）'),
    box(600, 110, 590, 640, 'region', 'リージョン（us-east-1）', I.region),
    node(95, 420, I.users, '利用者', 'PC・スマートフォン', 48),
    node(320, 420, I.waf, 'AWS WAF', 'レート制限<br>マネージドルール'),
    node(470, 420, I.cloudfront, 'Amazon CloudFront', 'HTTPS・キャッシュ'),
    node(760, 210, I.s3, 'Amazon S3', '静的サイト（非公開）'),
    node(760, 420, I.lambda, 'AWS Lambda', 'Function URL（IAM 認証）<br>Node.js 22・arm64'),
    node(1060, 420, I.dynamodb, 'Amazon DynamoDB', '蔵の記録帳<br>オンデマンド・TTL'),
    node(760, 660, I.cognito, 'Amazon Cognito', '日本語マネージドログイン'),
    node(1060, 660, I.cloudwatch, 'Amazon CloudWatch', 'Logs（保持 1 週間）'),
    text(150, 395, 'HTTPS'),
    text(478, 205, '/*（OAC）'),
    text(565, 395, '/api/*（OAC・SigV4）'),
    text(850, 395, '記録の読み書き'),
    text(612, 568, 'トークン検証用の公開鍵'),
    text(925, 560, 'ログ'),
    text(250, 638, 'ログイン・新規登録（認可コード + PKCE）'),
    `<div class="note" style="left:24px;top:796px">アイコン：AWS Architecture Icons（2026-07-31 版）</div>`,
  ].join(''),
  [
    line([[127, 420], [284, 420]]),
    line([[354, 420], [434, 420]]),
    line([[470, 386], [470, 210], [724, 210]]),
    line([[506, 420], [724, 420]]),
    line([[796, 410], [1024, 410]]),
    line([[790, 530], [790, 624]], true),
    line([[796, 440], [915, 440], [915, 650], [1024, 650]], true),
    line([[95, 530], [95, 660], [724, 660]]),
  ].join(''),
);

// ---------- 2. デプロイ ----------
const deploy = page(
  1250,
  580,
  [
    text(24, 14, 'デプロイの構成（cdkd）', 'title'),
    node(90, 300, I.user, '開発者', 'npm run deploy', 48),
    `<div class="tool" style="left:180px;top:262px;width:150px"><b>esbuild</b>フロント・Lambda<br>をビルド</div>`,
    `<div class="tool" style="left:380px;top:262px;width:190px"><b>cdkd</b>CDK アプリを合成し<br>AWS SDK で直接デプロイ</div>`,
    box(610, 60, 615, 500, 'cloud', 'AWS Cloud', I.cloud),
    node(740, 160, I.bucket, 'cdkd 状態バケット（S3）', 'デプロイ状態・アセット', 48),
    box(630, 250, 575, 290, 'region', 'リージョン（us-east-1）', I.region),
    box(650, 300, 140, 186, 'stack', 'WAF スタック'),
    node(720, 395, I.waf, 'AWS WAF', 'Web ACL', 48),
    box(860, 300, 325, 186, 'stack', '本体スタック'),
    node(905, 365, I.cloudfront, 'CloudFront', '', 40),
    node(985, 365, I.s3, 'S3', '', 40),
    node(1065, 365, I.lambda, 'Lambda', '', 40),
    node(1145, 365, I.dynamodb, 'DynamoDB', '', 40),
    node(985, 432, I.cognito, 'Cognito', '', 40),
    node(1065, 432, I.cloudwatch, 'CloudWatch', '', 40),
    text(799, 360, 'ARN 参照'),
    `<div class="note" style="left:650px;top:500px;width:540px">WAF → 本体の順にデプロイ。本体スタックは <code>Fn::GetStackOutput</code> で WAF の ARN を参照</div>`,
    text(410, 360, 'CloudFormation を使わず、<br>各サービスの API を直接呼び出す', 'note'),
    text(560, 130, '状態の読み書き'),
  ].join(''),
  [
    line([[120, 300], [178, 300]]),
    line([[330, 300], [378, 300]]),
    line([[570, 300], [628, 300]]),
    line([[475, 260], [475, 160], [714, 160]]),
    line([[790, 385], [858, 385]], true),
  ].join(''),
);

const browser = await chromium.launch();
for (const [name, html, w, h] of [
  ['architecture', arch, 1240, 830],
  ['deploy', deploy, 1250, 580],
]) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: join(outDir, `${name}.png`), clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
  console.log(`wrote docs/images/${name}.png`);
}
await browser.close();
