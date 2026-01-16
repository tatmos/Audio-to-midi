// トラック2の加工処理クラス
class Track2Processor {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }

    // 保存用: トラック2の保存バッファ生成（トラック1と同じサイズに）
    createSaveBuffer(audioBuffer, targetDuration) {
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const frameCount = Math.floor(targetDuration * sampleRate);
        const newBuffer = this.audioContext.createBuffer(numChannels, frameCount, sampleRate);

        const waveformDuration = Math.min(audioBuffer.duration, targetDuration);
        const waveformEndSample = Math.floor(waveformDuration * sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);

            for (let i = 0; i < frameCount; i++) {
                const timeInOutput = i / sampleRate;
                if (timeInOutput < waveformDuration) {
                    const inputIndex = Math.floor(timeInOutput * sampleRate);
                    const sample = inputIndex < inputData.length ? inputData[inputIndex] : 0;
                    outputData[i] = sample;
                } else {
                    outputData[i] = 0;
                }
            }
        }

        return newBuffer;
    }
}

