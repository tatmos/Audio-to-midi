# Audio to MIDI Converter

オーディオファイルからMIDIを生成するWebアプリケーションです。

## 機能

- **オーディオファイルの読み込み**: WAV、MP3などの音声ファイルをアップロード
- **波形表示**: アップロードしたオーディオの波形を可視化
- **範囲選択**: 
  - 波形上でドラッグして変換対象の範囲を指定
  - 開始位置・終了位置のハンドルをドラッグして調整
  - 範囲をドラッグして移動可能
- **プレビュー再生**: 
  - 選択範囲を再生して確認
  - 再生中の位置をオレンジの縦線で表示
  - スペースキーで再生/停止
  - 波形上をクリックして再生位置をシーク
- **MIDI出力**: 選択範囲をMIDIファイルとして書き出し（実装予定）

## セットアップ

### 必要な環境

- Node.js (v16以上推奨)
- npm または yarn

### インストール

```bash
npm install
```

## 開発

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` が自動的に開きます。

### ビルド

```bash
npm run build
```

ビルド結果は `dist/` ディレクトリに出力されます。

### プレビュー

```bash
npm run preview
```

ビルド後の結果をプレビューできます。

## 使い方

1. 「WAVファイルをアップロード」ボタンから音声ファイルを選択（またはドラッグ&ドロップ）
2. 波形上で範囲を選択（開始位置・終了位置をドラッグで調整）
3. 「▶ 再生」ボタンで選択範囲をプレビュー再生
4. 「MIDIに書き出す」ボタンでMIDIファイルをダウンロード

### キーボードショートカット

- `Space`: 再生/停止の切り替え

## プロジェクト構造

```
Audio-to-midi/
├── src/                      # ソースコード
│   ├── app.js                # メインアプリケーション
│   ├── audioPlayer.js        # オーディオ再生
│   ├── audioProcessor.js     # 音声処理（範囲抽出）
│   ├── uiController.js       # UI制御
│   ├── originalWaveformViewer.js  # 波形表示・範囲選択
│   └── style.css            # スタイル
├── index.html                 # エントリーポイント
├── package.json              # 依存関係
├── vite.config.js           # Vite設定
└── README.md                # このファイル
```

## 技術仕様

- **ビルドツール**: Vite
- **言語**: JavaScript (ES Modules)
- **主要ライブラリ**:
  - `@spotify/basic-pitch`: MIDI変換用（実装予定）
- **API**: Web Audio API

## ブラウザ要件

- Chrome、Firefox、Edge、Safariなどのモダンブラウザ
- Web Audio APIをサポートしている必要があります
- ES Modulesをサポートしている必要があります

## ライセンス

MIT License
