// 3-Band MultiBand Comp 音響処理部分
class MultiBandCompProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // バンド分割用のフィルター（Linkwitz-Riley 4次フィルター用）
        // 各バンドで2つのBiquadFilterをカスケード接続して4次フィルターを実現
        this.lowFilter1 = null;  // 低域用ローパス1
        this.lowFilter2 = null;  // 低域用ローパス2
        this.midFilterHigh1 = null; // 中域用ハイパス1
        this.midFilterHigh2 = null; // 中域用ハイパス2
        this.midFilterLow1 = null;  // 中域用ローパス1
        this.midFilterLow2 = null;  // 中域用ローパス2
        this.highFilter1 = null; // 高域用ハイパス1
        this.highFilter2 = null; // 高域用ハイパス2
        
        // 各バンド用のゲインノード
        this.lowGain = null;
        this.midGain = null;
        this.highGain = null;
        
        // 入出力ノード
        this.inputGain = null;
        this.outputGain = null;
        
        // Mix用のノード
        this.bypassGain = null;        // バイパス経路のゲイン
        this.effectMixGain = null;     // エフェクト経路のMixゲイン
        this.bypassMixGain = null;     // バイパス経路のMixゲイン
        
        this.params = {
            // 将来的なUp/Down Comp用のパラメータは残しつつ、
            // まずは各バンドのGainだけを利用する
            low:  { up: 0, down: 0, gain: 100 },
            mid:  { up: 0, down: 0, gain: 100 },
            high: { up: 0, down: 0, gain: 100 },
            mix: 100,
            lowMidCrossover: 500,   // 低域と中域のクロスオーバー
            midHighCrossover: 3000   // 中域と高域のクロスオーバー
        };
        
        // Bypass状態
        this.isBypassed = false;
        
        this.setupFilters();
    }
    
    setupFilters() {
        if (!this.audioContext) return;
        
        // 入出力
        this.inputGain = this.audioContext.createGain();
        this.outputGain = this.audioContext.createGain();

        // クロスオーバー周波数（初期値）
        const lowMidCrossover = this.params.lowMidCrossover ?? 500;
        const midHighCrossover = this.params.midHighCrossover ?? 3000;
        
        // Linkwitz-Riley 4次フィルターを実装
        // 各バンドで2つの2次バターワースフィルターをカスケード接続
        
        // 低域: 2つのローパスフィルター（4次Linkwitz-Riley）
        this.lowFilter1 = this.audioContext.createBiquadFilter();
        this.lowFilter1.type = 'lowpass';
        this.lowFilter1.frequency.value = lowMidCrossover;
        this.lowFilter1.Q.value = 0.707; // バターワース特性
        
        this.lowFilter2 = this.audioContext.createBiquadFilter();
        this.lowFilter2.type = 'lowpass';
        this.lowFilter2.frequency.value = lowMidCrossover;
        this.lowFilter2.Q.value = 0.707;
        
        // 中域: ハイパス（2つ）+ ローパス（2つ）の組み合わせ
        this.midFilterHigh1 = this.audioContext.createBiquadFilter();
        this.midFilterHigh1.type = 'highpass';
        this.midFilterHigh1.frequency.value = lowMidCrossover;
        this.midFilterHigh1.Q.value = 0.707;
        
        this.midFilterHigh2 = this.audioContext.createBiquadFilter();
        this.midFilterHigh2.type = 'highpass';
        this.midFilterHigh2.frequency.value = lowMidCrossover;
        this.midFilterHigh2.Q.value = 0.707;
        
        this.midFilterLow1 = this.audioContext.createBiquadFilter();
        this.midFilterLow1.type = 'lowpass';
        this.midFilterLow1.frequency.value = midHighCrossover;
        this.midFilterLow1.Q.value = 0.707;
        
        this.midFilterLow2 = this.audioContext.createBiquadFilter();
        this.midFilterLow2.type = 'lowpass';
        this.midFilterLow2.frequency.value = midHighCrossover;
        this.midFilterLow2.Q.value = 0.707;
        
        // 高域: 2つのハイパスフィルター（4次Linkwitz-Riley）
        this.highFilter1 = this.audioContext.createBiquadFilter();
        this.highFilter1.type = 'highpass';
        this.highFilter1.frequency.value = midHighCrossover;
        this.highFilter1.Q.value = 0.707;
        
        this.highFilter2 = this.audioContext.createBiquadFilter();
        this.highFilter2.type = 'highpass';
        this.highFilter2.frequency.value = midHighCrossover;
        this.highFilter2.Q.value = 0.707;
        
        // 各バンド用のゲインノード
        this.lowGain = this.audioContext.createGain();
        this.midGain = this.audioContext.createGain();
        this.highGain = this.audioContext.createGain();

        // Mix用のノード
        this.bypassGain = this.audioContext.createGain();
        this.bypassGain.gain.value = 1.0;  // バイパスはそのまま
        
        this.effectMixGain = this.audioContext.createGain();
        this.bypassMixGain = this.audioContext.createGain();

        // ノード接続
        // エフェクト経路: 入力 -> 各フィルター（4次Linkwitz-Riley） -> 各バンドゲイン -> エフェクトMixゲイン -> 出力
        
        // 低域: 入力 -> ローパス1 -> ローパス2 -> ゲイン（4次Linkwitz-Riley）
        this.inputGain.connect(this.lowFilter1);
        this.lowFilter1.connect(this.lowFilter2);
        this.lowFilter2.connect(this.lowGain);
        
        // 中域: 入力 -> ハイパス1 -> ハイパス2 -> ローパス1 -> ローパス2 -> ゲイン（帯域通過、4次Linkwitz-Riley）
        this.inputGain.connect(this.midFilterHigh1);
        this.midFilterHigh1.connect(this.midFilterHigh2);
        this.midFilterHigh2.connect(this.midFilterLow1);
        this.midFilterLow1.connect(this.midFilterLow2);
        this.midFilterLow2.connect(this.midGain);
        
        // 高域: 入力 -> ハイパス1 -> ハイパス2 -> ゲイン（4次Linkwitz-Riley）
        this.inputGain.connect(this.highFilter1);
        this.highFilter1.connect(this.highFilter2);
        this.highFilter2.connect(this.highGain);

        this.lowGain.connect(this.effectMixGain);
        this.midGain.connect(this.effectMixGain);
        this.highGain.connect(this.effectMixGain);

        // バイパス経路: 入力 -> バイパスゲイン -> バイパスMixゲイン -> 出力
        this.inputGain.connect(this.bypassGain);
        this.bypassGain.connect(this.bypassMixGain);

        // Mix: エフェクト経路とバイパス経路を合算して出力
        this.effectMixGain.connect(this.outputGain);
        this.bypassMixGain.connect(this.outputGain);
    }
    
    updateMultiBandComp(params) {
        this.params = { ...this.params, ...params };
        
        // クロスオーバー周波数を更新（4次Linkwitz-Rileyフィルター）
        if (params.lowMidCrossover !== undefined) {
            const freq = Math.max(20, Math.min(20000, params.lowMidCrossover));
            // 低域: 2つのローパスフィルター
            if (this.lowFilter1) {
                this.lowFilter1.frequency.value = freq;
            }
            if (this.lowFilter2) {
                this.lowFilter2.frequency.value = freq;
            }
            // 中域: 2つのハイパスフィルター
            if (this.midFilterHigh1) {
                this.midFilterHigh1.frequency.value = freq;
            }
            if (this.midFilterHigh2) {
                this.midFilterHigh2.frequency.value = freq;
            }
        }
        
        if (params.midHighCrossover !== undefined) {
            const freq = Math.max(20, Math.min(20000, params.midHighCrossover));
            // 中域: 2つのローパスフィルター
            if (this.midFilterLow1) {
                this.midFilterLow1.frequency.value = freq;
            }
            if (this.midFilterLow2) {
                this.midFilterLow2.frequency.value = freq;
            }
            // 高域: 2つのハイパスフィルター
            if (this.highFilter1) {
                this.highFilter1.frequency.value = freq;
            }
            if (this.highFilter2) {
                this.highFilter2.frequency.value = freq;
            }
        }
        
        // 各バンドのGainを更新（0–200% を 0.0–2.0 のリニアゲインにマップ）
        const toLinearGain = (percent) => {
            const clamped = Math.max(0, Math.min(200, percent));
            return clamped / 100;
        };

        if (this.lowGain && params.low) {
            const gain = toLinearGain(params.low.gain ?? 100);
            this.lowGain.gain.value = gain;
        }
        if (this.midGain && params.mid) {
            const gain = toLinearGain(params.mid.gain ?? 100);
            this.midGain.gain.value = gain;
        }
        if (this.highGain && params.high) {
            const gain = toLinearGain(params.high.gain ?? 100);
            this.highGain.gain.value = gain;
        }

        // Mix値を更新（0–100% を 0.0–1.0 のリニアゲインにマップ）
        const mix = params.mix ?? this.params.mix ?? 100;
        const clampedMix = Math.max(0, Math.min(100, mix));
        const effectMix = clampedMix / 100;      // エフェクト経路のゲイン
        const bypassMix = (100 - clampedMix) / 100;  // バイパス経路のゲイン

        if (this.effectMixGain) {
            this.effectMixGain.gain.value = effectMix;
        }
        if (this.bypassMixGain) {
            this.bypassMixGain.gain.value = bypassMix;
        }
    }
    
    /**
     * Bypass状態を切り替え
     */
    setBypass(bypassed) {
        this.isBypassed = bypassed;
        
        if (bypassed) {
            // Bypass時: エフェクト経路を無効化、バイパス経路のみ
            if (this.effectMixGain) {
                this.effectMixGain.gain.value = 0;
            }
            if (this.bypassMixGain) {
                this.bypassMixGain.gain.value = 1;
            }
        } else {
            // 通常時: Mix値に応じて設定
            const mix = this.params.mix ?? 100;
            const clampedMix = Math.max(0, Math.min(100, mix));
            const effectMix = clampedMix / 100;
            const bypassMix = (100 - clampedMix) / 100;
            
            if (this.effectMixGain) {
                this.effectMixGain.gain.value = effectMix;
            }
            if (this.bypassMixGain) {
                this.bypassMixGain.gain.value = bypassMix;
            }
        }
    }
    
    /**
     * Bypass状態を取得
     */
    getBypass() {
        return this.isBypassed;
    }
    
    /**
     * 外部から接続しやすいように、入力ノードを返す
     * - 例: source.connect(mbc.getInputNode());
     */
    getInputNode() {
        return this.inputGain;
    }
    
    /**
     * 外部から接続しやすいように、出力ノードを返す
     * - 例: mbc.getOutputNode().connect(audioContext.destination);
     */
    getOutputNode() {
        return this.outputGain;
    }
}
