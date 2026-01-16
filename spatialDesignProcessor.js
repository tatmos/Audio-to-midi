// 空間デザイン 音響処理部分（パンニング・距離減衰・残響）
class SpatialDesignProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // 距離減衰用のGainノード
        this.track1DistanceGain = null;
        this.track2DistanceGain = null;
        
        // パンニング用のGainノード
        this.track1PanLeft = null;
        this.track1PanRight = null;
        this.track2PanLeft = null;
        this.track2PanRight = null;
        
        // 残響用のConvolverNode
        this.track1Reverb = null;
        this.track2Reverb = null;
        this.track1ReverbGain = null;
        this.track2ReverbGain = null;
        this.track1DryGain = null;
        this.track2DryGain = null;
        
        // 残響用のパンニングノード（残響もパンニング処理を経由）
        this.track1ReverbPanLeft = null;
        this.track1ReverbPanRight = null;
        this.track2ReverbPanLeft = null;
        this.track2ReverbPanRight = null;
        
        this.track1Position = { x: 0, z: 0 };
        this.track2Position = { x: 0, z: 0 };
        this.reverbMix = 0;
        
        // 距離減衰のパラメータ（10mを基準とする）
        this.maxDistance = 10.0; // 最大距離（メートル）
        this.referenceDistance = 1.0; // 基準距離（メートル）
        
        // バイパス状態
        this.isBypassed = false;
        
        // モード設定
        this.mode = 'mono-pan'; // 'mono-pan', 'channel-volume', 'stereo-width'
        this.stereoWidth = 100; // ステレオ幅（0-200%）
        
        // チャンネルボリューム用のGainノード
        this.track1LeftVolume = null;
        this.track1RightVolume = null;
        this.track2LeftVolume = null;
        this.track2RightVolume = null;
        
        // モノラル化用のMerger
        this.track1MonoMerger = null;
        this.track2MonoMerger = null;
        
        this.setupNodes();
    }
    
    setupNodes() {
        if (!this.audioContext) return;
        
        // 距離減衰用のGainノードを作成
        this.track1DistanceGain = this.audioContext.createGain();
        this.track2DistanceGain = this.audioContext.createGain();
        
        // パンニング用のGainノードを作成
        this.track1PanLeft = this.audioContext.createGain();
        this.track1PanRight = this.audioContext.createGain();
        this.track2PanLeft = this.audioContext.createGain();
        this.track2PanRight = this.audioContext.createGain();
        
        // チャンネルボリューム用のGainノードを作成
        this.track1LeftVolume = this.audioContext.createGain();
        this.track1RightVolume = this.audioContext.createGain();
        this.track2LeftVolume = this.audioContext.createGain();
        this.track2RightVolume = this.audioContext.createGain();
        
        // モノラル化用のMergerを作成
        this.track1MonoMerger = this.audioContext.createChannelMerger(1);
        this.track2MonoMerger = this.audioContext.createChannelMerger(1);
        
        // 残響用のGainノードを作成
        this.track1ReverbGain = this.audioContext.createGain();
        this.track2ReverbGain = this.audioContext.createGain();
        this.track1DryGain = this.audioContext.createGain();
        this.track2DryGain = this.audioContext.createGain();
        
        // ドライ信号用のGainノード（左チャンネルと右チャンネルを別々に処理）
        this.track1DryGainLeft = this.audioContext.createGain();
        this.track1DryGainRight = this.audioContext.createGain();
        this.track2DryGainLeft = this.audioContext.createGain();
        this.track2DryGainRight = this.audioContext.createGain();
        
        // 残響用のパンニングノードを作成
        this.track1ReverbPanLeft = this.audioContext.createGain();
        this.track1ReverbPanRight = this.audioContext.createGain();
        this.track2ReverbPanLeft = this.audioContext.createGain();
        this.track2ReverbPanRight = this.audioContext.createGain();
        
        // 残響用のConvolverNodeを作成（簡易残響）
        this.track1Reverb = this.audioContext.createConvolver();
        this.track2Reverb = this.audioContext.createConvolver();
        
        // 簡易残響インパルスレスポンスを生成
        this.createReverbImpulse();
    }
    
    createReverbImpulse() {
        // 簡易残響インパルスレスポンスを生成
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * 2; // 2秒
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        
        if (this.track1Reverb) {
            this.track1Reverb.buffer = impulse;
        }
        if (this.track2Reverb) {
            this.track2Reverb.buffer = impulse;
        }
    }
    
    updateSpatialPosition(track1Position, track2Position, reverbMix) {
        this.track1Position = track1Position;
        this.track2Position = track2Position;
        this.reverbMix = reverbMix;
        
        // バイパス時は処理をスキップ
        if (this.isBypassed) {
            this.applyBypassSettings();
            return;
        }
        
        // 距離を計算（-1から1の座標系を10mスケールに変換）
        const distance1 = Math.sqrt(track1Position.x * track1Position.x + track1Position.z * track1Position.z) * this.maxDistance;
        const distance2 = Math.sqrt(track2Position.x * track2Position.x + track2Position.z * track2Position.z) * this.maxDistance;
        
        // 距離減衰を計算（逆二乗の法則に基づく）
        const distanceGain1 = this.calculateDistanceAttenuation(distance1);
        const distanceGain2 = this.calculateDistanceAttenuation(distance2);
        
        if (this.track1DistanceGain) {
            this.track1DistanceGain.gain.value = distanceGain1;
        }
        if (this.track2DistanceGain) {
            this.track2DistanceGain.gain.value = distanceGain2;
        }
        
        // モードに応じて処理を分岐
        switch (this.mode) {
            case 'mono-pan':
                this.updateMonoPanMode(track1Position, track2Position);
                break;
            case 'channel-volume':
                this.updateChannelVolumeMode(track1Position, track2Position);
                break;
            case 'stereo-width':
                this.updateStereoWidthMode(track1Position, track2Position);
                break;
        }
        
        // 残響Mixを更新（距離とMix割合）
        const reverbAmount1 = Math.min(1, (distance1 / this.maxDistance) * (reverbMix / 100));
        const reverbAmount2 = Math.min(1, (distance2 / this.maxDistance) * (reverbMix / 100));
        
        if (this.track1ReverbGain && this.track1DryGainLeft && this.track1DryGainRight) {
            this.track1ReverbGain.gain.value = reverbAmount1;
            const dryGain = 1 - reverbAmount1;
            this.track1DryGainLeft.gain.value = dryGain;
            this.track1DryGainRight.gain.value = dryGain;
        }
        
        if (this.track2ReverbGain && this.track2DryGainLeft && this.track2DryGainRight) {
            this.track2ReverbGain.gain.value = reverbAmount2;
            const dryGain = 1 - reverbAmount2;
            this.track2DryGainLeft.gain.value = dryGain;
            this.track2DryGainRight.gain.value = dryGain;
        }
    }
    
    // モード1: LRミックス→モノラル→音像定位
    updateMonoPanMode(track1Position, track2Position) {
        // 左右チャンネルを0.5ずつに設定してモノラル化（LRミックス）
        if (this.track1LeftVolume && this.track1RightVolume) {
            this.track1LeftVolume.gain.value = 0.5;
            this.track1RightVolume.gain.value = 0.5;
        }
        if (this.track2LeftVolume && this.track2RightVolume) {
            this.track2LeftVolume.gain.value = 0.5;
            this.track2RightVolume.gain.value = 0.5;
        }
        
        // パンニングを更新（X座標に基づく、より正確な計算）
        if (this.track1PanLeft && this.track1PanRight) {
            const pan1 = (track1Position.x + 1) / 2; // 0から1に変換
            const panAngle1 = pan1 * Math.PI / 2; // 0からπ/2に変換
            this.track1PanLeft.gain.value = Math.cos(panAngle1);
            this.track1PanRight.gain.value = Math.sin(panAngle1);
        }
        
        if (this.track2PanLeft && this.track2PanRight) {
            const pan2 = (track2Position.x + 1) / 2;
            const panAngle2 = pan2 * Math.PI / 2;
            this.track2PanLeft.gain.value = Math.cos(panAngle2);
            this.track2PanRight.gain.value = Math.sin(panAngle2);
        }
        
        // 残響用のパンニングも更新（ドライ信号と同じパンニング）
        if (this.track1ReverbPanLeft && this.track1ReverbPanRight) {
            const pan1 = (track1Position.x + 1) / 2;
            const panAngle1 = pan1 * Math.PI / 2;
            this.track1ReverbPanLeft.gain.value = Math.cos(panAngle1);
            this.track1ReverbPanRight.gain.value = Math.sin(panAngle1);
        }
        
        if (this.track2ReverbPanLeft && this.track2ReverbPanRight) {
            const pan2 = (track2Position.x + 1) / 2;
            const panAngle2 = pan2 * Math.PI / 2;
            this.track2ReverbPanLeft.gain.value = Math.cos(panAngle2);
            this.track2ReverbPanRight.gain.value = Math.sin(panAngle2);
        }
    }
    
    // モード2: チャンネルボリュームの変更のみ
    updateChannelVolumeMode(track1Position, track2Position) {
        // X座標で左右チャンネルのボリュームを制御
        // -1（左）: 左100%, 右0%
        // 0（中央）: 左100%, 右100%
        // 1（右）: 左0%, 右100%
        if (this.track1LeftVolume && this.track1RightVolume) {
            const leftVol1 = Math.max(0, 1 - track1Position.x); // -1で1.0, 1で0.0
            const rightVol1 = Math.max(0, 1 + track1Position.x); // -1で0.0, 1で1.0
            this.track1LeftVolume.gain.value = leftVol1;
            this.track1RightVolume.gain.value = rightVol1;
        }
        
        if (this.track2LeftVolume && this.track2RightVolume) {
            const leftVol2 = Math.max(0, 1 - track2Position.x);
            const rightVol2 = Math.max(0, 1 + track2Position.x);
            this.track2LeftVolume.gain.value = leftVol2;
            this.track2RightVolume.gain.value = rightVol2;
        }
        
        // パンニングは使用しない（中央に設定）
        if (this.track1PanLeft && this.track1PanRight) {
            this.track1PanLeft.gain.value = 0.707;
            this.track1PanRight.gain.value = 0.707;
        }
        if (this.track2PanLeft && this.track2PanRight) {
            this.track2PanLeft.gain.value = 0.707;
            this.track2PanRight.gain.value = 0.707;
        }
        
        // 残響用のパンニングも中央に設定
        if (this.track1ReverbPanLeft && this.track1ReverbPanRight) {
            this.track1ReverbPanLeft.gain.value = 0.707;
            this.track1ReverbPanRight.gain.value = 0.707;
        }
        if (this.track2ReverbPanLeft && this.track2ReverbPanRight) {
            this.track2ReverbPanLeft.gain.value = 0.707;
            this.track2ReverbPanRight.gain.value = 0.707;
        }
    }
    
    // モード3: ステレオ幅指定のL,R独立した空間配置
    updateStereoWidthMode(track1Position, track2Position) {
        // ステレオ幅に基づいて左右チャンネルを独立配置
        // ステレオ幅100%: 通常のステレオ
        // ステレオ幅0%: モノラル
        // ステレオ幅200%: 超広いステレオ
        const width = this.stereoWidth / 100; // 0.0 - 2.0
        
        // 左チャンネルの位置（X座標）
        const leftPan1 = Math.max(-1, Math.min(1, track1Position.x - (1 - width) * 0.5));
        const leftPan2 = Math.max(-1, Math.min(1, track2Position.x - (1 - width) * 0.5));
        
        // 右チャンネルの位置（X座標）
        const rightPan1 = Math.max(-1, Math.min(1, track1Position.x + (1 - width) * 0.5));
        const rightPan2 = Math.max(-1, Math.min(1, track2Position.x + (1 - width) * 0.5));
        
        // 左チャンネルのパンニング
        if (this.track1PanLeft && this.track1LeftVolume) {
            const pan1 = (leftPan1 + 1) / 2;
            const panAngle1 = pan1 * Math.PI / 2;
            this.track1PanLeft.gain.value = Math.cos(panAngle1);
            this.track1LeftVolume.gain.value = 1.0;
        }
        
        if (this.track2PanLeft && this.track2LeftVolume) {
            const pan2 = (leftPan2 + 1) / 2;
            const panAngle2 = pan2 * Math.PI / 2;
            this.track2PanLeft.gain.value = Math.cos(panAngle2);
            this.track2LeftVolume.gain.value = 1.0;
        }
        
        // 右チャンネルのパンニング
        if (this.track1PanRight && this.track1RightVolume) {
            const pan1 = (rightPan1 + 1) / 2;
            const panAngle1 = pan1 * Math.PI / 2;
            this.track1PanRight.gain.value = Math.sin(panAngle1);
            this.track1RightVolume.gain.value = 1.0;
        }
        
        if (this.track2PanRight && this.track2RightVolume) {
            const pan2 = (rightPan2 + 1) / 2;
            const panAngle2 = pan2 * Math.PI / 2;
            this.track2PanRight.gain.value = Math.sin(panAngle2);
            this.track2RightVolume.gain.value = 1.0;
        }
    }
    
    // モードを設定
    setMode(mode) {
        this.mode = mode;
        this.updateSpatialPosition(this.track1Position, this.track2Position, this.reverbMix);
    }
    
    // ステレオ幅を設定
    setStereoWidth(width) {
        this.stereoWidth = Math.max(0, Math.min(200, width));
        if (this.mode === 'stereo-width') {
            this.updateSpatialPosition(this.track1Position, this.track2Position, this.reverbMix);
        }
    }
    
    // バイパス時の設定を適用（信号をそのまま通す）
    applyBypassSettings() {
        // 距離減衰を無効化（ゲイン1.0）
        if (this.track1DistanceGain) {
            this.track1DistanceGain.gain.value = 1.0;
        }
        if (this.track2DistanceGain) {
            this.track2DistanceGain.gain.value = 1.0;
        }
        
        // パンニングを中央（左右均等）
        if (this.track1PanLeft && this.track1PanRight) {
            // 中央 = 0.707 (1/√2) で左右均等
            this.track1PanLeft.gain.value = 0.707;
            this.track1PanRight.gain.value = 0.707;
        }
        if (this.track2PanLeft && this.track2PanRight) {
            this.track2PanLeft.gain.value = 0.707;
            this.track2PanRight.gain.value = 0.707;
        }
        
        // 残響を無効化
        if (this.track1ReverbGain && this.track1DryGainLeft && this.track1DryGainRight) {
            this.track1ReverbGain.gain.value = 0;
            this.track1DryGainLeft.gain.value = 1;
            this.track1DryGainRight.gain.value = 1;
        }
        if (this.track2ReverbGain && this.track2DryGainLeft && this.track2DryGainRight) {
            this.track2ReverbGain.gain.value = 0;
            this.track2DryGainLeft.gain.value = 1;
            this.track2DryGainRight.gain.value = 1;
        }
    }
    
    // バイパス状態を設定
    setBypass(bypassed) {
        this.isBypassed = bypassed;
        // バイパス状態に応じて設定を更新
        this.updateSpatialPosition(this.track1Position, this.track2Position, this.reverbMix);
    }
    
    // バイパス状態を取得
    getBypass() {
        return this.isBypassed;
    }
    
    // 距離減衰を計算（逆二乗の法則）
    calculateDistanceAttenuation(distance) {
        // 基準距離でのゲインを1として、距離に応じて減衰
        // gain = referenceDistance^2 / (referenceDistance^2 + distance^2)
        const refDistSq = this.referenceDistance * this.referenceDistance;
        const distSq = distance * distance;
        const gain = refDistSq / (refDistSq + distSq);
        
        // 最小ゲインを設定（完全に消音しないように）
        return Math.max(0.01, gain);
    }
    
    // トラック1のオーディオノードを接続
    connectTrack1(inputNode, outputNode) {
        if (!inputNode || !outputNode) return;
        
        // 既存の接続を切断（重複接続を防ぐ）
        this.disconnectTrack1();
        
        // 距離減衰を最初に適用
        inputNode.connect(this.track1DistanceGain);
        
        // チャンネル分離
        const splitter = this.audioContext.createChannelSplitter(2);
        this.track1DistanceGain.connect(splitter);
        
        // ドライ信号の処理
        // 左チャンネル経路
        splitter.connect(this.track1LeftVolume, 0);
        this.track1LeftVolume.connect(this.track1DryGainLeft);
        // 左チャンネルを左右両方のパンニングノードに接続
        this.track1DryGainLeft.connect(this.track1PanLeft);
        this.track1DryGainLeft.connect(this.track1PanRight);
        
        // 右チャンネル経路
        splitter.connect(this.track1RightVolume, 1);
        this.track1RightVolume.connect(this.track1DryGainRight);
        // 右チャンネルも左右両方のパンニングノードに接続
        this.track1DryGainRight.connect(this.track1PanLeft);
        this.track1DryGainRight.connect(this.track1PanRight);
        
        // 残響経路（距離減衰後の信号から）
        this.track1DistanceGain.connect(this.track1Reverb);
        this.track1Reverb.connect(this.track1ReverbGain);
        
        // 残響信号もチャンネル分離してパンニング処理を経由
        const reverbSplitter = this.audioContext.createChannelSplitter(2);
        this.track1ReverbGain.connect(reverbSplitter);
        
        // 残響の左チャンネルを左右両方にパンニング
        reverbSplitter.connect(this.track1ReverbPanLeft, 0);
        reverbSplitter.connect(this.track1ReverbPanRight, 0);
        
        // 残響の右チャンネルを左右両方にパンニング
        reverbSplitter.connect(this.track1ReverbPanLeft, 1);
        reverbSplitter.connect(this.track1ReverbPanRight, 1);
        
        // ドライ信号と残響信号をミックス（左出力）
        const leftMerger = this.audioContext.createChannelMerger(2);
        this.track1PanLeft.connect(leftMerger, 0, 0);
        this.track1ReverbPanLeft.connect(leftMerger, 0, 0);
        leftMerger.connect(outputNode, 0, 0);
        
        // ドライ信号と残響信号をミックス（右出力）
        const rightMerger = this.audioContext.createChannelMerger(2);
        this.track1PanRight.connect(rightMerger, 0, 0);
        this.track1ReverbPanRight.connect(rightMerger, 0, 0);
        rightMerger.connect(outputNode, 0, 1);
        
        // モノラル化経路（mono-panモード用、未使用だが接続は維持）
        splitter.connect(this.track1MonoMerger, 0, 0);
        splitter.connect(this.track1MonoMerger, 1, 0);
    }
    
    // トラック2のオーディオノードを接続
    connectTrack2(inputNode, outputNode) {
        if (!inputNode || !outputNode) return;
        
        // 既存の接続を切断（重複接続を防ぐ）
        this.disconnectTrack2();
        
        // 距離減衰を最初に適用
        inputNode.connect(this.track2DistanceGain);
        
        // チャンネル分離
        const splitter = this.audioContext.createChannelSplitter(2);
        this.track2DistanceGain.connect(splitter);
        
        // ドライ信号の処理
        // 左チャンネル経路
        splitter.connect(this.track2LeftVolume, 0);
        this.track2LeftVolume.connect(this.track2DryGainLeft);
        // 左チャンネルを左右両方のパンニングノードに接続
        this.track2DryGainLeft.connect(this.track2PanLeft);
        this.track2DryGainLeft.connect(this.track2PanRight);
        
        // 右チャンネル経路
        splitter.connect(this.track2RightVolume, 1);
        this.track2RightVolume.connect(this.track2DryGainRight);
        // 右チャンネルも左右両方のパンニングノードに接続
        this.track2DryGainRight.connect(this.track2PanLeft);
        this.track2DryGainRight.connect(this.track2PanRight);
        
        // 残響経路（距離減衰後の信号から）
        this.track2DistanceGain.connect(this.track2Reverb);
        this.track2Reverb.connect(this.track2ReverbGain);
        
        // 残響信号もチャンネル分離してパンニング処理を経由
        const reverbSplitter = this.audioContext.createChannelSplitter(2);
        this.track2ReverbGain.connect(reverbSplitter);
        
        // 残響の左チャンネルを左右両方にパンニング
        reverbSplitter.connect(this.track2ReverbPanLeft, 0);
        reverbSplitter.connect(this.track2ReverbPanRight, 0);
        
        // 残響の右チャンネルを左右両方にパンニング
        reverbSplitter.connect(this.track2ReverbPanLeft, 1);
        reverbSplitter.connect(this.track2ReverbPanRight, 1);
        
        // ドライ信号と残響信号をミックス（左出力）
        const leftMerger = this.audioContext.createChannelMerger(2);
        this.track2PanLeft.connect(leftMerger, 0, 0);
        this.track2ReverbPanLeft.connect(leftMerger, 0, 0);
        leftMerger.connect(outputNode, 0, 0);
        
        // ドライ信号と残響信号をミックス（右出力）
        const rightMerger = this.audioContext.createChannelMerger(2);
        this.track2PanRight.connect(rightMerger, 0, 0);
        this.track2ReverbPanRight.connect(rightMerger, 0, 0);
        rightMerger.connect(outputNode, 0, 1);
        
        // モノラル化経路（mono-panモード用、未使用だが接続は維持）
        splitter.connect(this.track2MonoMerger, 0, 0);
        splitter.connect(this.track2MonoMerger, 1, 0);
    }
    
    // トラック1の接続を切断
    disconnectTrack1() {
        try {
            if (this.track1DistanceGain) {
                this.track1DistanceGain.disconnect();
            }
            if (this.track1PanLeft) {
                this.track1PanLeft.disconnect();
            }
            if (this.track1PanRight) {
                this.track1PanRight.disconnect();
            }
            if (this.track1LeftVolume) {
                this.track1LeftVolume.disconnect();
            }
            if (this.track1RightVolume) {
                this.track1RightVolume.disconnect();
            }
            if (this.track1DryGainLeft) {
                this.track1DryGainLeft.disconnect();
            }
            if (this.track1DryGainRight) {
                this.track1DryGainRight.disconnect();
            }
            if (this.track1ReverbPanLeft) {
                this.track1ReverbPanLeft.disconnect();
            }
            if (this.track1ReverbPanRight) {
                this.track1ReverbPanRight.disconnect();
            }
            if (this.track1ReverbGain) {
                this.track1ReverbGain.disconnect();
            }
            if (this.track1Reverb) {
                this.track1Reverb.disconnect();
            }
        } catch (e) {
            // 既に切断されている場合など
        }
    }
    
    // トラック2の接続を切断
    disconnectTrack2() {
        try {
            if (this.track2DistanceGain) {
                this.track2DistanceGain.disconnect();
            }
            if (this.track2PanLeft) {
                this.track2PanLeft.disconnect();
            }
            if (this.track2PanRight) {
                this.track2PanRight.disconnect();
            }
            if (this.track2LeftVolume) {
                this.track2LeftVolume.disconnect();
            }
            if (this.track2RightVolume) {
                this.track2RightVolume.disconnect();
            }
            if (this.track2DryGainLeft) {
                this.track2DryGainLeft.disconnect();
            }
            if (this.track2DryGainRight) {
                this.track2DryGainRight.disconnect();
            }
            if (this.track2ReverbPanLeft) {
                this.track2ReverbPanLeft.disconnect();
            }
            if (this.track2ReverbPanRight) {
                this.track2ReverbPanRight.disconnect();
            }
            if (this.track2ReverbGain) {
                this.track2ReverbGain.disconnect();
            }
            if (this.track2Reverb) {
                this.track2Reverb.disconnect();
            }
        } catch (e) {
            // 既に切断されている場合など
        }
    }
}
