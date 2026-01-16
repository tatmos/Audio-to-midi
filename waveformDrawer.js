// 波形描画のコア処理
class WaveformDrawer {
    /**
     * 波形を描画
     * @param {AudioBuffer} audioBuffer - 音声バッファ
     * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
     * @param {number} waveformStartTime - 波形の開始秒
     * @param {number} waveformEndTime - 波形の終了秒
     * @param {number} displayStartTime - 表示範囲の開始秒
     * @param {number} displayEndTime - 表示範囲の終了秒
     * @param {number} width - キャンバスの幅
     * @param {number} height - キャンバスの高さ
     * @param {Object} options - オプション
     * @param {boolean} options.drawDCOffset - DCオフセットラインを描画するか（デフォルト: true）
     * @param {string} options.backgroundColor - 背景色（デフォルト: '#e0e0e0'）
     */
    static drawWaveform(audioBuffer, ctx, waveformStartTime, waveformEndTime, displayStartTime, displayEndTime, width, height, options = {}) {
        if (!audioBuffer) return;

        const {
            drawDCOffset = true,
            backgroundColor = '#e0e0e0'
        } = options;

        // 背景を塗りつぶす
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const trackHeight = numChannels === 2 ? height / 2 : height;

        // 表示範囲の時間スケール
        const displayDuration = displayEndTime - displayStartTime;
        const timeScale = width / displayDuration;

        // 波形の範囲をサンプルに変換
        const waveformStartSample = Math.floor(waveformStartTime * sampleRate);
        const waveformEndSample = Math.floor(waveformEndTime * sampleRate);
        const waveformDuration = waveformEndTime - waveformStartTime;

        // DCオフセットを計算して横線を描画
        if (drawDCOffset && waveformDuration > 0) {
            for (let channel = 0; channel < numChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                const yOffset = channel * trackHeight;

                // DCオフセット（平均値）を計算（最適化：サンプリング間隔を大きくして計算量を削減）
                let sum = 0;
                let count = 0;
                // 大きな波形の場合は間引いて計算（最大1000サンプルまで）
                const dcSampleStep = Math.max(1, Math.floor((waveformEndSample - waveformStartSample) / 1000));
                for (let i = waveformStartSample; i < waveformEndSample && i < channelData.length; i += dcSampleStep) {
                    sum += channelData[i];
                    count++;
                }
                const dcOffset = count > 0 ? sum / count : 0;

                // DCオフセットラインを描画（濃い緑色）
                const dcY = yOffset + (trackHeight / 2) - (dcOffset * trackHeight / 2 * 0.9);
                ctx.strokeStyle = '#006400';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                
                // 表示範囲内の波形部分のみ描画
                const dcStartX = Math.max(0, (waveformStartTime - displayStartTime) * timeScale);
                const dcEndX = Math.min(width, (waveformEndTime - displayStartTime) * timeScale);
                ctx.moveTo(dcStartX, dcY);
                ctx.lineTo(dcEndX, dcY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // 波形を描画
        if (waveformDuration > 0) {
            const waveformWidth = waveformDuration * timeScale;
            const samplesPerPixel = Math.max(1, Math.floor((waveformEndSample - waveformStartSample) / waveformWidth));

            // 表示範囲内の波形部分の描画範囲
            const drawStartX = Math.max(0, Math.floor((waveformStartTime - displayStartTime) * timeScale));
            const drawEndX = Math.min(width, Math.ceil((waveformEndTime - displayStartTime) * timeScale));

            for (let channel = 0; channel < numChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                const yOffset = channel * trackHeight;
                const centerY = yOffset + trackHeight / 2;

                ctx.strokeStyle = channel === 0 ? '#667eea' : '#764ba2';
                ctx.lineWidth = 2;
                ctx.beginPath();

                let firstPointTop = true;
                let firstPointBottom = true;

                // 波形を描画（上側と下側を一度に計算して効率化）
                const points = [];
                for (let x = drawStartX; x < drawEndX; x++) {
                    const timeInDisplay = displayStartTime + (x / timeScale);
                    const timeInWaveform = timeInDisplay - waveformStartTime;
                    const pixelStartSample = Math.floor((waveformStartTime + timeInWaveform) * sampleRate);
                    
                    if (pixelStartSample < waveformStartSample || pixelStartSample >= waveformEndSample) continue;

                    // 最大値と最小値を計算（最適化：大きな波形の場合は間引く）
                    let max = -Infinity;
                    let min = Infinity;
                    const actualSamplesPerPixel = Math.min(samplesPerPixel, channelData.length - pixelStartSample);
                    // サンプル数が多い場合は間引いて計算（最大100サンプルまで）
                    const sampleStep = actualSamplesPerPixel > 100 ? Math.ceil(actualSamplesPerPixel / 100) : 1;
                    for (let i = 0; i < actualSamplesPerPixel && pixelStartSample + i < channelData.length && pixelStartSample + i >= waveformStartSample; i += sampleStep) {
                        const value = channelData[pixelStartSample + i];
                        if (value > max) max = value;
                        if (value < min) min = value;
                    }

                    const yTop = centerY - (max * trackHeight / 2 * 0.9);
                    const yBottom = centerY - (min * trackHeight / 2 * 0.9);
                    points.push({ x, yTop, yBottom });
                }

                // 上側の波形を描画
                if (points.length > 0) {
                    ctx.moveTo(points[0].x, points[0].yTop);
                    for (let i = 1; i < points.length; i++) {
                        ctx.lineTo(points[i].x, points[i].yTop);
                    }
                }

                // 下側の波形を描画（逆順）
                for (let i = points.length - 1; i >= 0; i--) {
                    ctx.lineTo(points[i].x, points[i].yBottom);
                }

                ctx.closePath();
                ctx.stroke();
            }
        }
    }
}

