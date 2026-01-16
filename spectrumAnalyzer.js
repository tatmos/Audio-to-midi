// スペクトラムアナライザー描画クラス
class SpectrumAnalyzer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // 表示モード: 'spectrum'、'sonogram'、または 'waveform'
        this.mode = 'spectrum';
        
        // チャンネル選択: 'mix' (デフォルト), 'l' (左), 'r' (右)
        this.channel = 'mix';
        
        // ソノグラム用のデータバッファ（時間×周波数の2次元配列）
        this.sonogramData = [];
        this.sonogramColumnIndex = 0; // 現在描画している列のインデックス
        this.sonogramMaxColumns = 0; // キャンバス幅に応じた最大列数
        
        // 波形用のデータバッファ（時間×チャンネル×サンプルの3次元配列）
        this.waveformData = []; // 各列の波形データ
        this.waveformColumnIndex = 0; // 現在描画している列のインデックス
        this.waveformMaxColumns = 0; // キャンバス幅に応じた最大列数
        this.waveformOffscreenCanvas = null; // 波形用オフスクリーンキャンバス
        this.waveformOffscreenCtx = null;
        
        // パフォーマンス最適化用のオフスクリーンキャンバス
        this.sonogramOffscreenCanvas = null;
        this.sonogramOffscreenCtx = null;
        
        // 表示更新頻度（フレームごと）
        // 1 = 毎フレーム、2 = 2フレームに1回、...
        this.renderUpdateRate = 1;
        this.renderUpdateCounter = 0;

        // 周波数スケール（0:リニア, 1:ログ をブレンド）
        // 3kHz が常に中央(50%)に来るようにピボット補正する
        this.sonogramScaleLogBlend = 0.7; // 0.0 - 1.0
        this.sonogramScalePivotHz = 3000;
        this.sonogramMinFreqHz = 20;
        
        // 描画領域のマージン（ラベル用のスペース）
        this.marginLeft = 60;   // 左側の周波数ラベル用
        this.marginRight = 50;  // 右側のdBラベル用
        this.marginBottom = 20; // 下側の周波数ラベル用
        this.marginTop = 5;     // 上側のマージン
        
        // キャンバスのサイズを調整
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // モード切り替えボタンのイベントリスナーを設定
        this.setupModeButtons();
        
        // 更新頻度スライダーのイベントリスナーを設定
        this.setupUpdateRateSlider();
        
        // チャンネル選択ボタンのイベントリスナーを設定
        this.setupChannelButtons();
    }
    
    setupChannelButtons() {
        const mixBtn = document.getElementById('spectrum-channel-mix');
        const lBtn = document.getElementById('spectrum-channel-l');
        const rBtn = document.getElementById('spectrum-channel-r');
        
        if (mixBtn) {
            mixBtn.addEventListener('click', () => {
                this.setChannel('mix');
            });
        }
        
        if (lBtn) {
            lBtn.addEventListener('click', () => {
                this.setChannel('l');
            });
        }
        
        if (rBtn) {
            rBtn.addEventListener('click', () => {
                this.setChannel('r');
            });
        }
    }
    
    setChannel(channel) {
        this.channel = channel;
        
        // ボタンの状態を更新
        const mixBtn = document.getElementById('spectrum-channel-mix');
        const lBtn = document.getElementById('spectrum-channel-l');
        const rBtn = document.getElementById('spectrum-channel-r');
        
        if (mixBtn && lBtn && rBtn) {
            mixBtn.classList.remove('active');
            lBtn.classList.remove('active');
            rBtn.classList.remove('active');
            
            if (channel === 'mix') {
                mixBtn.classList.add('active');
            } else if (channel === 'l') {
                lBtn.classList.add('active');
            } else if (channel === 'r') {
                rBtn.classList.add('active');
            }
        }
    }
    
    setupModeButtons() {
        const spectrumBtn = document.getElementById('spectrum-mode-spectrum');
        const sonogramBtn = document.getElementById('spectrum-mode-sonogram');
        const waveformBtn = document.getElementById('spectrum-mode-waveform');
        
        if (spectrumBtn) {
            spectrumBtn.addEventListener('click', () => {
                this.setMode('spectrum');
            });
        }
        
        if (sonogramBtn) {
            sonogramBtn.addEventListener('click', () => {
                this.setMode('sonogram');
            });
        }
        
        if (waveformBtn) {
            waveformBtn.addEventListener('click', () => {
                this.setMode('waveform');
            });
        }
    }
    
    setupUpdateRateSlider() {
        const slider = document.getElementById('sonogram-update-rate');
        const valueDisplay = document.getElementById('sonogram-update-rate-value');
        const control = document.getElementById('sonogram-update-control');
        const scaleSlider = document.getElementById('sonogram-scale');
        const scaleValue = document.getElementById('sonogram-scale-value');
        
        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.renderUpdateRate = Math.max(1, value);
                valueDisplay.textContent = value;
            });
        }

        // 周波数スケール（%Log）
        if (scaleSlider && scaleValue) {
            scaleSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                const clamped = Math.max(0, Math.min(100, value));
                this.sonogramScaleLogBlend = clamped / 100;
                scaleValue.textContent = clamped;
            });
        }
    }

    /**
     * 周波数(Hz)を 0..1 にマップ（リニア↔ログのブレンド + ピボット補正）
     * - pivotHz が常に 0.5 に来るように、piecewise でリスケールする
     */
    freqToNorm(freqHz, sampleRate) {
        const maxFreq = sampleRate / 2;
        const minFreq = Math.max(1, this.sonogramMinFreqHz);
        const pivot = Math.max(minFreq, Math.min(maxFreq, this.sonogramScalePivotHz));
        const f = Math.max(minFreq, Math.min(maxFreq, freqHz));

        const tLin = f / maxFreq;
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        const tLog = (Math.log10(f) - logMin) / (logMax - logMin);

        const a = this.sonogramScaleLogBlend; // 0..1
        const t = (1 - a) * tLin + a * tLog;

        const pivotLin = pivot / maxFreq;
        const pivotLog = (Math.log10(pivot) - logMin) / (logMax - logMin);
        const pivotT = (1 - a) * pivotLin + a * pivotLog;

        // pivotT が 0 or 1 付近だと不安定なのでガード
        const eps = 1e-6;
        const p = Math.max(eps, Math.min(1 - eps, pivotT));

        if (t <= p) {
            return 0.5 * (t / p);
        }
        return 0.5 + 0.5 * ((t - p) / (1 - p));
    }
    
    setMode(mode) {
        this.mode = mode;
        
        // ボタンの状態を更新
        const spectrumBtn = document.getElementById('spectrum-mode-spectrum');
        const sonogramBtn = document.getElementById('spectrum-mode-sonogram');
        const waveformBtn = document.getElementById('spectrum-mode-waveform');
        
        if (spectrumBtn && sonogramBtn && waveformBtn) {
            spectrumBtn.classList.remove('active');
            sonogramBtn.classList.remove('active');
            waveformBtn.classList.remove('active');
            
            if (mode === 'spectrum') {
                spectrumBtn.classList.add('active');
            } else if (mode === 'sonogram') {
                sonogramBtn.classList.add('active');
            } else if (mode === 'waveform') {
                waveformBtn.classList.add('active');
            }
        }
        
        // ソノグラムモードに切り替えた場合、バッファをリセット
        if (mode === 'sonogram') {
            this.resetSonogram();
        }
        
        // 波形モードに切り替えた場合、バッファをリセット
        if (mode === 'waveform') {
            // バッファはリセットするが、オフスクリーンキャンバスは保持
            this.waveformData = [];
            this.waveformColumnIndex = 0;
            this.updateWaveformMaxColumns();
            // オフスクリーンキャンバスを初期化
            const drawWidth = this.width - this.marginLeft - this.marginRight;
            const drawHeight = this.height - this.marginTop - this.marginBottom;
            if (!this.waveformOffscreenCanvas) {
                this.waveformOffscreenCanvas = document.createElement('canvas');
                this.waveformOffscreenCanvas.width = drawWidth;
                this.waveformOffscreenCanvas.height = drawHeight;
                this.waveformOffscreenCtx = this.waveformOffscreenCanvas.getContext('2d');
            }
            this.waveformOffscreenCanvas.width = drawWidth;
            this.waveformOffscreenCanvas.height = drawHeight;
            this.waveformOffscreenCtx.fillStyle = '#1a1a1a';
            this.waveformOffscreenCtx.fillRect(0, 0, drawWidth, drawHeight);
        }

        // モード切替時にカウンターもリセット（体感の不整合を防ぐ）
        this.renderUpdateCounter = 0;
    }
    
    /**
     * 表示の更新が必要かどうかをチェック（スペクトラム/ソノグラム共通）
     */
    shouldUpdateRender() {
        this.renderUpdateCounter++;
        if (this.renderUpdateCounter >= this.renderUpdateRate) {
            this.renderUpdateCounter = 0;
            return true;
        }
        return false;
    }
    
    resetSonogram() {
        this.sonogramData = [];
        this.sonogramColumnIndex = 0;
        this.updateSonogramMaxColumns();
        // オフスクリーンキャンバスもリセット
        if (this.sonogramOffscreenCanvas && this.sonogramOffscreenCtx) {
            this.sonogramOffscreenCtx.fillStyle = '#000000';
            this.sonogramOffscreenCtx.fillRect(0, 0, this.sonogramOffscreenCanvas.width, this.sonogramOffscreenCanvas.height);
        }
    }
    
    updateSonogramMaxColumns() {
        // キャンバス幅に応じて最大列数を計算（時間軸の表示量を半分に）
        // 描画領域の幅を使用（マージンを除く）
        const drawWidth = this.width - this.marginLeft - this.marginRight;
        // 1ピクセル = 1列ではなく、2ピクセル = 1列として表示量を減らす
        this.sonogramMaxColumns = Math.max(1, Math.floor(drawWidth / 2));
    }
    
    updateWaveformMaxColumns() {
        // キャンバス幅に応じて最大列数を計算（時間軸の表示量を半分に）
        // 描画領域の幅を使用（マージンを除く）
        const drawWidth = this.width - this.marginLeft - this.marginRight;
        // 1ピクセル = 1列ではなく、2ピクセル = 1列として表示量を減らす
        this.waveformMaxColumns = Math.max(1, Math.floor(drawWidth / 2));
    }
    
    resetWaveform() {
        this.waveformData = [];
        this.waveformColumnIndex = 0;
        this.updateWaveformMaxColumns();
        // オフスクリーンキャンバスもリセット
        const drawWidth = this.width - this.marginLeft - this.marginRight;
        const drawHeight = this.height - this.marginTop - this.marginBottom;
        if (this.waveformOffscreenCanvas && this.waveformOffscreenCtx) {
            this.waveformOffscreenCanvas.width = drawWidth;
            this.waveformOffscreenCanvas.height = drawHeight;
            this.waveformOffscreenCtx.fillStyle = '#1a1a1a';
            this.waveformOffscreenCtx.fillRect(0, 0, drawWidth, drawHeight);
        }
    }
    
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const oldWidth = this.width;
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        
        // 幅が変わった場合、ソノグラムと波形の最大列数を更新
        if (oldWidth !== this.width) {
            this.updateSonogramMaxColumns();
            this.updateWaveformMaxColumns();
            // ソノグラムデータをリセット（幅が変わったため）
            if (this.mode === 'sonogram') {
                this.resetSonogram();
                // オフスクリーンキャンバスも再作成（描画領域のサイズ）
                if (this.sonogramOffscreenCanvas) {
                    const drawWidth = this.width - this.marginLeft - this.marginRight;
                    const drawHeight = this.height - this.marginTop - this.marginBottom;
                    this.sonogramOffscreenCanvas.width = drawWidth;
                    this.sonogramOffscreenCanvas.height = drawHeight;
                }
            }
            // 波形データをリセット（幅が変わったため）
            if (this.mode === 'waveform') {
                this.resetWaveform();
                // オフスクリーンキャンバスも再作成（描画領域のサイズ）
                if (this.waveformOffscreenCanvas) {
                    const drawWidth = this.width - this.marginLeft - this.marginRight;
                    const drawHeight = this.height - this.marginTop - this.marginBottom;
                    this.waveformOffscreenCanvas.width = drawWidth;
                    this.waveformOffscreenCanvas.height = drawHeight;
                }
            }
        }
    }
    
    /**
     * 周波数スペクトラムまたは波形を描画
     * @param {Uint8Array} frequencyData - 周波数データ（0-255）
     * @param {number} sampleRate - サンプルレート
     * @param {number} fftSize - FFTサイズ
     * @param {Float32Array|Array<Float32Array>} timeDomainData - 時系列データ（波形モード用、オプション）
     */
    draw(frequencyData, sampleRate, fftSize, timeDomainData = null) {
        if (this.mode === 'waveform') {
            if (timeDomainData) {
                this.drawWaveform(timeDomainData, sampleRate);
            } else {
                this.clear();
            }
        } else if (this.mode === 'sonogram') {
            if (!frequencyData || frequencyData.length === 0) {
                this.clear();
                return;
            }
            this.drawSonogram(frequencyData, sampleRate, fftSize);
        } else {
            if (!frequencyData || frequencyData.length === 0) {
                this.clear();
                return;
            }
            this.drawSpectrum(frequencyData, sampleRate, fftSize);
        }
    }
    
    /**
     * スペクトラム表示を描画
     */
    drawSpectrum(frequencyData, sampleRate, fftSize) {
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        
        // 描画領域（マージンを除いた領域）
        const drawX = this.marginLeft;
        const drawY = this.marginTop;
        const drawWidth = width - this.marginLeft - this.marginRight;
        const drawHeight = height - this.marginTop - this.marginBottom;
        
        // 背景をクリア
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // グリッドを描画（描画領域内）
        this.drawGrid(ctx, drawX, drawY, drawWidth, drawHeight);
        
        // 周波数軸のラベルを描画（描画領域の外側）
        this.drawFrequencyLabels(ctx, width, height, drawX, drawY, drawWidth, drawHeight, sampleRate, fftSize);
        
        // スペクトラムを描画（周波数スケール対応、描画領域内）
        // 周波数ビン -> x へ非線形マップすると「複数ビンが同じx」に落ちるので、
        // xごとに最大値を集約して描画（軽量）
        const maxFreq = sampleRate / 2;
        const w = Math.max(1, Math.floor(drawWidth));
        const maxByX = new Uint8Array(w);

        for (let i = 0; i < frequencyData.length; i++) {
            const f0 = (i / frequencyData.length) * maxFreq;
            const f1 = ((i + 1) / frequencyData.length) * maxFreq;
            const x0 = Math.floor(this.freqToNorm(f0, sampleRate) * (w - 1));
            const x1 = Math.floor(this.freqToNorm(f1, sampleRate) * (w - 1));
            const v = frequencyData[i];

            const xa = Math.max(0, Math.min(w - 1, Math.min(x0, x1)));
            const xb = Math.max(0, Math.min(w - 1, Math.max(x0, x1)));
            for (let x = xa; x <= xb; x++) {
                if (v > maxByX[x]) maxByX[x] = v;
            }
        }

        ctx.fillStyle = '#667eea';
        for (let x = 0; x < w; x++) {
            const v = maxByX[x];
            const barHeight = (v / 255) * drawHeight * 0.9;
            const y = drawY + drawHeight - barHeight;
            ctx.fillRect(drawX + x, y, 1, barHeight);
        }
        
        // 対数スケールでより見やすくする（オプション）
        // 低周波数域を強調表示
        // this.drawLogScale(ctx, frequencyData, drawX, drawY, drawWidth, drawHeight, sampleRate, fftSize);
    }
    
    /**
     * ソノグラム表示を描画
     */
    drawSonogram(frequencyData, sampleRate, fftSize) {
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        
        // 描画領域（マージンを除いた領域）
        const drawX = this.marginLeft;
        const drawY = this.marginTop;
        const drawWidth = width - this.marginLeft - this.marginRight;
        const drawHeight = height - this.marginTop - this.marginBottom;
        
        // 現在の周波数データをバッファに追加
        const columnData = new Uint8Array(frequencyData.length);
        for (let i = 0; i < frequencyData.length; i++) {
            columnData[i] = frequencyData[i];
        }
        
        // バッファに追加（左から右へ）
        // sonogramColumnIndexは0からsonogramMaxColumns-1まで循環
        const colIndex = this.sonogramColumnIndex % this.sonogramMaxColumns;
        this.sonogramData[colIndex] = columnData;
        this.sonogramColumnIndex++;
        
        // オフスクリーンキャンバスを使用してパフォーマンスを向上
        if (!this.sonogramOffscreenCanvas) {
            this.sonogramOffscreenCanvas = document.createElement('canvas');
            this.sonogramOffscreenCanvas.width = drawWidth;
            this.sonogramOffscreenCanvas.height = drawHeight;
            this.sonogramOffscreenCtx = this.sonogramOffscreenCanvas.getContext('2d');
            // 初期クリア
            this.sonogramOffscreenCtx.fillStyle = '#000000';
            this.sonogramOffscreenCtx.fillRect(0, 0, drawWidth, drawHeight);
        }

        // リサイズ等でサイズがずれていたら合わせる
        if (this.sonogramOffscreenCanvas.width !== drawWidth || this.sonogramOffscreenCanvas.height !== drawHeight) {
            this.sonogramOffscreenCanvas.width = drawWidth;
            this.sonogramOffscreenCanvas.height = drawHeight;
            this.sonogramOffscreenCtx.fillStyle = '#000000';
            this.sonogramOffscreenCtx.fillRect(0, 0, drawWidth, drawHeight);
        }
        
        const offscreenCtx = this.sonogramOffscreenCtx;

        // 仕様どおり「左から上書き」: 上書き対象の列だけ消して描き直す
        const columnWidth = drawWidth / this.sonogramMaxColumns;
        const x = colIndex * columnWidth;
        offscreenCtx.fillStyle = '#000000';
        offscreenCtx.fillRect(x, 0, Math.ceil(columnWidth), drawHeight);
        this.drawSonogramColumn(offscreenCtx, columnData, colIndex, drawWidth, drawHeight, sampleRate, fftSize);
        
        // 背景をクリア
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        
        // オフスクリーンキャンバスをメインキャンバスにコピー（描画領域内）
        ctx.drawImage(this.sonogramOffscreenCanvas, drawX, drawY);
        
        // 周波数軸のラベルを描画（描画領域の外側）
        this.drawSonogramLabels(ctx, width, height, drawX, drawY, drawWidth, drawHeight, sampleRate, fftSize);
    }
    
    /**
     * ソノグラムの1列を描画（最適化版）
     */
    drawSonogramColumn(ctx, columnData, colIndex, drawWidth, drawHeight, sampleRate, fftSize) {
        const columnWidth = drawWidth / this.sonogramMaxColumns;
        const x = colIndex * columnWidth;

        const maxFreq = sampleRate / 2;
        const minFreq = this.sonogramMinFreqHz;

        // 周波数ビン境界を「ブレンドスケール + 3kHzピボット中央」へマップして描画
        for (let freqBin = 0; freqBin < columnData.length; freqBin++) {
            const value = columnData[freqBin];
            
            // 周波数ビンの下限と上限を計算（線形）
            const binStartFreq = (freqBin / columnData.length) * maxFreq;
            const binEndFreq = ((freqBin + 1) / columnData.length) * maxFreq;
            
            // 最小周波数未満のビンはスキップ
            if (binEndFreq < minFreq) continue;

            const n0 = this.freqToNorm(Math.max(minFreq, binStartFreq), sampleRate);
            const n1 = this.freqToNorm(Math.max(minFreq, binEndFreq), sampleRate);
            const yBottom = drawHeight - n0 * drawHeight; // 低周波側
            const yTop = drawHeight - n1 * drawHeight;    // 高周波側
            
            // ビンの高さを計算
            const binHeight = yBottom - yTop;
            
            if (binHeight > 0 && yTop >= 0 && yBottom <= drawHeight) {
                // カラーマップを適用（黒→青→オレンジ→黄色→白）
                const color = this.valueToColor(value);
                
                ctx.fillStyle = color;
                ctx.fillRect(x, yTop, columnWidth, binHeight);
            }
        }
    }
    
    /**
     * 値（0-255）をカラーに変換
     * 黒→青→オレンジ→黄色→白のグラデーション
     */
    valueToColor(value) {
        const normalized = value / 255; // 0.0 - 1.0
        
        if (normalized < 0.25) {
            // 黒 → 青 (0.0 - 0.25)
            const t = normalized / 0.25;
            const r = 0;
            const g = Math.floor(t * 100);
            const b = Math.floor(50 + t * 155);
            return `rgb(${r}, ${g}, ${b})`;
        } else if (normalized < 0.5) {
            // 青 → オレンジ (0.25 - 0.5)
            const t = (normalized - 0.25) / 0.25;
            const r = Math.floor(t * 255);
            const g = Math.floor(100 + t * 100);
            const b = Math.floor(205 - t * 155);
            return `rgb(${r}, ${g}, ${b})`;
        } else if (normalized < 0.75) {
            // オレンジ → 黄色 (0.5 - 0.75)
            const t = (normalized - 0.5) / 0.25;
            const r = 255;
            const g = Math.floor(200 + t * 55);
            const b = Math.floor(50 - t * 50);
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // 黄色 → 白 (0.75 - 1.0)
            const t = (normalized - 0.75) / 0.25;
            const r = 255;
            const g = Math.floor(255 - t * 55);
            const b = Math.floor(t * 255);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }
    
    /**
     * ソノグラム用のラベルを描画（対数スケール）
     */
    drawSonogramLabels(ctx, width, height, drawX, drawY, drawWidth, drawHeight, sampleRate, fftSize) {
        ctx.fillStyle = '#999';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        // 周波数ラベル（左側）- 画像のように詳細なラベル（描画領域の外側）
        const freqLabels = [
            20000, 15000, 12000, 10000, 8000, 7000, 6000, 5000, 4000, 3500,
            3000, 2500, 2000, 1500, 1200, 1000, 700, 500, 300, 200, 100
        ];
        const maxFreq = sampleRate / 2;
        const minFreq = this.sonogramMinFreqHz;
        
        freqLabels.forEach(freq => {
            if (freq >= minFreq && freq <= maxFreq) {
                // ブレンドスケール + ピボット補正でY座標を計算
                const n = this.freqToNorm(freq, sampleRate);
                const y = drawY + drawHeight - n * drawHeight;
                
                if (y >= drawY && y <= drawY + drawHeight) {
                    ctx.fillText(this.formatFrequency(freq), drawX - 5, y);
                }
            }
        });
        
        // 単位ラベル（最下部、左側）
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'right';
        ctx.fillText('Hz', drawX - 5, drawY + drawHeight + 3);
    }
    
    /**
     * グリッドを描画
     */
    drawGrid(ctx, drawX, drawY, drawWidth, drawHeight) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        // 水平線（dBレベル）
        const dbLevels = [0, -6, -12, -18, -24, -30, -36, -42, -48, -54, -60];
        dbLevels.forEach((db, index) => {
            const y = drawY + (index / (dbLevels.length - 1)) * drawHeight * 0.9;
            ctx.beginPath();
            ctx.moveTo(drawX, y);
            ctx.lineTo(drawX + drawWidth, y);
            ctx.stroke();
        });
        
        // 垂直線（周波数）
        const freqLines = 10;
        for (let i = 0; i <= freqLines; i++) {
            const x = drawX + (i / freqLines) * drawWidth;
            ctx.beginPath();
            ctx.moveTo(x, drawY);
            ctx.lineTo(x, drawY + drawHeight);
            ctx.stroke();
        }
    }
    
    /**
     * 周波数ラベルを描画
     */
    drawFrequencyLabels(ctx, width, height, drawX, drawY, drawWidth, drawHeight, sampleRate, fftSize) {
        ctx.fillStyle = '#999';
        ctx.font = '11px monospace';
        
        // 周波数ラベル（Hz）- 下側に描画（描画領域の外側）
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const freqLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        const maxFreq = sampleRate / 2;
        
        freqLabels.forEach(freq => {
            if (freq <= maxFreq) {
                // 周波数スケール（リニア↔ログのブレンド + ピボット補正）でx座標へ
                const x = drawX + this.freqToNorm(freq, sampleRate) * drawWidth;
                
                if (x >= drawX && x <= drawX + drawWidth) {
                    ctx.fillText(this.formatFrequency(freq), x, drawY + drawHeight + 3);
                }
            }
        });
        
        // dBレベルラベル - 右側に描画（描画領域の外側）
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const dbLevels = [0, -12, -24, -36, -48, -60];
        dbLevels.forEach((db, index) => {
            const y = drawY + (index / (dbLevels.length - 1)) * drawHeight * 0.9;
            ctx.fillText(db + 'dB', drawX + drawWidth + 5, y);
        });
    }
    
    /**
     * 対数スケールでスペクトラムを描画（低周波数域を強調）
     */
    drawLogScale(ctx, frequencyData, drawX, drawY, drawWidth, drawHeight, sampleRate, fftSize) {
        // 対数スケール用のオーバーレイ（オプション）
        // ここでは実装を簡略化
    }
    
    /**
     * 波形を描画（ソノグラムと同様に左から右へ、右端までいったら左から上書き）
     */
    drawWaveform(timeDomainData, sampleRate) {
        if (!timeDomainData || !Array.isArray(timeDomainData) || timeDomainData.length === 0) {
            this.clear();
            return;
        }
        
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        
        // 描画領域（マージンを除いた領域）
        const drawX = this.marginLeft;
        const drawY = this.marginTop;
        const drawWidth = width - this.marginLeft - this.marginRight;
        const drawHeight = height - this.marginTop - this.marginBottom;
        
        // 時系列データを配列に変換（複数チャンネルの場合）
        const channels = Array.isArray(timeDomainData) ? timeDomainData : [timeDomainData];
        const numChannels = channels.length;
        
        // 有効なチャンネルデータをフィルタリング
        const validChannels = channels.filter(ch => ch && ch.length > 0);
        if (validChannels.length === 0) {
            this.clear();
            return;
        }
        
        // 現在の列のデータをバッファに追加
        const columnData = validChannels.map(ch => {
            const data = new Float32Array(ch.length);
            for (let i = 0; i < ch.length; i++) {
                data[i] = ch[i];
            }
            return data;
        });
        
        // バッファに追加（左から右へ）
        const colIndex = this.waveformColumnIndex % this.waveformMaxColumns;
        this.waveformData[colIndex] = columnData;
        this.waveformColumnIndex++;
        
        // オフスクリーンキャンバスを使用してパフォーマンスを向上
        if (!this.waveformOffscreenCanvas) {
            this.waveformOffscreenCanvas = document.createElement('canvas');
            this.waveformOffscreenCanvas.width = drawWidth;
            this.waveformOffscreenCanvas.height = drawHeight;
            this.waveformOffscreenCtx = this.waveformOffscreenCanvas.getContext('2d');
            // 初期クリア
            this.waveformOffscreenCtx.fillStyle = '#1a1a1a';
            this.waveformOffscreenCtx.fillRect(0, 0, drawWidth, drawHeight);
        }

        // リサイズ等でサイズがずれていたら合わせる
        if (this.waveformOffscreenCanvas.width !== drawWidth || this.waveformOffscreenCanvas.height !== drawHeight) {
            this.waveformOffscreenCanvas.width = drawWidth;
            this.waveformOffscreenCanvas.height = drawHeight;
            this.waveformOffscreenCtx.fillStyle = '#1a1a1a';
            this.waveformOffscreenCtx.fillRect(0, 0, drawWidth, drawHeight);
        }
        
        const offscreenCtx = this.waveformOffscreenCtx;

        // 仕様どおり「左から上書き」: 上書き対象の列だけ消して描き直す
        const columnWidth = drawWidth / this.waveformMaxColumns;
        const x = colIndex * columnWidth;
        
        // 上書き対象の列をクリア
        offscreenCtx.fillStyle = '#1a1a1a';
        offscreenCtx.fillRect(x, 0, Math.ceil(columnWidth), drawHeight);
        
        // 新しい列を描画
        this.drawWaveformColumn(offscreenCtx, columnData, colIndex, drawWidth, drawHeight, validChannels.length);
        
        // 背景をクリア
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // オフスクリーンキャンバスをメインキャンバスにコピー（描画領域内）
        ctx.drawImage(this.waveformOffscreenCanvas, drawX, drawY);
        
        // グリッドを描画
        this.drawWaveformGrid(ctx, drawX, drawY, drawWidth, drawHeight, validChannels.length);
    }
    
    /**
     * 波形の全データを再描画（モード切り替え時など）
     */
    redrawAllWaveform() {
        if (this.mode !== 'waveform' || !this.waveformOffscreenCanvas || !this.waveformOffscreenCtx) {
            return;
        }
        
        const drawWidth = this.width - this.marginLeft - this.marginRight;
        const drawHeight = this.height - this.marginTop - this.marginBottom;
        
        // オフスクリーンキャンバスをクリア
        this.waveformOffscreenCtx.fillStyle = '#1a1a1a';
        this.waveformOffscreenCtx.fillRect(0, 0, drawWidth, drawHeight);
        
        // 全列を再描画
        for (let i = 0; i < this.waveformData.length; i++) {
            if (this.waveformData[i] && this.waveformData[i].length > 0) {
                const numChannels = this.waveformData[i].length;
                this.drawWaveformColumn(this.waveformOffscreenCtx, this.waveformData[i], i % this.waveformMaxColumns, drawWidth, drawHeight, numChannels);
            }
        }
    }
    
    /**
     * 波形の1列を描画
     */
    drawWaveformColumn(ctx, columnData, colIndex, drawWidth, drawHeight, numChannels) {
        const columnWidth = drawWidth / this.waveformMaxColumns;
        const x = colIndex * columnWidth;
        const channelHeight = drawHeight / numChannels;
        
        for (let ch = 0; ch < numChannels; ch++) {
            const channelData = columnData[ch];
            if (!channelData || channelData.length === 0) continue;
            
            const yOffset = ch * channelHeight;
            const centerY = yOffset + channelHeight / 2;
            
            // 波形を描画
            ctx.strokeStyle = ch === 0 ? '#667eea' : '#764ba2';
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            // サンプルをピクセルにマッピング
            const samplesPerPixel = Math.max(1, Math.floor(channelData.length / columnWidth));
            
            for (let px = 0; px < columnWidth; px++) {
                const sampleStart = px * samplesPerPixel;
                const sampleEnd = Math.min(channelData.length, (px + 1) * samplesPerPixel);
                
                // このピクセル範囲の最大値と最小値を計算
                let max = -Infinity;
                let min = Infinity;
                for (let i = sampleStart; i < sampleEnd; i++) {
                    const value = channelData[i];
                    if (value > max) max = value;
                    if (value < min) min = value;
                }
                
                if (max === -Infinity || min === Infinity) continue;
                
                const yTop = centerY - (max * channelHeight / 2 * 0.9);
                const yBottom = centerY - (min * channelHeight / 2 * 0.9);
                
                if (px === 0) {
                    ctx.moveTo(x + px, yTop);
                } else {
                    ctx.lineTo(x + px, yTop);
                }
            }
            
            // 下側の波形（逆順）
            for (let px = columnWidth - 1; px >= 0; px--) {
                const sampleStart = px * samplesPerPixel;
                const sampleEnd = Math.min(channelData.length, (px + 1) * samplesPerPixel);
                
                let min = Infinity;
                for (let i = sampleStart; i < sampleEnd; i++) {
                    const value = channelData[i];
                    if (value < min) min = value;
                }
                
                if (min === Infinity) continue;
                
                const yBottom = centerY - (min * channelHeight / 2 * 0.9);
                ctx.lineTo(x + px, yBottom);
            }
            
            ctx.closePath();
            ctx.stroke();
        }
    }
    
    /**
     * 波形用のグリッドを描画
     */
    drawWaveformGrid(ctx, drawX, drawY, drawWidth, drawHeight, numChannels) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        // 水平線（チャンネル境界）
        for (let i = 0; i <= numChannels; i++) {
            const y = drawY + (i / numChannels) * drawHeight;
            ctx.beginPath();
            ctx.moveTo(drawX, y);
            ctx.lineTo(drawX + drawWidth, y);
            ctx.stroke();
        }
        
        // 垂直線（時間軸）
        const timeLines = 10;
        for (let i = 0; i <= timeLines; i++) {
            const x = drawX + (i / timeLines) * drawWidth;
            ctx.beginPath();
            ctx.moveTo(x, drawY);
            ctx.lineTo(x, drawY + drawHeight);
            ctx.stroke();
        }
    }
    
    /**
     * 周波数をフォーマット（Hz, kHz）
     */
    formatFrequency(freq) {
        if (freq >= 1000) {
            const khz = freq / 1000;
            // 整数の場合は小数点以下を表示しない
            if (khz === Math.floor(khz)) {
                return Math.floor(khz) + 'k';
            }
            // 小数点以下1桁まで表示
            return khz.toFixed(1) + 'k';
        }
        return freq.toString();
    }
    
    /**
     * キャンバスをクリア
     */
    clear() {
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        
        if (this.mode === 'sonogram') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
            // ソノグラムデータもリセット
            this.resetSonogram();
        } else if (this.mode === 'waveform') {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);
            // 波形データもリセット
            this.resetWaveform();
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);
        }
        
        // メッセージを表示
        ctx.fillStyle = '#666';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const message = this.mode === 'waveform' ? '再生中に波形が表示されます' : '再生中にスペクトラムが表示されます';
        ctx.fillText(message, width / 2, height / 2);
    }
}
