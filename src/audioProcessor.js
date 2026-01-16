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
}

export { AudioProcessor };
