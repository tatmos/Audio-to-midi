// 元波形表示と利用範囲指定UIクラス
class OriginalWaveformViewer {
    constructor(canvas, ruler) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ruler = ruler;
        this.audioBuffer = null;
        this.startTime = 0; // 利用範囲の開始位置（秒）
        this.endTime = 0; // 利用範囲の終了位置（秒）
        this.isDragging = false;
        this.dragType = null; // 'start' or 'end'
        this.onRangeChange = null; // コールバック関数
        this.isPlaybackActive = false; // 再生中かどうか
        
        this.setupEventListeners();
    }
    
    // 再生状態を設定
    setPlaybackActive(active) {
        this.isPlaybackActive = active;
    }

    lockScroll() {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = 'hidden';
            if (document.documentElement) {
                document.documentElement.style.overflow = 'hidden';
            }
        }
    }

    unlockScroll() {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = '';
            if (document.documentElement) {
                document.documentElement.style.overflow = '';
            }
        }
    }

    setupEventListeners() {
        // マウス操作
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        // iOS / タッチ操作対応
        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.audioBuffer) return;
            const touch = e.touches[0];
            if (!touch) return;
            // ドラッグ開始時のみ preventDefault（判定は handleMouseDown 内で行う）
            const wasDragging = this.isDragging;
            this.handleMouseDown(touch);
            // ドラッグが開始された場合のみ preventDefault
            if (this.isDragging && !wasDragging) {
                e.preventDefault();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.audioBuffer) return;
            const touch = e.touches[0];
            if (!touch) return;
            // ドラッグ中のみ preventDefault
            if (this.isDragging) {
                e.preventDefault();
            }
            this.handleMouseMove(touch);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0] || e.touches[0];
            if (touch) {
                this.handleMouseUp(touch);
            } else {
                this.handleMouseUp(e);
            }
        });

        this.canvas.addEventListener('touchcancel', (e) => {
            // タッチがキャンセルされた場合も確実に解除
            this.handleMouseUp(e);
        });
    }

    setAudioBuffer(audioBuffer) {
        this.audioBuffer = audioBuffer;
        if (audioBuffer) {
            this.endTime = audioBuffer.duration;
        }
        this.render();
    }

    setRange(startTime, endTime) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.render();
    }

    getRange() {
        return {
            startTime: this.startTime,
            endTime: this.endTime
        };
    }

    handleMouseDown(e) {
        if (!this.audioBuffer) return;
        
        // 再生中は範囲変更を無効化
        if (this.isPlaybackActive) {
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = this.canvas.width;
        const duration = this.audioBuffer.duration;
        const timeScale = width / duration;
        
        const startX = this.startTime * timeScale;
        const endX = this.endTime * timeScale;
        // タッチデバイスでも掴みやすいよう少し広めにする
        const handleWidth = 16;
        
        // 開始位置のハンドルをクリックしたか
        if (Math.abs(x - startX) < handleWidth) {
            this.isDragging = true;
            this.dragType = 'start';
            this.canvas.style.cursor = 'ew-resize';
            this.lockScroll();
            return;
        }
        
        // 終了位置のハンドルをクリックしたか
        if (Math.abs(x - endX) < handleWidth) {
            this.isDragging = true;
            this.dragType = 'end';
            this.canvas.style.cursor = 'ew-resize';
            this.lockScroll();
            return;
        }
        
        // 範囲内をクリックした場合は範囲全体を移動
        if (x >= startX && x <= endX) {
            this.isDragging = true;
            this.dragType = 'move';
            this.dragOffset = x - startX;
            this.canvas.style.cursor = 'move';
            this.lockScroll();
            return;
        }
    }

    handleMouseMove(e) {
        if (!this.audioBuffer) return;
        
        // 再生中は範囲変更を無効化
        if (this.isPlaybackActive && this.isDragging) {
            this.isDragging = false;
            this.dragType = null;
            this.unlockScroll();
            this.canvas.style.cursor = '';
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = this.canvas.width;
        const duration = this.audioBuffer.duration;
        const timeScale = width / duration;
        
        if (this.isDragging) {
            if (this.dragType === 'start') {
                const newStartTime = Math.max(0, Math.min(this.endTime - 0.01, x / timeScale));
                this.startTime = newStartTime;
            } else if (this.dragType === 'end') {
                const newEndTime = Math.max(this.startTime + 0.01, Math.min(duration, x / timeScale));
                this.endTime = newEndTime;
            } else if (this.dragType === 'move') {
                const rangeDuration = this.endTime - this.startTime;
                const newStartTime = Math.max(0, Math.min(duration - rangeDuration, (x - this.dragOffset) / timeScale));
                const newEndTime = newStartTime + rangeDuration;
                if (newEndTime <= duration) {
                    this.startTime = newStartTime;
                    this.endTime = newEndTime;
                }
            }
            this.render();
            // ドラッグ中は範囲変更を呼ばない（ドラッグ終了時のみ）
        } else {
            // ハンドルの上にマウスがあるかチェック
            const startX = this.startTime * timeScale;
            const endX = this.endTime * timeScale;
            const handleWidth = 16;
            
            if (Math.abs(x - startX) < handleWidth || Math.abs(x - endX) < handleWidth) {
                this.canvas.style.cursor = 'ew-resize';
            } else if (x >= startX && x <= endX) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }

    handleMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragType = null;
            this.canvas.style.cursor = 'default';
            this.unlockScroll();
            
            // 範囲変更を通知（ドラッグ終了時のみ、再生中でない場合のみ）
            if (!this.isPlaybackActive && this.onRangeChange) {
                this.onRangeChange(this.startTime, this.endTime);
            }
        }
    }

    render() {
        if (!this.audioBuffer) return;
        
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const ctx = this.ctx;
        
        ctx.clearRect(0, 0, width, height);
        
        // 背景をグレーで塗りつぶす
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(0, 0, width, height);
        
        const sampleRate = this.audioBuffer.sampleRate;
        const numChannels = this.audioBuffer.numberOfChannels;
        const trackHeight = numChannels === 2 ? height / 2 : height;
        const duration = this.audioBuffer.duration;
        const timeScale = width / duration;
        
        // 範囲外の部分を暗く表示
        const startX = this.startTime * timeScale;
        const endX = this.endTime * timeScale;
        
        // 範囲前を暗く
        if (startX > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, startX, height);
        }
        
        // 範囲後を暗く
        if (endX < width) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(endX, 0, width - endX, height);
        }
        
        // DCオフセットライン（最適化：大きな波形の場合は間引いて計算）
        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = this.audioBuffer.getChannelData(channel);
            const yOffset = channel * trackHeight;
            // 大きな波形の場合は間引いて計算（最大1000サンプルまで）
            const dcSampleStep = Math.max(1, Math.floor(channelData.length / 1000));
            const dcOffset = this.calculateDCOffset(channelData, 0, channelData.length, dcSampleStep);
            const dcY = yOffset + (trackHeight / 2) - (dcOffset * trackHeight / 2 * 0.9);
            ctx.strokeStyle = '#006400';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(0, dcY);
            ctx.lineTo(width, dcY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // 波形描画
        const samplesPerPixel = Math.max(1, Math.floor((duration * sampleRate) / width));
        
        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = this.audioBuffer.getChannelData(channel);
            const yOffset = channel * trackHeight;
            const centerY = yOffset + trackHeight / 2;
            
            ctx.strokeStyle = channel === 0 ? '#667eea' : '#764ba2';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            let firstPointTop = true;
            let firstPointBottom = true;
            
            // 波形を描画（上側と下側を一度に計算して効率化）
            const points = [];
            for (let x = 0; x < width; x++) {
                const timeAtX = (x / timeScale);
                const pixelStartSample = Math.floor(timeAtX * sampleRate);
                if (pixelStartSample < 0 || pixelStartSample >= channelData.length) continue;
                
                // 最大値と最小値を計算（最適化：大きな波形の場合は間引く）
                let max = -Infinity;
                let min = Infinity;
                const actualSamplesPerPixel = Math.min(samplesPerPixel, channelData.length - pixelStartSample);
                // サンプル数が多い場合は間引いて計算（最大100サンプルまで）
                const sampleStep = actualSamplesPerPixel > 100 ? Math.ceil(actualSamplesPerPixel / 100) : 1;
                for (let i = 0; i < actualSamplesPerPixel && pixelStartSample + i < channelData.length && pixelStartSample + i >= 0; i += sampleStep) {
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
        
        // 範囲指定UIを描画
        this.drawRangeUI(ctx, startX, endX, height, timeScale);
        
        // タイムルーラーを描画
        this.drawTimeRuler(duration, width);
    }

    drawRangeUI(ctx, startX, endX, height, timeScale) {
        // 範囲の境界線
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX, height);
        ctx.moveTo(endX, 0);
        ctx.lineTo(endX, height);
        ctx.stroke();
        
        // 開始位置のハンドル
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(startX - 4, 0, 8, height);
        
        // 終了位置のハンドル
        ctx.fillRect(endX - 4, 0, 8, height);
        
        // 範囲内のハイライト
        ctx.fillStyle = 'rgba(255, 107, 107, 0.1)';
        ctx.fillRect(startX, 0, endX - startX, height);
        
        // ラベル
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '12px sans-serif';
        ctx.fillText(this.formatTime(this.startTime), startX + 5, 15);
        ctx.fillText(this.formatTime(this.endTime), endX - 50, 15);
    }

    drawTimeRuler(duration, width) {
        this.ruler.innerHTML = '';
        
        // タイムルーラー要素の実際の幅を取得
        const rulerWidth = this.ruler.offsetWidth || width;
        const timeScale = rulerWidth / duration;
        const tickInterval = this.calculateTickInterval(duration, rulerWidth);
        
        // 最適化：DocumentFragmentを使用してDOM操作を効率化
        const fragment = document.createDocumentFragment();
        
        for (let time = 0; time <= duration; time += tickInterval) {
            const x = time * timeScale;
            const tick = document.createElement('div');
            tick.className = 'ruler-tick';
            tick.style.left = x + 'px';
            tick.textContent = this.formatTime(time);
            fragment.appendChild(tick);
        }
        
        this.ruler.appendChild(fragment);
    }

    calculateTickInterval(duration, width) {
        const minTickSpacing = 80; // 最小の目盛り間隔（ピクセル）
        const idealTicks = width / minTickSpacing;
        const rawInterval = duration / idealTicks;
        
        // 適切な間隔に丸める
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
        const normalized = rawInterval / magnitude;
        
        let interval;
        if (normalized < 1.5) {
            interval = magnitude;
        } else if (normalized < 3) {
            interval = 2 * magnitude;
        } else if (normalized < 7) {
            interval = 5 * magnitude;
        } else {
            interval = 10 * magnitude;
        }
        
        return interval;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`;
    }

    calculateDCOffset(channelData, startSample, endSample, sampleStep = 1) {
        let sum = 0;
        let count = 0;
        for (let i = startSample; i < endSample && i < channelData.length; i += sampleStep) {
            sum += channelData[i];
            count++;
        }
        return count > 0 ? sum / count : 0;
    }
}

