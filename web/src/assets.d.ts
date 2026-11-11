// esbuild の file ローダーで読み込む画像は、配信時の URL（文字列）になる
declare module '*.svg' {
  const url: string;
  export default url;
}
