// フロントエンドを web/dist にビルドする（esbuild）。--serve でローカル確認用サーバーを起動
//
// キャッシュ対策として、JS・CSS・画像のファイル名に内容のハッシュを付ける（例：main-3F2A1B.js）。
// 内容が変わると名前も変わるため、ブラウザや CloudFront に長期間キャッシュさせても古い表示にならない。
// index.html は名前が変わらないので、ハッシュ付きの名前を書き込んだうえで「毎回確認」で配信する。
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = join(root, 'web', 'dist');
const template = join(root, 'web', 'public', 'index.html');
const serve = process.argv.includes('--serve');

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

/** ビルド結果からハッシュ付きのファイル名を探し、index.html に書き込む */
const htmlPlugin = {
  name: 'html',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0 || !result.metafile) return;
      const outputs = Object.entries(result.metafile.outputs);
      const url = (file) => `/${relative(outdir, join(root, file)).split('\\').join('/')}`;
      const byEntry = (entry) => {
        const hit = outputs.find(([, o]) => o.entryPoint === entry);
        if (!hit) throw new Error(`build output not found: ${entry}`);
        return url(hit[0]);
      };
      const byInput = (input) => {
        const hit = outputs.find(([file, o]) => !file.endsWith('.map') && Object.keys(o.inputs).includes(input));
        if (!hit) throw new Error(`build output not found: ${input}`);
        return url(hit[0]);
      };
      const html = readFileSync(template, 'utf8')
        .replaceAll('/app.js', byEntry('web/src/main.ts'))
        .replaceAll('/style.css', byEntry('web/src/style.css'))
        .replaceAll('/images/sugitama.svg', byInput('web/src/images/sugitama.svg'));
      writeFileSync(join(outdir, 'index.html'), html);
    });
  },
};

const options = {
  absWorkingDir: root,
  entryPoints: ['web/src/main.ts', 'web/src/style.css'],
  outdir,
  entryNames: '[name]-[hash]',
  assetNames: 'images/[name]-[hash]',
  publicPath: '/',
  loader: { '.svg': 'file' },
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  minify: !serve,
  sourcemap: serve,
  legalComments: 'none',
  metafile: true,
  plugins: [htmlPlugin],
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: outdir, port: 8000 });
  console.log(`http://localhost:${port}  （記録機能はデプロイ後に利用できます）`);
} else {
  await esbuild.build(options);
  console.log(`built ${outdir}`);
}
