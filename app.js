// LoopMaker - ループ波形エディタ
class LoopMaker {
    constructor() {
        this.audioContext = null;
        this.originalBuffer1 = null; // 元波形1のバッファ
        this.originalBuffer2 = null; // 元波形2のバッファ
        this.track1Buffer = null; // トラック1の加工後のバッファ
        this.track2Buffer = null; // トラック2の加工後のバッファ
        this.mixedBuffer = null; // トラック1と2をミックスしたバッファ
        this.audioProcessor = null;
        this.audioPlayer = null;
        this.waveformRenderer = null;
        this.originalWaveformViewer1 = null;
        this.originalWaveformViewer2 = null;
        this.animationFrameId = null;
        this.useRangeStart1 = 0; // 元波形1の利用範囲の開始位置
        this.useRangeEnd1 = 0; // 元波形1の利用範囲の終了位置
        this.useRangeStart2 = 0; // 元波形2の利用範囲の開始位置
        this.useRangeEnd2 = 0; // 元波形2の利用範囲の終了位置
        
        this.initializeElements();
        this.uiController = new UIController(this);
    }

    initializeElements() {
        const originalCanvas1 = document.getElementById('original-waveform-1');
        const originalRuler1 = document.getElementById('ruler-original-1');
        const originalCanvas2 = document.getElementById('original-waveform-2');
        const originalRuler2 = document.getElementById('ruler-original-2');
        const canvas1 = document.getElementById('waveform-track1');
        const canvas2 = document.getElementById('waveform-track2');
        const ruler1 = document.getElementById('ruler-track1');
        const ruler2 = document.getElementById('ruler-track2');
        this.levelMeter1L = document.getElementById('level-meter-track1-l');
        this.levelMeter1R = document.getElementById('level-meter-track1-r');
        this.levelMeter2L = document.getElementById('level-meter-track2-l');
        this.levelMeter2R = document.getElementById('level-meter-track2-r');
        this.processedLevelMetersContainer = document.getElementById('processed-level-meters');
        const spectrumCanvas = document.getElementById('spectrum-canvas');
        
        this.originalWaveformViewer1 = new OriginalWaveformViewer(originalCanvas1, originalRuler1);
        this.originalWaveformViewer1.onRangeChange = (startTime, endTime) => {
            this.useRangeStart1 = startTime;
            this.useRangeEnd1 = endTime;
            this.updateBuffers();
            this.drawWaveforms();
        };
        
        this.originalWaveformViewer2 = new OriginalWaveformViewer(originalCanvas2, originalRuler2);
        this.originalWaveformViewer2.onRangeChange = (startTime, endTime) => {
            this.useRangeStart2 = startTime;
            this.useRangeEnd2 = endTime;
            this.updateBuffers();
            this.drawWaveforms();
        };
        
        this.waveformRenderer = new WaveformRenderer(canvas1, canvas2, ruler1, ruler2);
        
        // リージョンコントローラーを初期化
        this.regionController1 = new RegionController(this, canvas1, 1);
        this.regionController2 = new RegionController(this, canvas2, 2);
        
        // トラックの表示範囲（同期用）
        this.trackDisplayDuration = 0;
        
        // エフェクトのUIとProcessorを初期化（audioContextとaudioProcessorは後で設定）
        this.pitchTransposeUI = null;
        this.pitchTransposeProcessor = null;
        this.multibandCompUI = null;
        this.multibandCompProcessor = null;
        this.spatialDesignUI = null;
        this.spatialDesignProcessor = null;
        
        // スペクトラムアナライザーを初期化
        this.spectrumAnalyzer = null;
        if (spectrumCanvas) {
            this.spectrumAnalyzer = new SpectrumAnalyzer(spectrumCanvas);
            this.spectrumAnalyzer.clear(); // 初期状態をクリア
        }
    }

    updateBuffers() {
        if (!this.audioProcessor) return;
        
        // 再生中の場合、現在の再生位置を保持
        const wasPlaying = this.audioPlayer && this.audioPlayer.isPlaying;
        let currentPlaybackTime = null;
        if (wasPlaying) {
            currentPlaybackTime = this.audioPlayer.getCurrentPlaybackTime();
            if (currentPlaybackTime !== null) {
                // 新しいバッファの長さに合わせてクリップ
                const oldDuration = this.track1Buffer ? this.track1Buffer.duration : 0;
            }
        }
        
        // 元波形1と元波形2の選択範囲の長さを計算
        const range1Duration = this.originalBuffer1 ? (this.useRangeEnd1 - this.useRangeStart1) : 0;
        const range2Duration = this.originalBuffer2 ? (this.useRangeEnd2 - this.useRangeStart2) : 0;
        
        // 長い方を基準にする
        const baseDuration = Math.max(range1Duration, range2Duration);
        
        // どちらかのバッファがない場合は処理をスキップ
        if (baseDuration <= 0) return;
        
        // トラックの表示範囲を同期（長い方を基準）
        this.trackDisplayDuration = baseDuration;
        
        // 元波形1から利用範囲を抽出（トラック1用）
        let useRangeBuffer1 = null;
        if (this.originalBuffer1) {
            useRangeBuffer1 = this.audioProcessor.extractRange(
                this.originalBuffer1,
                this.useRangeStart1,
                this.useRangeEnd1
            );
        }
        
        // 元波形2から利用範囲を抽出（トラック2用）
        let useRangeBuffer2 = null;
        if (this.originalBuffer2) {
            useRangeBuffer2 = this.audioProcessor.extractRange(
                this.originalBuffer2,
                this.useRangeStart2,
                this.useRangeEnd2
            );
        }
        
        // トラック1の加工後のバッファを生成（元波形1を使用、baseDurationに合わせる）
        if (useRangeBuffer1) {
            // ピッチシフトを適用
            let processedBuffer = useRangeBuffer1;
            if (this.pitchTransposeProcessor) {
                processedBuffer = this.pitchTransposeProcessor.applyPitchShift(processedBuffer, 1);
            }
            
            this.track1Buffer = this.audioProcessor.track1Processor.createSaveBuffer(
                processedBuffer
            );
            
            // baseDurationに合わせて調整（必要に応じて）
            if (this.track1Buffer.duration < baseDuration) {
                // バッファを延長（無音で埋める）
                const extendedBuffer = this.extendBuffer(this.track1Buffer, baseDuration);
                this.track1Buffer = extendedBuffer;
            } else if (this.track1Buffer.duration > baseDuration) {
                // バッファを切り詰める
                const trimmedBuffer = this.trimBuffer(this.track1Buffer, baseDuration);
                this.track1Buffer = trimmedBuffer;
            }
        } else {
            // 元波形1がない場合は空のバッファを作成（ステレオに統一）
            const sampleRate = this.audioContext.sampleRate;
            this.track1Buffer = this.audioContext.createBuffer(2, Math.floor(baseDuration * sampleRate), sampleRate);
        }
        
        // トラック2の加工後のバッファを生成（元波形2を使用、baseDurationに合わせる）
        if (useRangeBuffer2) {
            // ピッチシフトを適用
            let processedBuffer = useRangeBuffer2;
            if (this.pitchTransposeProcessor) {
                processedBuffer = this.pitchTransposeProcessor.applyPitchShift(processedBuffer, 2);
            }
            
            this.track2Buffer = this.audioProcessor.track2Processor.createSaveBuffer(
                processedBuffer, 
                baseDuration
            );
            
            // baseDurationに合わせて調整（必要に応じて）
            if (this.track2Buffer.duration < baseDuration) {
                // バッファを延長（無音で埋める）
                const extendedBuffer = this.extendBuffer(this.track2Buffer, baseDuration);
                this.track2Buffer = extendedBuffer;
            } else if (this.track2Buffer.duration > baseDuration) {
                // バッファを切り詰める
                const trimmedBuffer = this.trimBuffer(this.track2Buffer, baseDuration);
                this.track2Buffer = trimmedBuffer;
            }
        } else {
            // 元波形2がない場合は空のバッファを作成（ステレオに統一）
            const sampleRate = this.audioContext.sampleRate;
            this.track2Buffer = this.audioContext.createBuffer(2, Math.floor(baseDuration * sampleRate), sampleRate);
        }
        
        // トラック1と2をミックスしたバッファを生成
        this.mixedBuffer = this.audioProcessor.mixBuffers(this.track1Buffer, this.track2Buffer);
        
        // 再生中だった場合、新しいバッファで再生を再開
        if (wasPlaying && this.audioPlayer && this.track1Buffer && this.track2Buffer) {
            const newDuration = this.track1Buffer.duration;
            if (newDuration > 0) {
                // 現在のミュート状態を保存
                const track1Muted = this.uiController && this.uiController.track1Muted ? this.uiController.track1Muted : false;
                const track2Muted = this.uiController && this.uiController.track2Muted ? this.uiController.track2Muted : false;
                
                // 新しいバッファの長さに合わせて再生位置をクリップ
                let seekTime = currentPlaybackTime !== null ? currentPlaybackTime : 0;
                seekTime = Math.max(0, Math.min(newDuration, seekTime));
                this.audioPlayer.stopPreview();
                
                // プレビュー用バッファを生成（リージョン情報から）
                const previewTrack1 = this.buildPreviewBufferFromRegions ? this.buildPreviewBufferFromRegions(1) : this.track1Buffer;
                const previewTrack2 = this.buildPreviewBufferFromRegions ? this.buildPreviewBufferFromRegions(2) : this.track2Buffer;
                
                if (previewTrack1 && previewTrack2) {
                    this.audioPlayer.playPreviewWithBuffers(previewTrack1, previewTrack2, seekTime);
                    
                    // ミュート状態を復元
                    if (track1Muted) {
                        this.audioPlayer.setTrack1Mute(true);
                    }
                    if (track2Muted) {
                        this.audioPlayer.setTrack2Mute(true);
                    }
                } else {
                    this.audioPlayer.playPreviewWithBuffers(this.track1Buffer, this.track2Buffer, seekTime);
                    
                    // ミュート状態を復元
                    if (track1Muted) {
                        this.audioPlayer.setTrack1Mute(true);
                    }
                    if (track2Muted) {
                        this.audioPlayer.setTrack2Mute(true);
                    }
                }
            }
        }
    }
    
    // バッファを延長（無音で埋める）
    extendBuffer(audioBuffer, targetDuration) {
        const sampleRate = this.audioContext.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const currentLength = audioBuffer.length;
        const targetLength = Math.floor(targetDuration * sampleRate);
        
        if (targetLength <= currentLength) {
            return audioBuffer;
        }
        
        const extendedBuffer = this.audioContext.createBuffer(numChannels, targetLength, sampleRate);
        
        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = extendedBuffer.getChannelData(channel);
            
            // 既存のデータをコピー
            for (let i = 0; i < currentLength; i++) {
                outputData[i] = inputData[i];
            }
            
            // 残りを無音で埋める（既に0で初期化されている）
        }
        
        return extendedBuffer;
    }
    
    // バッファを切り詰める
    trimBuffer(audioBuffer, targetDuration) {
        const sampleRate = this.audioContext.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const targetLength = Math.floor(targetDuration * sampleRate);
        
        if (targetLength >= audioBuffer.length) {
            return audioBuffer;
        }
        
        const trimmedBuffer = this.audioContext.createBuffer(numChannels, targetLength, sampleRate);
        
        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = trimmedBuffer.getChannelData(channel);
            
            // 指定された長さまでコピー
            for (let i = 0; i < targetLength; i++) {
                outputData[i] = inputData[i];
            }
        }
        
        return trimmedBuffer;
    }

    /**
     * リージョン情報からプレビュー用のトラックバッファを生成
     * - トラック全体は無音
     * - 各リージョン位置に元波形の指定範囲を埋め込む
     * @param {number} trackNumber 1 or 2
     * @returns {AudioBuffer}
     */
    buildPreviewBufferFromRegions(trackNumber) {
        if (!this.audioContext) return null;

        const regionController = trackNumber === 1 ? this.regionController1 : this.regionController2;
        const regions = regionController && regionController.getRegions ? regionController.getRegions() : [];

        // 元波形と利用範囲（グローバルな範囲指定）を取得
        const sourceBuffer = trackNumber === 1 ? this.originalBuffer1 : this.originalBuffer2;
        const rangeStart = trackNumber === 1 ? this.useRangeStart1 : this.useRangeStart2;
        const rangeEnd = trackNumber === 1 ? this.useRangeEnd1 : this.useRangeEnd2;
        const selectionDuration = sourceBuffer ? Math.max(0, rangeEnd - rangeStart) : 0;

        if (!sourceBuffer || selectionDuration <= 0) {
            // 元波形や選択範囲がない場合は既存バッファをそのまま返す
            return trackNumber === 1 ? this.track1Buffer : this.track2Buffer;
        }

        // ベースとなる長さ（表示範囲と同期させる）
        const baseDuration =
            this.trackDisplayDuration ||
            (trackNumber === 1 && this.track1Buffer ? this.track1Buffer.duration : 0) ||
            (trackNumber === 2 && this.track2Buffer ? this.track2Buffer.duration : 0);

        if (!baseDuration || baseDuration <= 0) {
            return trackNumber === 1 ? this.track1Buffer : this.track2Buffer;
        }

        // 元波形から選択範囲を抽出
        let useRangeBuffer = this.audioProcessor.extractRange(
            sourceBuffer,
            rangeStart,
            rangeEnd
        );

        // ピッチシフトを適用
        if (this.pitchTransposeProcessor && useRangeBuffer) {
            useRangeBuffer = this.pitchTransposeProcessor.applyPitchShift(useRangeBuffer, trackNumber);
        }

        const sampleRate = this.audioContext.sampleRate;
        // 2chステレオを前提（mixBuffers側でステレオに統一しているため）
        const numChannels = 2;
        const length = Math.floor(baseDuration * sampleRate);
        const previewBuffer = this.audioContext.createBuffer(numChannels, length, sampleRate);

        // すべて無音で初期化されているので、リージョン部分だけ埋める
        regions.forEach(region => {
            if (!region) return;

            const regionStartTime = region.startTime || 0;
            const regionEndTime = region.endTime || 0;
            const regionDuration = Math.max(0, regionEndTime - regionStartTime);
            if (regionDuration <= 0) return;

            // 実際にコピーする長さは「リージョン長」と「選択範囲長（ピッチシフト後）」の短い方
            const processedDuration = useRangeBuffer ? useRangeBuffer.duration : selectionDuration;
            const availableDuration = Math.min(regionDuration, processedDuration);
            if (availableDuration <= 0) return;

            const srcSampleRate = useRangeBuffer.sampleRate;
            const regionStartSample = Math.floor(regionStartTime * sampleRate);
            const regionLength = Math.floor(availableDuration * sampleRate);

            for (let ch = 0; ch < numChannels; ch++) {
                const dstData = previewBuffer.getChannelData(ch);
                const srcCh = Math.min(ch, useRangeBuffer.numberOfChannels - 1);
                const srcData = useRangeBuffer.getChannelData(srcCh);

                for (let i = 0; i < regionLength; i++) {
                    const dstIndex = regionStartSample + i;
                    if (dstIndex < 0 || dstIndex >= length) break;

                    // ピッチシフト後のバッファから直接コピー
                    const srcIndex = i;
                    if (srcIndex < 0 || srcIndex >= srcData.length) continue;

                    // 複数リージョンが重なる場合は加算（クリッピングはmix時に行う）
                    dstData[dstIndex] += srcData[srcIndex];
                }
            }
        });

        return previewBuffer;
    }

    // 波形上クリックによるシーク
    seekTo(timeInSeconds) {
        if (!this.audioPlayer || !this.track1Buffer || !this.track2Buffer) return;

        const duration = this.track1Buffer.duration;
        if (duration <= 0) return;

        // ループ範囲内にクリップ
        let targetTime = Math.max(0, Math.min(duration, timeInSeconds));

        // 再生中のみシーク（要望に合わせて）
        if (this.audioPlayer.isPlaying) {
            this.audioPlayer.stopPreview();
            this.audioPlayer.playPreviewWithBuffers(this.track1Buffer, this.track2Buffer, targetTime);
        }
    }

    drawWaveforms() {
        if (!this.track1Buffer || !this.track2Buffer || !this.waveformRenderer) return;
        const currentTime = this.audioPlayer ? this.audioPlayer.getCurrentPlaybackTime() : null;
        // トラック1とトラック2の表示範囲を同期（trackDisplayDurationを使用）
        this.waveformRenderer.render(this.track1Buffer, this.track2Buffer, currentTime, this.trackDisplayDuration);
        // リージョンを描画
        if (this.regionController1) {
            this.regionController1.render();
        }
        if (this.regionController2) {
            this.regionController2.render();
        }
    }

    startPlaybackAnimation() {
        // 元波形ビューアーに再生状態を通知
        if (this.originalWaveformViewer1) {
            this.originalWaveformViewer1.setPlaybackActive(true);
        }
        if (this.originalWaveformViewer2) {
            this.originalWaveformViewer2.setPlaybackActive(true);
        }
        
        const animate = () => {
            if (this.audioPlayer && this.audioPlayer.isPlaying) {
                this.drawWaveforms();
                this.updateLevelMeters();
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.animationFrameId = null;
                this.resetLevelMeters();
            }
        };
        if (this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(animate);
        }
    }

    updateLevelMeters() {
        if (!this.audioPlayer) return;

        // トラック1のL/Rレベル
        const level1L = this.audioPlayer.getChannelLevel(1, 'l');
        const level1R = this.audioPlayer.getChannelLevel(1, 'r');

        if (this.levelMeter1L) {
            const bar1L = this.levelMeter1L.querySelector('.level-bar');
            if (bar1L) {
                bar1L.style.height = (level1L * 100) + '%';
            }
        }

        if (this.levelMeter1R) {
            const bar1R = this.levelMeter1R.querySelector('.level-bar');
            if (bar1R) {
                bar1R.style.height = (level1R * 100) + '%';
            }
        }

        // トラック2のL/Rレベル
        const level2L = this.audioPlayer.getChannelLevel(2, 'l');
        const level2R = this.audioPlayer.getChannelLevel(2, 'r');

        if (this.levelMeter2L) {
            const bar2L = this.levelMeter2L.querySelector('.level-bar');
            if (bar2L) {
                bar2L.style.height = (level2L * 100) + '%';
            }
        }

        if (this.levelMeter2R) {
            const bar2R = this.levelMeter2R.querySelector('.level-bar');
            if (bar2R) {
                bar2R.style.height = (level2R * 100) + '%';
            }
        }
        
        // 加工後のレベルメーターを更新
        this.updateProcessedLevelMeters();
        
        // スペクトラムアナライザーを更新
        this.updateSpectrum();
    }
    
    updateProcessedLevelMeters() {
        if (!this.audioPlayer || !this.processedLevelMetersContainer) return;
        
        const maxChannels = this.audioPlayer.getMaxChannels();
        const levels = this.audioPlayer.getProcessedLevels();
        
        // レベルメーターの数を調整
        const currentMeters = this.processedLevelMetersContainer.children.length;
        if (currentMeters !== maxChannels) {
            this.processedLevelMetersContainer.innerHTML = '';
            for (let i = 0; i < maxChannels; i++) {
                const meter = document.createElement('div');
                meter.className = 'processed-level-meter';
                meter.innerHTML = `
                    <div class="processed-level-meter-label">Ch ${i + 1}</div>
                    <div class="level-meter">
                        <div class="level-bar"></div>
                    </div>
                `;
                this.processedLevelMetersContainer.appendChild(meter);
            }
        }
        
        // 各チャンネルのレベルを更新
        for (let i = 0; i < maxChannels; i++) {
            const meter = this.processedLevelMetersContainer.children[i];
            if (meter) {
                const bar = meter.querySelector('.level-bar');
                if (bar) {
                    const level = i < levels.length ? levels[i] : 0;
                    bar.style.height = (level * 100) + '%';
                }
            }
        }
    }
    
    updateSpectrum() {
        if (!this.audioPlayer || !this.spectrumAnalyzer) return;
        
        // 更新頻度をチェック（スペクトラム/ソノグラム/波形共通）
        if (this.spectrumAnalyzer.shouldUpdateRender && !this.spectrumAnalyzer.shouldUpdateRender()) {
            return;
        }
        
        if (this.spectrumAnalyzer.mode === 'waveform') {
            // 波形モード: 時系列データを取得
            const timeDomainData = this.audioPlayer.getTimeDomainData();
            if (timeDomainData) {
                this.spectrumAnalyzer.draw(null, 0, 0, timeDomainData);
            } else {
                this.spectrumAnalyzer.clear();
            }
        } else {
            // スペクトラム/ソノグラムモード: 周波数データを取得
            const channel = this.spectrumAnalyzer.channel || 'mix';
            const freqData = this.audioPlayer.getFrequencyData(channel);
            if (freqData) {
                this.spectrumAnalyzer.draw(
                    freqData.data,
                    freqData.sampleRate,
                    freqData.fftSize
                );
            } else {
                this.spectrumAnalyzer.clear();
            }
        }
    }

    resetLevelMeters() {
        if (this.levelMeter1) {
            const bar1 = this.levelMeter1.querySelector('.level-bar');
            if (bar1) {
                bar1.style.height = '0%';
            }
        }

        if (this.levelMeter2) {
            const bar2 = this.levelMeter2.querySelector('.level-bar');
            if (bar2) {
                bar2.style.height = '0%';
            }
        }
        
        // スペクトラムアナライザーをクリア
        if (this.spectrumAnalyzer) {
            this.spectrumAnalyzer.clear();
        }
    }

    stopPlaybackAnimation() {
        // 元波形ビューアーに再生停止状態を通知
        if (this.originalWaveformViewer1) {
            this.originalWaveformViewer1.setPlaybackActive(false);
        }
        if (this.originalWaveformViewer2) {
            this.originalWaveformViewer2.setPlaybackActive(false);
        }
        
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // 再生位置ラインを消すために再描画
        this.drawWaveforms();
        
    }
    
    // エフェクトのUIとProcessorを初期化
    initializeEffects() {
        if (!this.audioContext || !this.audioProcessor) return;
        
        // ピッチトランスポーズ
        if (!this.pitchTransposeUI) {
            this.pitchTransposeProcessor = new PitchTransposeProcessor(this.audioContext);
            this.pitchTransposeUI = new PitchTransposeUI(this.pitchTransposeProcessor, this);
        }
        
        // MultiBand Comp
        if (!this.multibandCompUI) {
            this.multibandCompProcessor = new MultiBandCompProcessor(this.audioContext);
            this.multibandCompUI = new MultiBandCompUI(this.multibandCompProcessor);

            // 再生チェーン側にマルチバンドプロセッサーを渡す
            if (this.audioPlayer && this.audioPlayer.setMultiBandProcessor) {
                this.audioPlayer.setMultiBandProcessor(this.multibandCompProcessor);
            }
            
            // 詳細ボタンのイベントリスナーを設定
            this.setupMultibandDetailButton();
        }
        
        // Spatial Design
        const spatialCanvas = document.getElementById('spatial-canvas');
        if (spatialCanvas && !this.spatialDesignUI) {
            this.spatialDesignProcessor = new SpatialDesignProcessor(this.audioContext);
            this.spatialDesignUI = new SpatialDesignUI(spatialCanvas, this.spatialDesignProcessor);
            
            // AudioPlayerに空間デザインプロセッサーを設定
            if (this.audioPlayer && this.audioPlayer.setSpatialDesignProcessor) {
                this.audioPlayer.setSpatialDesignProcessor(this.spatialDesignProcessor);
            }
        }
    }
    
    setupMultibandDetailButton() {
        const detailBtn = document.getElementById('comp-detail-btn');
        const detailsArea = document.getElementById('multiband-details');
        
        if (detailBtn && detailsArea) {
            detailBtn.addEventListener('click', () => {
                const isOpen = detailsArea.style.display !== 'none';
                if (isOpen) {
                    detailsArea.style.display = 'none';
                    detailBtn.textContent = '▼';
                    detailBtn.classList.remove('open');
                } else {
                    detailsArea.style.display = 'block';
                    detailBtn.textContent = '▲';
                    detailBtn.classList.add('open');
                }
            });
        }
    }
    
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new LoopMaker();
});

