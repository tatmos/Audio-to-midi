// リージョン管理クラス
class RegionController {
    constructor(loopMaker, canvas, trackNumber) {
        this.loopMaker = loopMaker;
        this.canvas = canvas;
        this.trackNumber = trackNumber;
        this.ctx = canvas.getContext('2d');
        this.regions = []; // リージョンの配列
        this.selectedRegion = null;
        this.dragging = false;
        this.dragType = null; // 'move', 'resize-left', 'resize-right', 'resize-bottom', 'playback-start'
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartTime = 0;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        
        // Altキーを押しながらドラッグで複製
        this.canvas.addEventListener('keydown', (e) => {
            if (e.altKey && this.dragging) {
                this.isDuplicating = true;
            }
        });
        this.canvas.addEventListener('keyup', (e) => {
            if (!e.altKey) {
                this.isDuplicating = false;
            }
        });
    }
    
    // リージョンを追加
    addRegion(startTime, endTime, sourceBuffer, sourceStartTime = 0) {
        const region = {
            id: Date.now() + Math.random(),
            startTime: startTime,
            endTime: endTime,
            sourceBuffer: sourceBuffer,
            sourceStartTime: sourceStartTime, // 元波形からの再生開始位置
            pitchShift: 0, // ピッチシフト（セミトーン）
            timeStretch: 1.0, // タイムストレッチ（1.0 = 通常）
            selected: false
        };
        this.regions.push(region);
        return region;
    }
    
    // リージョンを削除
    removeRegion(regionId) {
        this.regions = this.regions.filter(r => r.id !== regionId);
        if (this.selectedRegion && this.selectedRegion.id === regionId) {
            this.selectedRegion = null;
        }
    }
    
    // リージョンを選択
    selectRegion(region) {
        // すべてのリージョンの選択を解除
        this.regions.forEach(r => r.selected = false);
        if (region) {
            region.selected = true;
            this.selectedRegion = region;
        } else {
            this.selectedRegion = null;
        }
    }
    
    // マウス位置からリージョンを取得
    getRegionAt(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const buffer = this.trackNumber === 1 ? this.loopMaker.track1Buffer : this.loopMaker.track2Buffer;
        if (!buffer) return null;
        
        const duration = buffer.duration;
        const timeScale = width / duration;
        const time = canvasX / timeScale;
        
        // リージョンを逆順でチェック（上に描画されているものを優先）
        for (let i = this.regions.length - 1; i >= 0; i--) {
            const region = this.regions[i];
            if (time >= region.startTime && time <= region.endTime) {
                return region;
            }
        }
        return null;
    }
    
    // ドラッグタイプを判定
    getDragType(region, x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const buffer = this.trackNumber === 1 ? this.loopMaker.track1Buffer : this.loopMaker.track2Buffer;
        if (!buffer) return null;
        
        const duration = buffer.duration;
        const timeScale = width / duration;
        const anchorSize = 8;
        
        const startX = region.startTime * timeScale;
        const endX = region.endTime * timeScale;
        const regionY = 0;
        const regionHeight = height;
        
        // 右下のアンカー（タイムストレッチ）
        if (Math.abs(canvasX - endX) < anchorSize && Math.abs(canvasY - (regionY + regionHeight)) < anchorSize) {
            return 'resize-bottom';
        }
        
        // 左端（リサイズ左）
        if (Math.abs(canvasX - startX) < anchorSize) {
            return 'resize-left';
        }
        
        // 右端（リサイズ右）
        if (Math.abs(canvasX - endX) < anchorSize) {
            return 'resize-right';
        }
        
        // リージョン内（移動）
        if (canvasX >= startX && canvasX <= endX) {
            return 'move';
        }
        
        return null;
    }
    
    handleMouseDown(e) {
        const region = this.getRegionAt(e.clientX, e.clientY);
        
        if (region) {
            this.selectRegion(region);
            const dragType = this.getDragType(region, e.clientX, e.clientY);
            
            if (dragType) {
                this.dragging = true;
                this.dragType = dragType;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                this.dragStartTime = region.startTime;
                this.dragRegion = region;
                e.preventDefault();
            }
        } else {
            // リージョン外をクリックした場合は選択を解除
            this.selectRegion(null);
        }
        
        this.render();
    }
    
    handleMouseMove(e) {
        if (this.dragging && this.dragRegion) {
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            
            const width = this.canvas.width;
            const buffer = this.trackNumber === 1 ? this.loopMaker.track1Buffer : this.loopMaker.track2Buffer;
            if (!buffer) return;
            
            const duration = buffer.duration;
            const timeScale = width / duration;
            const deltaX = canvasX - (this.dragStartX - rect.left);
            const deltaTime = deltaX / timeScale;
            
            switch (this.dragType) {
                case 'move':
                    const newStartTime = this.dragStartTime + deltaTime;
                    const regionDuration = this.dragRegion.endTime - this.dragRegion.startTime;
                    if (newStartTime >= 0 && newStartTime + regionDuration <= duration) {
                        this.dragRegion.startTime = newStartTime;
                        this.dragRegion.endTime = newStartTime + regionDuration;
                    }
                    break;
                case 'resize-left':
                    const newStart = this.dragStartTime + deltaTime;
                    if (newStart >= 0 && newStart < this.dragRegion.endTime) {
                        this.dragRegion.startTime = newStart;
                    }
                    break;
                case 'resize-right':
                    const newEnd = this.dragRegion.endTime + deltaTime;
                    if (newEnd > this.dragRegion.startTime && newEnd <= duration) {
                        this.dragRegion.endTime = newEnd;
                    }
                    break;
            }
            
            this.render();
            // バッファを更新
            this.loopMaker.updateBuffers();
        } else {
            // マウスオーバー時のカーソル変更
            const region = this.getRegionAt(e.clientX, e.clientY);
            if (region) {
                const dragType = this.getDragType(region, e.clientX, e.clientY);
                if (dragType === 'move') {
                    this.canvas.style.cursor = 'move';
                } else if (dragType === 'resize-left' || dragType === 'resize-right') {
                    this.canvas.style.cursor = 'ew-resize';
                } else {
                    this.canvas.style.cursor = 'default';
                }
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }
    
    handleMouseUp(e) {
        if (this.dragging) {
            // Altキーが押されていた場合は複製
            if (this.isDuplicating && this.dragRegion) {
                const newRegion = this.addRegion(
                    this.dragRegion.startTime,
                    this.dragRegion.endTime,
                    this.dragRegion.sourceBuffer,
                    this.dragRegion.sourceStartTime
                );
                // 複製したリージョンを少しずらす
                const offset = (this.dragRegion.endTime - this.dragRegion.startTime) * 0.1;
                newRegion.startTime += offset;
                newRegion.endTime += offset;
                this.selectRegion(newRegion);
            }
            
            this.dragging = false;
            this.dragType = null;
            this.dragRegion = null;
            this.isDuplicating = false;
        }
        this.render();
    }
    
    // リージョンを描画
    render() {
        if (!this.canvas) return;
        
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const ctx = this.ctx;
        
        ctx.clearRect(0, 0, width, height);
        
        const buffer = this.trackNumber === 1 ? this.loopMaker.track1Buffer : this.loopMaker.track2Buffer;
        if (!buffer) return;
        
        // 表示範囲のdurationを使用（同期された表示範囲）
        const duration = this.loopMaker.trackDisplayDuration || buffer.duration;
        const timeScale = width / duration;
        
        // 現在の再生位置を取得
        const currentPlaybackTime = this.loopMaker.audioPlayer ? this.loopMaker.audioPlayer.getCurrentPlaybackTime() : null;
        
        // リージョンを描画
        this.regions.forEach(region => {
            if (!region.sourceBuffer) return;
            
            const startX = region.startTime * timeScale;
            const endX = region.endTime * timeScale;
            const regionWidth = endX - startX;
            
            // リージョンの背景（半透明）
            ctx.fillStyle = region.selected ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.05)';
            ctx.fillRect(startX, 0, regionWidth, height);
            
            // リージョン内に波形を描画
            this.drawRegionWaveform(ctx, region, startX, endX, height, duration, timeScale);
            
            // リージョンの境界線
            ctx.strokeStyle = region.selected ? '#667eea' : '#999';
            ctx.lineWidth = region.selected ? 2 : 1;
            ctx.strokeRect(startX, 0, regionWidth, height);
            
            // アンカーを描画
            const anchorSize = 8;
            ctx.fillStyle = region.selected ? '#667eea' : '#666';
            
            // 右下（タイムストレッチ）
            ctx.fillRect(endX - anchorSize/2, height - anchorSize/2, anchorSize, anchorSize);
            
            // 再生位置をオレンジ線で表示（リージョン内にある場合）
            if (currentPlaybackTime !== null && currentPlaybackTime >= region.startTime && currentPlaybackTime <= region.endTime) {
                const playbackX = currentPlaybackTime * timeScale;
                ctx.strokeStyle = '#ff8c00'; // オレンジ色
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(playbackX, 0);
                ctx.lineTo(playbackX, height);
                ctx.stroke();
            }
        });
    }
    
    // リージョン内の波形を描画
    drawRegionWaveform(ctx, region, startX, endX, height, displayDuration, timeScale) {
        if (!region.sourceBuffer) return;
        
        const sourceBuffer = region.sourceBuffer;
        const sourceStartTime = region.sourceStartTime;
        const regionStartTime = region.startTime;
        const regionEndTime = region.endTime;
        const regionDuration = regionEndTime - regionStartTime;
        
        // リージョンの範囲内にクリッピング
        const clipStartX = Math.max(0, startX);
        const clipEndX = Math.min(ctx.canvas.width, endX);
        const clipWidth = clipEndX - clipStartX;
        
        if (clipWidth <= 0) return;
        
        // リージョン内の波形を描画
        const numChannels = sourceBuffer.numberOfChannels;
        const trackHeight = numChannels === 2 ? height / 2 : height;
        const sampleRate = sourceBuffer.sampleRate;
        
        // リージョン内の時間スケール（リージョンの幅に対する）
        const regionTimeScale = clipWidth / regionDuration;
        
        // 波形の範囲をサンプルに変換
        const sourceDuration = sourceBuffer.duration;
        const availableDuration = Math.min(regionDuration, sourceDuration - sourceStartTime);
        const waveformStartSample = Math.floor(sourceStartTime * sampleRate);
        const waveformEndSample = Math.floor((sourceStartTime + availableDuration) * sampleRate);
        const samplesPerPixel = Math.max(1, Math.floor((waveformEndSample - waveformStartSample) / clipWidth));
        
        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = sourceBuffer.getChannelData(channel);
            const yOffset = channel * trackHeight;
            const centerY = yOffset + trackHeight / 2;
            
            ctx.strokeStyle = channel === 0 ? '#667eea' : '#764ba2';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            
            let firstPointTop = true;
            let firstPointBottom = true;
            
            // 波形を描画（上側と下側を一度に計算して効率化）
            const points = [];
            for (let x = clipStartX; x < clipEndX; x++) {
                // リージョン内の相対位置（0からregionDuration）
                const relativeX = x - startX;
                const relativeTime = relativeX / timeScale;
                
                // 元波形内の時間
                const sourceTime = sourceStartTime + relativeTime;
                const pixelStartSample = Math.floor(sourceTime * sampleRate);
                
                if (pixelStartSample < waveformStartSample || pixelStartSample >= waveformEndSample) continue;
                if (pixelStartSample < 0 || pixelStartSample >= channelData.length) continue;
                
                // 最大値と最小値を計算（最適化：大きな波形の場合は間引く）
                let max = -Infinity;
                let min = Infinity;
                const actualSamplesPerPixel = Math.min(samplesPerPixel, channelData.length - pixelStartSample, waveformEndSample - pixelStartSample);
                // サンプル数が多い場合は間引いて計算（最大100サンプルまで）
                const sampleStep = actualSamplesPerPixel > 100 ? Math.ceil(actualSamplesPerPixel / 100) : 1;
                for (let i = 0; i < actualSamplesPerPixel && pixelStartSample + i < channelData.length && pixelStartSample + i >= waveformStartSample && pixelStartSample + i < waveformEndSample; i += sampleStep) {
                    const value = channelData[pixelStartSample + i];
                    if (value > max) max = value;
                    if (value < min) min = value;
                }
                
                if (max === -Infinity || min === Infinity) continue;
                
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
    
    // すべてのリージョンを取得
    getRegions() {
        return this.regions;
    }
    
    // リージョンをクリア
    clearRegions() {
        this.regions = [];
        this.selectedRegion = null;
    }

    // 現在選択されているリージョンを取得
    getSelectedRegion() {
        return this.selectedRegion;
    }
}
