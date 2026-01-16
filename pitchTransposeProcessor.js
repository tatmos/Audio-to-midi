// ピッチトランスポーズ 音響処理部分
class PitchTransposeProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.track1Params = { transpose: 0, cent: 0, algorithm: 'resample' };
        this.track2Params = { transpose: 0, cent: 0, algorithm: 'resample' };
    }
    
    setPitchShift(trackNumber, transpose, cent, algorithm = 'resample') {
        if (trackNumber === 1) {
            this.track1Params = { transpose, cent, algorithm };
        } else if (trackNumber === 2) {
            this.track2Params = { transpose, cent, algorithm };
        }
    }
    
    // ピッチシフトを適用したバッファを生成
    applyPitchShift(audioBuffer, trackNumber) {
        if (!audioBuffer || audioBuffer.length === 0) {
            return audioBuffer; // 空のバッファはそのまま返す
        }
        
        const params = trackNumber === 1 ? this.track1Params : this.track2Params;
        
        if (params.transpose === 0 && params.cent === 0) {
            return audioBuffer; // ピッチシフトなし
        }
        
        // セミトーンとcentから周波数比を計算
        const semitoneRatio = Math.pow(2, params.transpose / 12);
        const centRatio = Math.pow(2, params.cent / 1200);
        const pitchRatio = semitoneRatio * centRatio;
        
        // pitchRatioの妥当性チェック
        if (!isFinite(pitchRatio) || pitchRatio <= 0 || pitchRatio > 100) {
            console.warn('Invalid pitchRatio:', pitchRatio, 'Returning original buffer');
            return audioBuffer;
        }
        
        // アルゴリズムに応じて処理
        if (params.algorithm === 'pitchshift') {
            return this.pitchShiftBuffer(audioBuffer, pitchRatio);
        } else {
            // リサンプル方式（デフォルト）
            return this.resampleBuffer(audioBuffer, pitchRatio);
        }
    }
    
    // リサンプル方式：ピッチを変えるとテンポも変わる（高速）
    resampleBuffer(audioBuffer, pitchRatio) {
        if (!audioBuffer || audioBuffer.length === 0) {
            return audioBuffer;
        }
        
        const sampleRate = this.audioContext.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const newLength = Math.max(1, Math.floor(length / pitchRatio));
        
        // newLengthが0以下になる場合は元のバッファを返す
        if (newLength <= 0) {
            console.warn('newLength is 0 or negative, returning original buffer');
            return audioBuffer;
        }
        
        const newBuffer = this.audioContext.createBuffer(numChannels, newLength, sampleRate);
        
        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            
            for (let i = 0; i < newLength; i++) {
                const sourceIndex = i * pitchRatio;
                const index1 = Math.floor(sourceIndex);
                const index2 = Math.min(index1 + 1, length - 1);
                const fraction = sourceIndex - index1;
                
                // 線形補間
                outputData[i] = inputData[index1] * (1 - fraction) + inputData[index2] * fraction;
            }
        }
        
        return newBuffer;
    }
    
    // ピッチシフト方式：ピッチだけを変えてテンポは維持（高品質、低速）
    pitchShiftBuffer(audioBuffer, pitchRatio) {
        const sampleRate = this.audioContext.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        
        // ピッチシフトでは長さは変わらない（テンポ維持）
        const newBuffer = this.audioContext.createBuffer(numChannels, length, sampleRate);
        
        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            
            // 簡易的なピッチシフト実装（PSOLA風）
            // 実際のピッチシフトはより複雑だが、ここでは簡易版を実装
            const frameSize = 2048;
            const overlap = 0.5;
            const hopSize = Math.floor(frameSize * (1 - overlap));
            const pitchShiftFactor = 1.0 / pitchRatio;
            
            // オーバーラップ・アッド方式でピッチシフト
            const window = this.createHannWindow(frameSize);
            const overlapBuffer = new Float32Array(length);
            
            for (let pos = 0; pos < length - frameSize; pos += hopSize) {
                // 入力フレーム
                const inputFrame = new Float32Array(frameSize);
                for (let i = 0; i < frameSize && pos + i < length; i++) {
                    inputFrame[i] = inputData[pos + i] * window[i];
                }
                
                // ピッチシフト後の位置を計算
                const outputPos = Math.floor(pos * pitchShiftFactor);
                
                // オーバーラップ・アッド
                for (let i = 0; i < frameSize && outputPos + i < length; i++) {
                    overlapBuffer[outputPos + i] += inputFrame[i];
                }
            }
            
            // 正規化
            let maxValue = 0;
            for (let i = 0; i < length; i++) {
                if (Math.abs(overlapBuffer[i]) > maxValue) {
                    maxValue = Math.abs(overlapBuffer[i]);
                }
            }
            
            if (maxValue > 0) {
                const normalizeFactor = Math.min(1.0, 1.0 / maxValue);
                for (let i = 0; i < length; i++) {
                    outputData[i] = overlapBuffer[i] * normalizeFactor;
                }
            }
        }
        
        return newBuffer;
    }
    
    // ハン窓関数を生成
    createHannWindow(size) {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
        }
        return window;
    }
}
