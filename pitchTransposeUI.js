// ピッチトランスポーズ UI部分
class PitchTransposeUI {
    constructor(audioProcessor, loopMaker) {
        this.audioProcessor = audioProcessor;
        this.loopMaker = loopMaker;
        this.track1Transpose = 0;
        this.track1Cent = 0;
        this.track1Algorithm = 'resample';
        this.track2Transpose = 0;
        this.track2Cent = 0;
        this.track2Algorithm = 'resample';
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // トラック1のアルゴリズム選択
        const algorithm1 = document.getElementById('pitch-algorithm-track1');
        if (algorithm1) {
            algorithm1.addEventListener('change', (e) => {
                this.track1Algorithm = e.target.value;
                this.updatePitch(1);
            });
        }
        
        // トラック1の移調
        const transpose1 = document.getElementById('pitch-transpose-track1');
        const cent1 = document.getElementById('pitch-cent-track1');
        const transpose1Plus = document.getElementById('pitch-transpose-track1-plus');
        const transpose1Minus = document.getElementById('pitch-transpose-track1-minus');
        const cent1Plus = document.getElementById('pitch-cent-track1-plus');
        const cent1Minus = document.getElementById('pitch-cent-track1-minus');
        
        if (transpose1) {
            transpose1.addEventListener('input', (e) => {
                this.track1Transpose = parseInt(e.target.value) || 0;
                this.updatePitch(1);
            });
        }
        
        if (transpose1Plus) {
            transpose1Plus.addEventListener('click', () => {
                const newValue = Math.min(24, (this.track1Transpose || 0) + 1);
                this.track1Transpose = newValue;
                transpose1.value = newValue;
                this.updatePitch(1);
            });
        }
        
        if (transpose1Minus) {
            transpose1Minus.addEventListener('click', () => {
                const newValue = Math.max(-24, (this.track1Transpose || 0) - 1);
                this.track1Transpose = newValue;
                transpose1.value = newValue;
                this.updatePitch(1);
            });
        }
        
        if (cent1) {
            cent1.addEventListener('input', (e) => {
                this.track1Cent = parseInt(e.target.value) || 0;
                this.updatePitch(1);
            });
        }
        
        if (cent1Plus) {
            cent1Plus.addEventListener('click', () => {
                const newValue = Math.min(50, (this.track1Cent || 0) + 10);
                this.track1Cent = newValue;
                cent1.value = newValue;
                this.updatePitch(1);
            });
        }
        
        if (cent1Minus) {
            cent1Minus.addEventListener('click', () => {
                const newValue = Math.max(-50, (this.track1Cent || 0) - 10);
                this.track1Cent = newValue;
                cent1.value = newValue;
                this.updatePitch(1);
            });
        }
        
        // トラック2のアルゴリズム選択
        const algorithm2 = document.getElementById('pitch-algorithm-track2');
        if (algorithm2) {
            algorithm2.addEventListener('change', (e) => {
                this.track2Algorithm = e.target.value;
                this.updatePitch(2);
            });
        }
        
        // トラック2の移調
        const transpose2 = document.getElementById('pitch-transpose-track2');
        const cent2 = document.getElementById('pitch-cent-track2');
        const transpose2Plus = document.getElementById('pitch-transpose-track2-plus');
        const transpose2Minus = document.getElementById('pitch-transpose-track2-minus');
        const cent2Plus = document.getElementById('pitch-cent-track2-plus');
        const cent2Minus = document.getElementById('pitch-cent-track2-minus');
        
        if (transpose2) {
            transpose2.addEventListener('input', (e) => {
                this.track2Transpose = parseInt(e.target.value) || 0;
                this.updatePitch(2);
            });
        }
        
        if (transpose2Plus) {
            transpose2Plus.addEventListener('click', () => {
                const newValue = Math.min(24, (this.track2Transpose || 0) + 1);
                this.track2Transpose = newValue;
                transpose2.value = newValue;
                this.updatePitch(2);
            });
        }
        
        if (transpose2Minus) {
            transpose2Minus.addEventListener('click', () => {
                const newValue = Math.max(-24, (this.track2Transpose || 0) - 1);
                this.track2Transpose = newValue;
                transpose2.value = newValue;
                this.updatePitch(2);
            });
        }
        
        if (cent2) {
            cent2.addEventListener('input', (e) => {
                this.track2Cent = parseInt(e.target.value) || 0;
                this.updatePitch(2);
            });
        }
        
        if (cent2Plus) {
            cent2Plus.addEventListener('click', () => {
                const newValue = Math.min(50, (this.track2Cent || 0) + 10);
                this.track2Cent = newValue;
                cent2.value = newValue;
                this.updatePitch(2);
            });
        }
        
        if (cent2Minus) {
            cent2Minus.addEventListener('click', () => {
                const newValue = Math.max(-50, (this.track2Cent || 0) - 10);
                this.track2Cent = newValue;
                cent2.value = newValue;
                this.updatePitch(2);
            });
        }
    }
    
    updatePitch(trackNumber) {
        if (!this.audioProcessor) return;
        
        if (trackNumber === 1) {
            this.audioProcessor.setPitchShift(1, this.track1Transpose, this.track1Cent, this.track1Algorithm);
        } else if (trackNumber === 2) {
            this.audioProcessor.setPitchShift(2, this.track2Transpose, this.track2Cent, this.track2Algorithm);
        }
        
        // バッファを再生成して、再生中の場合は再生を再開
        if (this.loopMaker) {
            this.loopMaker.updateBuffers();
            this.loopMaker.drawWaveforms();
        }
    }
    
    enable() {
        const inputs = document.querySelectorAll('.pitch-input');
        inputs.forEach(input => {
            input.disabled = false;
        });
        const selects = document.querySelectorAll('.pitch-algorithm-select');
        selects.forEach(select => {
            select.disabled = false;
        });
        const buttons = document.querySelectorAll('.pitch-btn');
        buttons.forEach(button => {
            button.disabled = false;
        });
    }
    
    disable() {
        const inputs = document.querySelectorAll('.pitch-input');
        inputs.forEach(input => {
            input.disabled = true;
        });
        const selects = document.querySelectorAll('.pitch-algorithm-select');
        selects.forEach(select => {
            select.disabled = true;
        });
        const buttons = document.querySelectorAll('.pitch-btn');
        buttons.forEach(button => {
            button.disabled = true;
        });
    }
    
    getParams(trackNumber) {
        if (trackNumber === 1) {
            return { transpose: this.track1Transpose, cent: this.track1Cent, algorithm: this.track1Algorithm };
        } else if (trackNumber === 2) {
            return { transpose: this.track2Transpose, cent: this.track2Cent, algorithm: this.track2Algorithm };
        }
        return { transpose: 0, cent: 0, algorithm: 'resample' };
    }
}
