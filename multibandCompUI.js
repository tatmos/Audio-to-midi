// 3-Band MultiBand Comp UI部分
class MultiBandCompUI {
    constructor(audioProcessor) {
        this.audioProcessor = audioProcessor;
        
        // HTMLのスライダーから初期値を読み取る
        const getSliderValue = (id, defaultValue) => {
            const element = document.getElementById(id);
            return element ? parseFloat(element.value) : defaultValue;
        };
        
        this.params = {
            low:  { 
                up: getSliderValue('comp-l-up', 0),
                down: getSliderValue('comp-l-down', 0),
                gain: getSliderValue('comp-l-gain', 100)
            },
            mid:  { 
                up: getSliderValue('comp-m-up', 0),
                down: getSliderValue('comp-m-down', 0),
                gain: getSliderValue('comp-m-gain', 100)
            },
            high: { 
                up: getSliderValue('comp-h-up', 0),
                down: getSliderValue('comp-h-down', 0),
                gain: getSliderValue('comp-h-gain', 100)
            },
            mix: getSliderValue('comp-mix', 100),
            lowMidCrossover: getSliderValue('comp-low-mid-crossover', 500),
            midHighCrossover: getSliderValue('comp-mid-high-crossover', 3000)
        };
        
        this.setupEventListeners();
        this.setupBypassButton();
        this.updateDisplay();
        // 初期化時にプロセッサーに値を反映
        this.updateProcessor();
    }
    
    setupEventListeners() {
        // スライダーのイベントリスナーを設定
        const sliders = [
            { id: 'comp-h-up', param: 'high', type: 'up' },
            { id: 'comp-h-down', param: 'high', type: 'down' },
            { id: 'comp-m-up', param: 'mid', type: 'up' },
            { id: 'comp-m-down', param: 'mid', type: 'down' },
            { id: 'comp-l-up', param: 'low', type: 'up' },
            { id: 'comp-l-down', param: 'low', type: 'down' },
            { id: 'comp-h-gain', param: 'high', type: 'gain', syncId: 'comp-h-gain-detail' },
            { id: 'comp-m-gain', param: 'mid', type: 'gain', syncId: 'comp-m-gain-detail' },
            { id: 'comp-l-gain', param: 'low', type: 'gain', syncId: 'comp-l-gain-detail' },
            { id: 'comp-h-gain-detail', param: 'high', type: 'gain', syncId: 'comp-h-gain' },
            { id: 'comp-m-gain-detail', param: 'mid', type: 'gain', syncId: 'comp-m-gain' },
            { id: 'comp-l-gain-detail', param: 'low', type: 'gain', syncId: 'comp-l-gain' },
            { id: 'comp-mix', param: 'mix', type: 'mix' },
            { id: 'comp-low-mid-crossover', param: 'lowMidCrossover', type: 'crossover' },
            { id: 'comp-mid-high-crossover', param: 'midHighCrossover', type: 'crossover' }
        ];
        
        sliders.forEach(slider => {
            const element = document.getElementById(slider.id);
            if (element) {
                element.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    if (slider.param === 'mix') {
                        this.params.mix = value;
                    } else if (slider.type === 'crossover') {
                        this.params[slider.param] = value;
                    } else {
                        // gain と up/down をまとめて扱う
                        this.params[slider.param][slider.type] = value;
                    }
                    
                    // 同期するスライダーがあれば更新
                    if (slider.syncId) {
                        const syncElement = document.getElementById(slider.syncId);
                        if (syncElement) {
                            syncElement.value = value;
                        }
                    }
                    
                    this.updateDisplay();
                    this.updateProcessor();
                });
            }
        });
    }
    
    setupBypassButton() {
        const bypassButton = document.getElementById('comp-bypass');
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
        const bypassButton = document.getElementById('comp-bypass');
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
    
    updateDisplay() {
        // 表示値を更新
        const elements = {
            'comp-h-up-value': Math.round(this.params.high.up),
            'comp-h-down-value': Math.round(this.params.high.down),
            'comp-h-gain-value': Math.round(this.params.high.gain),
            'comp-h-gain-detail-value': Math.round(this.params.high.gain),
            'comp-m-up-value': Math.round(this.params.mid.up),
            'comp-m-down-value': Math.round(this.params.mid.down),
            'comp-m-gain-value': Math.round(this.params.mid.gain),
            'comp-m-gain-detail-value': Math.round(this.params.mid.gain),
            'comp-l-up-value': Math.round(this.params.low.up),
            'comp-l-down-value': Math.round(this.params.low.down),
            'comp-l-gain-value': Math.round(this.params.low.gain),
            'comp-l-gain-detail-value': Math.round(this.params.low.gain),
            'comp-mix-value': Math.round(this.params.mix),
            'comp-low-mid-crossover-value': Math.round(this.params.lowMidCrossover),
            'comp-mid-high-crossover-value': Math.round(this.params.midHighCrossover)
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (id.includes('crossover')) {
                    element.textContent = value + ' Hz';
                } else {
                    element.textContent = value + '%';
                }
            }
        });
        
        // Gainスライダーの値も同期
        const gainSliders = [
            { main: 'comp-h-gain', detail: 'comp-h-gain-detail', param: 'high' },
            { main: 'comp-m-gain', detail: 'comp-m-gain-detail', param: 'mid' },
            { main: 'comp-l-gain', detail: 'comp-l-gain-detail', param: 'low' }
        ];
        
        gainSliders.forEach(({ main, detail, param }) => {
            const mainSlider = document.getElementById(main);
            const detailSlider = document.getElementById(detail);
            if (mainSlider && detailSlider) {
                const value = this.params[param].gain;
                mainSlider.value = value;
                detailSlider.value = value;
            }
        });
    }
    
    updateProcessor() {
        if (this.audioProcessor) {
            this.audioProcessor.updateMultiBandComp(this.params);
        }
    }
    
    enable() {
        const sliders = document.querySelectorAll('.multiband-comp-container .slider');
        sliders.forEach(slider => {
            slider.disabled = false;
        });
        const bypassButton = document.getElementById('comp-bypass');
        if (bypassButton) {
            bypassButton.disabled = false;
        }
        const detailButton = document.getElementById('comp-detail-btn');
        if (detailButton) {
            detailButton.disabled = false;
        }
    }
    
    disable() {
        const sliders = document.querySelectorAll('.multiband-comp-container .slider');
        sliders.forEach(slider => {
            slider.disabled = true;
        });
        const bypassButton = document.getElementById('comp-bypass');
        if (bypassButton) {
            bypassButton.disabled = true;
        }
        const detailButton = document.getElementById('comp-detail-btn');
        if (detailButton) {
            detailButton.disabled = false; // 詳細ボタンは常に有効（折りたたみ用）
        }
    }
    
    getParams() {
        return this.params;
    }
}
