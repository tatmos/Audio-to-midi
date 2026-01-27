// 音声処理クラス
class AudioProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }

    // 元波形から指定範囲を抽出
    extractRange(audioBuffer, startTime, endTime) {
        if (!audioBuffer || startTime < 0 || endTime > audioBuffer.duration || startTime >= endTime) {
            return audioBuffer;
        }

        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const rangeDuration = endTime - startTime;
        const frameCount = Math.floor(rangeDuration * sampleRate);
        
        const extractedBuffer = this.audioContext.createBuffer(numChannels, frameCount, sampleRate);
        
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = extractedBuffer.getChannelData(channel);

            for (let i = 0; i < frameCount; i++) {
                const inputIndex = startSample + i;
                if (inputIndex < inputData.length && inputIndex < endSample) {
                    outputData[i] = inputData[inputIndex];
                } else {
                    outputData[i] = 0;
                }
            }
        }

        return extractedBuffer;
    }

    // AudioBufferを指定のサンプルレートにリサンプリング
    resample(audioBuffer, targetSampleRate) {
        if (!audioBuffer || audioBuffer.sampleRate === targetSampleRate) {
            return audioBuffer;
        }

        const sourceSampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const duration = audioBuffer.duration;
        const targetLength = Math.floor(duration * targetSampleRate);
        
        const resampledBuffer = this.audioContext.createBuffer(numChannels, targetLength, targetSampleRate);
        const ratio = sourceSampleRate / targetSampleRate;

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = resampledBuffer.getChannelData(channel);

            for (let i = 0; i < targetLength; i++) {
                const sourceIndex = i * ratio;
                const index = Math.floor(sourceIndex);
                const fraction = sourceIndex - index;

                if (index + 1 < inputData.length) {
                    // 線形補間
                    outputData[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
                } else if (index < inputData.length) {
                    outputData[i] = inputData[index];
                } else {
                    outputData[i] = 0;
                }
            }
        }

        return resampledBuffer;
    }

    // AudioBufferをモノラルに変換
    convertToMono(audioBuffer) {
        if (!audioBuffer || audioBuffer.numberOfChannels === 1) {
            return audioBuffer;
        }

        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length;
        const monoBuffer = this.audioContext.createBuffer(1, length, sampleRate);
        const monoData = monoBuffer.getChannelData(0);

        // すべてのチャンネルを平均してモノラルに変換
        for (let i = 0; i < length; i++) {
            let sum = 0;
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                sum += audioBuffer.getChannelData(channel)[i];
            }
            monoData[i] = sum / audioBuffer.numberOfChannels;
        }

        return monoBuffer;
    }

    // オーディオからテンポ（BPM）を推定
    estimateTempo(audioBuffer) {
        if (!audioBuffer) {
            return null;
        }

        // モノラルに変換
        const monoBuffer = this.convertToMono(audioBuffer);
        const sampleRate = monoBuffer.sampleRate;
        const audioData = monoBuffer.getChannelData(0);
        const duration = monoBuffer.duration;

        // 短すぎる場合は推定できない
        if (duration < 2) {
            return null;
        }

        // エネルギーの変化を計算（ビート検出用）
        const windowSize = Math.floor(sampleRate * 0.1); // 100msウィンドウ
        const hopSize = Math.floor(windowSize / 4); // オーバーラップ
        const energy = [];

        // 各ウィンドウのエネルギーを計算
        for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
            let sum = 0;
            for (let j = 0; j < windowSize; j++) {
                const value = audioData[i + j];
                sum += value * value;
            }
            energy.push(sum / windowSize);
        }

        // エネルギーの差分（変化率）を計算
        const energyDiff = [];
        for (let i = 1; i < energy.length; i++) {
            const diff = Math.max(0, energy[i] - energy[i - 1]);
            energyDiff.push(diff);
        }

        // オートコリレーションでビート間隔を検出
        const minBPM = 60;
        const maxBPM = 200;
        const minInterval = Math.floor((60 / maxBPM) * sampleRate / hopSize);
        const maxInterval = Math.floor((60 / minBPM) * sampleRate / hopSize);

        let bestScore = 0;
        let bestInterval = 0;

        // 各可能なビート間隔をテスト
        for (let interval = minInterval; interval <= maxInterval && interval < energyDiff.length; interval++) {
            let score = 0;
            let count = 0;

            // オートコリレーション計算
            for (let i = 0; i < energyDiff.length - interval; i++) {
                score += energyDiff[i] * energyDiff[i + interval];
                count++;
            }

            if (count > 0) {
                score /= count;
                if (score > bestScore) {
                    bestScore = score;
                    bestInterval = interval;
                }
            }
        }

        if (bestInterval === 0) {
            return null;
        }

        // ビート間隔からBPMを計算
        const beatIntervalSeconds = (bestInterval * hopSize) / sampleRate;
        const estimatedBPM = Math.round(60 / beatIntervalSeconds);

        // 範囲内に制限
        return Math.max(60, Math.min(200, estimatedBPM));
    }
}

export { AudioProcessor };
