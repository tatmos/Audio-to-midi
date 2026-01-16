// トラック1の加工処理クラス
class Track1Processor {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }

    // 保存用: トラック1の保存バッファ生成（そのままコピー）
    createSaveBuffer(audioBuffer) {
        // そのままコピー
        return audioBuffer;
    }
}

