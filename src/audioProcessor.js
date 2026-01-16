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
}

export { AudioProcessor };
