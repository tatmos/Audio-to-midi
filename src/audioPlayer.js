// オーディオ再生クラス
class AudioPlayer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.sourceNode = null;
        this.gainNode = null;
        this.startTime = null;
        this.isPlaying = false;
        this.bufferDuration = 0;
    }

    // 選択範囲のバッファを再生
    playPreviewWithBuffer(audioBuffer, offsetSeconds = 0) {
        if (!audioBuffer || this.isPlaying) return false;

        // 既存の接続を確実にクリーンアップ
        this.stopPreview();

        try {
            const bufferDuration = audioBuffer.duration;

            // オフセットをバッファ長の範囲に収める
            let offset = offsetSeconds % bufferDuration;
            if (offset < 0) {
                offset += bufferDuration;
            }

            // ソースノードを作成
            this.sourceNode = this.audioContext.createBufferSource();
            this.gainNode = this.audioContext.createGain();

            this.sourceNode.buffer = audioBuffer;
            this.sourceNode.loop = false; // ループしない（選択範囲を1回再生）

            // 接続: source -> gain -> destination
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            // 再生開始
            const startAt = this.audioContext.currentTime;
            this.sourceNode.start(startAt, offset);

            // 再生終了時の処理
            this.sourceNode.onended = () => {
                this.stopPreview();
            };

            // 再生位置計算用の基準時刻
            this.startTime = startAt - offset;
            this.bufferDuration = bufferDuration;
            this.isPlaying = true;
            return true;
        } catch (error) {
            console.error('再生エラー:', error);
            this.isPlaying = false;
            throw error;
        }
    }

    stopPreview() {
        if (this.sourceNode) {
            try {
                if (this.sourceNode.stop) {
                    this.sourceNode.stop();
                }
                this.sourceNode.disconnect();
            } catch (e) {
                // 既に停止している場合など
            }
        }
        
        if (this.gainNode) {
            try {
                this.gainNode.disconnect();
            } catch (e) {
                // 既に切断されている場合など
            }
        }

        this.sourceNode = null;
        this.gainNode = null;
        this.startTime = null;
        this.isPlaying = false;
        this.bufferDuration = 0;
    }
}

export { AudioPlayer };
