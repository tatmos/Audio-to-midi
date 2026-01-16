import { defineConfig } from 'vite';

// GitHub Pagesのサブディレクトリ対応
// 環境変数からリポジトリ名を取得、なければ固定値を使用
const getBasePath = () => {
  // GitHub Actions環境では GITHUB_REPOSITORY が利用可能
  if (process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
    return `/${repoName}/`;
  }
  // 開発環境やローカルビルド時は固定値（リポジトリ名）
  return '/Audio-to-midi/';
};

export default defineConfig({
  base: getBasePath(),
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  }
});
