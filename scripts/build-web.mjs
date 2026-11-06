// フロントエンドを web/dist にビルドする（esbuild）。--serve でローカル確認用サーバーを起動
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = join(root, 'web', 'dist');
const serve = process.argv.includes('--serve');

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
cpSync(join(root, 'web', 'public'), outdir, { recursive: true });

const options = {
  entryPoints: [join(root, 'web', 'src', 'main.ts')],
  outfile: join(outdir, 'app.js'),
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  minify: !serve,
  sourcemap: serve,
  legalComments: 'none',
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
