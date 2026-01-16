// 空間デザイン UI部分（キャンバス操作）
class SpatialDesignUI {
    constructor(canvas, audioProcessor) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioProcessor = audioProcessor;
        
        // トラックの位置（X-Z平面）
        this.track1Position = { x: 0, z: 0 };
        this.track2Position = { x: 0, z: 0 };
        
        // 残響Mix
        this.reverbMix = 0;
        
        this.dragging = false;
        this.dragTrack = null;
        
        this.setupEventListeners();
        this.setupBypassButton();
        // 初期モードを設定
        if (this.audioProcessor && this.audioProcessor.setMode) {
            const modeSelect = document.getElementById('spatial-mode');
            if (modeSelect) {
                this.audioProcessor.setMode(modeSelect.value);
                this.updateStereoWidthVisibility(modeSelect.value);
            }
        }
        this.render();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        
        // 残響Mixスライダー
        const reverbMixSlider = document.getElementById('reverb-mix');
        if (reverbMixSlider) {
            reverbMixSlider.addEventListener('input', (e) => {
                this.reverbMix = parseFloat(e.target.value);
                document.getElementById('reverb-mix-value').textContent = Math.round(this.reverbMix) + '%';
                this.updateProcessor();
            });
        }
        
        // モード選択
        const modeSelect = document.getElementById('spatial-mode');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                const mode = e.target.value;
                if (this.audioProcessor && this.audioProcessor.setMode) {
                    this.audioProcessor.setMode(mode);
                }
                this.updateStereoWidthVisibility(mode);
            });
        }
        
        // ステレオ幅スライダー
        const stereoWidthSlider = document.getElementById('stereo-width');
        if (stereoWidthSlider) {
            stereoWidthSlider.addEventListener('input', (e) => {
                const width = parseFloat(e.target.value);
                document.getElementById('stereo-width-value').textContent = Math.round(width) + '%';
                if (this.audioProcessor && this.audioProcessor.setStereoWidth) {
                    this.audioProcessor.setStereoWidth(width);
                }
            });
        }
    }
    
    updateStereoWidthVisibility(mode) {
        const stereoWidthControl = document.getElementById('stereo-width-control');
        if (stereoWidthControl) {
            if (mode === 'stereo-width') {
                stereoWidthControl.classList.remove('hidden');
            } else {
                stereoWidthControl.classList.add('hidden');
            }
        }
    }
    
    setupBypassButton() {
        const bypassButton = document.getElementById('spatial-bypass');
        if (bypassButton) {
            bypassButton.addEventListener('click', () => {
                const isBypassed = this.audioProcessor ? !this.audioProcessor.getBypass() : false;
                if (this.audioProcessor) {
                    this.audioProcessor.setBypass(isBypassed);
                }
                this.updateBypassButton(isBypassed);
            });
            
            // 初期状態を反映
            const isBypassed = this.audioProcessor ? this.audioProcessor.getBypass() : false;
            this.updateBypassButton(isBypassed);
        }
    }
    
    updateBypassButton(isBypassed) {
        const bypassButton = document.getElementById('spatial-bypass');
        if (bypassButton) {
            if (isBypassed) {
                bypassButton.classList.add('active');
                bypassButton.textContent = 'Bypass ON';
            } else {
                bypassButton.classList.remove('active');
                bypassButton.textContent = 'Bypass';
            }
        }
    }
    
    getTrackAt(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // 中心を原点とする座標系に変換
        const centerX = width / 2;
        const centerY = height / 2;
        
        // トラック1の位置
        const track1X = this.track1Position.x * centerX + centerX;
        const track1Z = this.track1Position.z * centerY + centerY;
        const track1Radius = 15;
        
        if (Math.abs(canvasX - track1X) < track1Radius && Math.abs(canvasY - track1Z) < track1Radius) {
            return 1;
        }
        
        // トラック2の位置
        const track2X = this.track2Position.x * centerX + centerX;
        const track2Z = this.track2Position.z * centerY + centerY;
        const track2Radius = 15;
        
        if (Math.abs(canvasX - track2X) < track2Radius && Math.abs(canvasY - track2Z) < track2Radius) {
            return 2;
        }
        
        return null;
    }
    
    handleMouseDown(e) {
        const track = this.getTrackAt(e.clientX, e.clientY);
        if (track) {
            this.dragging = true;
            this.dragTrack = track;
            e.preventDefault();
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        if (this.dragging && this.dragTrack) {
            // 中心を原点とする座標系に変換（-1から1の範囲）
            const posX = Math.max(-1, Math.min(1, (canvasX - centerX) / centerX));
            const posZ = Math.max(-1, Math.min(1, (canvasY - centerY) / centerY));
            
            if (this.dragTrack === 1) {
                this.track1Position = { x: posX, z: posZ };
            } else if (this.dragTrack === 2) {
                this.track2Position = { x: posX, z: posZ };
            }
            
            this.render();
            this.updateProcessor();
        }
    }
    
    handleMouseUp(e) {
        this.dragging = false;
        this.dragTrack = null;
    }
    
    updateProcessor() {
        if (this.audioProcessor) {
            this.audioProcessor.updateSpatialPosition(
                this.track1Position,
                this.track2Position,
                this.reverbMix
            );
        }
    }
    
    render() {
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const ctx = this.ctx;
        
        ctx.clearRect(0, 0, width, height);
        
        // 背景
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);
        
        const centerX = width / 2;
        const centerY = height / 2;
        
        // グリッドを描画
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        // 縦線
        for (let i = 0; i <= 4; i++) {
            const x = (width / 4) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // 横線
        for (let i = 0; i <= 4; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // 中心点
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // 距離を計算（10mスケール）
        const maxDistance = 10.0;
        const distance1 = Math.sqrt(this.track1Position.x * this.track1Position.x + this.track1Position.z * this.track1Position.z) * maxDistance;
        const distance2 = Math.sqrt(this.track2Position.x * this.track2Position.x + this.track2Position.z * this.track2Position.z) * maxDistance;
        
        // トラック1の位置
        const track1X = this.track1Position.x * centerX + centerX;
        const track1Z = this.track1Position.z * centerY + centerY;
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(track1X, track1Z, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('T1', track1X, track1Z + 4);
        
        // トラック1の距離情報を表示
        ctx.fillStyle = '#667eea';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        const distance1Text = `距離: ${distance1.toFixed(1)}m`;
        const distance1Width = ctx.measureText(distance1Text).width;
        ctx.fillRect(track1X + 20, track1Z - 8, distance1Width + 4, 14);
        ctx.fillStyle = 'white';
        ctx.fillText(distance1Text, track1X + 22, track1Z + 2);
        
        // トラック2の位置
        const track2X = this.track2Position.x * centerX + centerX;
        const track2Z = this.track2Position.z * centerY + centerY;
        ctx.fillStyle = '#764ba2';
        ctx.beginPath();
        ctx.arc(track2X, track2Z, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('T2', track2X, track2Z + 4);
        
        // トラック2の距離情報を表示
        ctx.fillStyle = '#764ba2';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        const distance2Text = `距離: ${distance2.toFixed(1)}m`;
        const distance2Width = ctx.measureText(distance2Text).width;
        ctx.fillRect(track2X + 20, track2Z - 8, distance2Width + 4, 14);
        ctx.fillStyle = 'white';
        ctx.fillText(distance2Text, track2X + 22, track2Z + 2);
        
        // ラベル
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('X軸（左右）', 10, 20);
        ctx.textAlign = 'right';
        ctx.fillText('Z軸（前後）', width - 10, height - 10);
        
        // 距離スケールの説明
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('※ 中心からの距離: 最大10m', 10, height - 10);
    }
    
    enable() {
        const slider = document.getElementById('reverb-mix');
        if (slider) {
            slider.disabled = false;
        }
        const bypassButton = document.getElementById('spatial-bypass');
        if (bypassButton) {
            bypassButton.disabled = false;
        }
        const modeSelect = document.getElementById('spatial-mode');
        if (modeSelect) {
            modeSelect.disabled = false;
        }
        const stereoWidthSlider = document.getElementById('stereo-width');
        if (stereoWidthSlider) {
            stereoWidthSlider.disabled = false;
        }
    }
    
    disable() {
        const slider = document.getElementById('reverb-mix');
        if (slider) {
            slider.disabled = true;
        }
        const bypassButton = document.getElementById('spatial-bypass');
        if (bypassButton) {
            bypassButton.disabled = true;
        }
        const modeSelect = document.getElementById('spatial-mode');
        if (modeSelect) {
            modeSelect.disabled = true;
        }
        const stereoWidthSlider = document.getElementById('stereo-width');
        if (stereoWidthSlider) {
            stereoWidthSlider.disabled = true;
        }
    }
}
