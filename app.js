// Audio to MIDI Converter アプリケーション
class AudioToMidiApp {
    constructor() {
        this.audioContext = null;
        this.originalBuffer = null; // ロードしたWAVファイルのバッファ
        this.audioProcessor = null;
        this.audioPlayer = null;
        this.originalWaveformViewer = null;
        this.useRangeStart = 0; // 選択範囲の開始位置
        this.useRangeEnd = 0; // 選択範囲の終了位置
        this.animationFrameId = null;
        
        this.initializeElements();
        this.uiController = new UIController(this);
    }

    initializeElements() {
        const canvas = document.getElementById('waveform-canvas');
        const ruler = document.getElementById('ruler');
        
        this.originalWaveformViewer = new OriginalWaveformViewer(canvas, ruler);
        this.originalWaveformViewer.onRangeChange = (startTime, endTime) => {
            this.useRangeStart = startTime;
            this.useRangeEnd = endTime;
        };
    }

    // 選択範囲を取得
    getSelectedRange() {
        if (!this.originalBuffer) return null;
        
        return {
            startTime: this.useRangeStart,
            endTime: this.useRangeEnd,
            duration: this.useRangeEnd - this.useRangeStart
        };
    }

    // 選択範囲のバッファを取得
    getSelectedRangeBuffer() {
        if (!this.originalBuffer || !this.audioProcessor) return null;
        
        return this.audioProcessor.extractRange(
            this.originalBuffer,
            this.useRangeStart,
            this.useRangeEnd
        );
    }

    drawWaveform() {
        // 波形はoriginalWaveformViewerで描画される
        if (this.originalWaveformViewer) {
            this.originalWaveformViewer.render();
        }
    }

    startPlaybackAnimation() {
        if (this.originalWaveformViewer) {
            this.originalWaveformViewer.setPlaybackActive(true);
        }
        
        const animate = () => {
            if (this.audioPlayer && this.audioPlayer.isPlaying) {
                this.drawWaveform();
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.animationFrameId = null;
            }
        };
        if (this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(animate);
        }
    }

    stopPlaybackAnimation() {
        if (this.originalWaveformViewer) {
            this.originalWaveformViewer.setPlaybackActive(false);
        }
        
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // 再生位置ラインを消すために再描画
        this.drawWaveform();
    }

    // 波形上クリックによるシーク
    seekTo(timeInSeconds) {
        if (!this.audioPlayer || !this.originalBuffer) return;

        const duration = this.originalBuffer.duration;
        if (duration <= 0) return;

        // 範囲内にクリップ
        let targetTime = Math.max(0, Math.min(duration, timeInSeconds));

        // 再生中のみシーク
        if (this.audioPlayer.isPlaying) {
            this.audioPlayer.stopPreview();
            const rangeBuffer = this.getSelectedRangeBuffer();
            if (rangeBuffer) {
                // 選択範囲内の相対時間に変換
                const relativeTime = Math.max(0, Math.min(rangeBuffer.duration, targetTime - this.useRangeStart));
                this.audioPlayer.playPreviewWithBuffer(rangeBuffer, relativeTime);
            }
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new AudioToMidiApp();
});
