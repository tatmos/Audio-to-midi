// 音声処理・生成クラス（ファイル保存専用）
class AudioProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.track1Processor = new Track1Processor(audioContext);
        this.track2Processor = new Track2Processor(audioContext);
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

    bufferToWav(buffer) {
        const length = buffer.length;
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const arrayBuffer = new ArrayBuffer(44 + length * numChannels * 2);
        const view = new DataView(arrayBuffer);
        const channels = [];

        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        // WAVヘッダー
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * numChannels * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * numChannels * 2, true);

        // データ
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                let sample = Math.max(-1, Math.min(1, channels[channel][i]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }

        return arrayBuffer;
    }


    // バッファをステレオ（2チャンネル）に変換
    convertToStereo(audioBuffer) {
        if (!audioBuffer) return null;
        
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        
        // 既にステレオの場合はそのまま返す
        if (numChannels === 2) {
            return audioBuffer;
        }
        
        // ステレオバッファを作成
        const stereoBuffer = this.audioContext.createBuffer(2, length, sampleRate);
        
        if (numChannels === 1) {
            // モノラルからステレオに変換（同じチャンネルを2つにコピー）
            const monoData = audioBuffer.getChannelData(0);
            const leftData = stereoBuffer.getChannelData(0);
            const rightData = stereoBuffer.getChannelData(1);
            
            for (let i = 0; i < length; i++) {
                leftData[i] = monoData[i];
                rightData[i] = monoData[i];
            }
        } else {
            // 3チャンネル以上の場合は、最初の2チャンネルを使用
            const leftData = stereoBuffer.getChannelData(0);
            const rightData = stereoBuffer.getChannelData(1);
            
            if (numChannels >= 1) {
                const inputLeft = audioBuffer.getChannelData(0);
                for (let i = 0; i < length; i++) {
                    leftData[i] = inputLeft[i];
                }
            }
            
            if (numChannels >= 2) {
                const inputRight = audioBuffer.getChannelData(1);
                for (let i = 0; i < length; i++) {
                    rightData[i] = inputRight[i];
                }
            } else {
                // 右チャンネルがない場合は左チャンネルをコピー
                const inputLeft = audioBuffer.getChannelData(0);
                for (let i = 0; i < length; i++) {
                    rightData[i] = inputLeft[i];
                }
            }
        }
        
        return stereoBuffer;
    }

    // トラック1と2をミックスしたバッファを生成
    mixBuffers(track1Buffer, track2Buffer) {
        if (!track1Buffer || !track2Buffer) return null;
        
        const sampleRate = track1Buffer.sampleRate;
        
        // 両方のバッファをステレオに統一
        const stereo1 = this.convertToStereo(track1Buffer);
        const stereo2 = this.convertToStereo(track2Buffer);
        
        // 2つのバッファの長い方を基準にする
        const maxLength = Math.max(stereo1.length, stereo2.length);
        const mixedBuffer = this.audioContext.createBuffer(2, maxLength, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const track1Data = stereo1.getChannelData(channel);
            const track2Data = stereo2.getChannelData(channel);
            const mixedData = mixedBuffer.getChannelData(channel);

            for (let i = 0; i < maxLength; i++) {
                const track1Value = i < track1Data.length ? track1Data[i] : 0;
                const track2Value = i < track2Data.length ? track2Data[i] : 0;
                // 2つのトラックをミックス（合計が1.0を超えないようにクリッピング）
                mixedData[i] = Math.max(-1, Math.min(1, track1Value + track2Value));
            }
        }

        return mixedBuffer;
    }

    // ミックスしたバッファを保存
    saveMixedBuffer(mixedBuffer, filename = 'se_editor_output.wav') {
        const wav = this.bufferToWav(mixedBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

