// オーディオ再生クラス
class AudioPlayer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.sourceNodes = [];
        this.startTime = null;
        this.loopDuration = 0;
        this.gainNode1 = null;
        this.gainNode2 = null;
        this.analyser1 = null;
        this.analyser2 = null;
        this.isPlaying = false;
        this.track1Processor = new Track1Processor(audioContext);
        this.track2Processor = new Track2Processor(audioContext);

        // マスターバス用 3-Band MultiBand Processor
        this.multibandCompProcessor = null;
        this.masterBus = null;
        this.masterAnalyser = null; // マスターバス用のアナライザー（スペクトラム表示用）
        this.masterChannelSplitter = null; // チャンネル分離用
        this.masterChannelAnalysers = []; // 各チャンネル用のアナライザー
        this.maxChannels = 2; // 最大チャンネル数
        
        // 空間デザイン用プロセッサー
        this.spatialDesignProcessor = null;
        
        // 各トラック用のチャンネル分離アナライザー（L/R表示用）
        this.track1ChannelSplitter = null;
        this.track1ChannelAnalysers = []; // [L, R]
        this.track2ChannelSplitter = null;
        this.track2ChannelAnalysers = []; // [L, R]
    }

    // ループメーカー側からマルチバンドプロセッサーを受け取る
    setMultiBandProcessor(processor) {
        this.multibandCompProcessor = processor;
    }
    
    // ループメーカー側から空間デザインプロセッサーを受け取る
    setSpatialDesignProcessor(processor) {
        this.spatialDesignProcessor = processor;
    }

    // トラック1と2の加工後のバッファを再生（トラック1の加工後の範囲でループ）
    // offsetSeconds: 再生開始位置（秒）
    playPreviewWithBuffers(track1Buffer, track2Buffer, offsetSeconds = 0) {
        if (!track1Buffer || !track2Buffer || this.isPlaying) return false;

        // 既存の接続を確実にクリーンアップ
        this.stopPreview();

        try {
            // トラック1の加工後のバッファの長さをループ期間として使用
            const loopDuration = track1Buffer.duration;

            // オフセットをループ長の範囲に収める
            let offset = offsetSeconds % loopDuration;
            if (offset < 0) {
                offset += loopDuration;
            }
            
            // トラック1: 加工後のバッファをループ再生（トラック1の加工後の範囲でループ）
            const source1 = this.audioContext.createBufferSource();
            this.gainNode1 = this.audioContext.createGain();
            this.analyser1 = this.audioContext.createAnalyser();
            this.analyser1.fftSize = 256;
            this.analyser1.smoothingTimeConstant = 0.8;
            
            source1.buffer = track1Buffer;
            source1.loop = true;
            source1.loopStart = 0;
            source1.loopEnd = loopDuration; // トラック1の加工後の範囲でループ
            
            // トラック2: 加工後のバッファをループ再生（トラック1と同じ範囲でループ）
            const source2 = this.audioContext.createBufferSource();
            source2.buffer = track2Buffer;
            source2.loop = true;
            source2.loopStart = 0;
            source2.loopEnd = loopDuration; // トラック1と同じ範囲でループ

            // マスターバス（2トラックをまとめて3バンド処理）
            this.masterBus = this.audioContext.createGain();
            
            // マスターバス用のアナライザー（スペクトラム表示用）
            this.masterAnalyser = this.audioContext.createAnalyser();
            this.masterAnalyser.fftSize = 2048; // より高解像度なスペクトラム分析
            this.masterAnalyser.smoothingTimeConstant = 0.8;

            // 空間デザイン処理を適用するかどうか
            if (this.spatialDesignProcessor && 
                this.spatialDesignProcessor.connectTrack1 && 
                this.spatialDesignProcessor.connectTrack2) {
                // 空間デザイン処理を適用
                // 各トラック用のステレオ出力ノード（ChannelMerger）を作成
                const track1Output = this.audioContext.createChannelMerger(2);
                const track2Output = this.audioContext.createChannelMerger(2);
                
                // トラック1: ソース -> Gain -> 空間デザイン -> 出力マージャー -> マスターバス
                this.gainNode1 = this.audioContext.createGain();
                this.analyser1 = this.audioContext.createAnalyser();
                this.analyser1.fftSize = 256;
                this.analyser1.smoothingTimeConstant = 0.8;
                
                source1.connect(this.gainNode1);
                // レベルメーター用（空間デザイン処理前の信号）
                this.gainNode1.connect(this.analyser1);
                
                // トラック1用のチャンネル分離アナライザー（L/R表示用）
                this.track1ChannelSplitter = this.audioContext.createChannelSplitter(2);
                this.gainNode1.connect(this.track1ChannelSplitter);
                this.track1ChannelAnalysers = [];
                for (let i = 0; i < 2; i++) {
                    const analyser = this.audioContext.createAnalyser();
                    analyser.fftSize = 256;
                    analyser.smoothingTimeConstant = 0.8;
                    this.track1ChannelSplitter.connect(analyser, i);
                    this.track1ChannelAnalysers.push(analyser);
                }
                
                // 空間デザイン処理を接続（出力はChannelMerger）
                this.spatialDesignProcessor.connectTrack1(this.gainNode1, track1Output);
                track1Output.connect(this.masterBus);
                
                // トラック2: ソース -> Gain -> 空間デザイン -> 出力マージャー -> マスターバス
                this.gainNode2 = this.audioContext.createGain();
                this.analyser2 = this.audioContext.createAnalyser();
                this.analyser2.fftSize = 256;
                this.analyser2.smoothingTimeConstant = 0.8;
                
                source2.connect(this.gainNode2);
                // レベルメーター用（空間デザイン処理前の信号）
                this.gainNode2.connect(this.analyser2);
                
                // トラック2用のチャンネル分離アナライザー（L/R表示用）
                this.track2ChannelSplitter = this.audioContext.createChannelSplitter(2);
                this.gainNode2.connect(this.track2ChannelSplitter);
                this.track2ChannelAnalysers = [];
                for (let i = 0; i < 2; i++) {
                    const analyser = this.audioContext.createAnalyser();
                    analyser.fftSize = 256;
                    analyser.smoothingTimeConstant = 0.8;
                    this.track2ChannelSplitter.connect(analyser, i);
                    this.track2ChannelAnalysers.push(analyser);
                }
                
                // 空間デザイン処理を接続（出力はChannelMerger）
                this.spatialDesignProcessor.connectTrack2(this.gainNode2, track2Output);
                track2Output.connect(this.masterBus);
            } else {
                // 空間デザイン処理なし（従来の接続）
                this.gainNode1 = this.audioContext.createGain();
                this.analyser1 = this.audioContext.createAnalyser();
                this.analyser1.fftSize = 256;
                this.analyser1.smoothingTimeConstant = 0.8;
                
                source1.connect(this.gainNode1);
                this.gainNode1.connect(this.analyser1);
                
                // トラック1用のチャンネル分離アナライザー（L/R表示用）
                this.track1ChannelSplitter = this.audioContext.createChannelSplitter(2);
                this.gainNode1.connect(this.track1ChannelSplitter);
                this.track1ChannelAnalysers = [];
                for (let i = 0; i < 2; i++) {
                    const analyser = this.audioContext.createAnalyser();
                    analyser.fftSize = 256;
                    analyser.smoothingTimeConstant = 0.8;
                    this.track1ChannelSplitter.connect(analyser, i);
                    this.track1ChannelAnalysers.push(analyser);
                }
                
                this.gainNode2 = this.audioContext.createGain();
                this.analyser2 = this.audioContext.createAnalyser();
                this.analyser2.fftSize = 256;
                this.analyser2.smoothingTimeConstant = 0.8;
                
                source2.connect(this.gainNode2);
                this.gainNode2.connect(this.analyser2);
                
                // トラック2用のチャンネル分離アナライザー（L/R表示用）
                this.track2ChannelSplitter = this.audioContext.createChannelSplitter(2);
                this.gainNode2.connect(this.track2ChannelSplitter);
                this.track2ChannelAnalysers = [];
                for (let i = 0; i < 2; i++) {
                    const analyser = this.audioContext.createAnalyser();
                    analyser.fftSize = 256;
                    analyser.smoothingTimeConstant = 0.8;
                    this.track2ChannelSplitter.connect(analyser, i);
                    this.track2ChannelAnalysers.push(analyser);
                }
                
                // 各トラックの出力をマスターバスへ
                this.gainNode1.connect(this.masterBus);
                this.gainNode2.connect(this.masterBus);
            }
            
            // 最大チャンネル数を取得（トラック1とトラック2の最大値）
            const channels1 = track1Buffer ? track1Buffer.numberOfChannels : 1;
            const channels2 = track2Buffer ? track2Buffer.numberOfChannels : 1;
            this.maxChannels = Math.max(channels1, channels2);
            
            // チャンネル分離用のSplitterと各チャンネル用のアナライザーを作成
            this.masterChannelSplitter = this.audioContext.createChannelSplitter(this.maxChannels);
            this.masterChannelAnalysers = [];
            for (let i = 0; i < this.maxChannels; i++) {
                const analyser = this.audioContext.createAnalyser();
                analyser.fftSize = 2048; // マスターバスと同じ高解像度に設定
                analyser.smoothingTimeConstant = 0.8;
                this.masterChannelAnalysers.push(analyser);
            }

            if (this.multibandCompProcessor &&
                this.multibandCompProcessor.getInputNode &&
                this.multibandCompProcessor.getOutputNode) {
                // masterBus -> MultiBand -> destination
                // 既存の接続を切断してから再接続（再生のたびに）
                const inputNode = this.multibandCompProcessor.getInputNode();
                const outputNode = this.multibandCompProcessor.getOutputNode();
                
                // 既存の接続を切断
                if (inputNode && inputNode.numberOfInputs > 0) {
                    // 入力ノードへの接続を切断（masterBusからの接続を解除）
                    // ただし、MultiBand内部の接続は維持
                }
                if (outputNode && outputNode.numberOfOutputs > 0) {
                    // 出力ノードからの接続を切断（destinationへの接続を解除）
                    outputNode.disconnect();
                }
                
                // 再接続
                this.masterBus.connect(inputNode);
                
                // MultiBand出力 -> チャンネル分離 -> 各チャンネルアナライザー
                outputNode.connect(this.masterChannelSplitter);
                for (let i = 0; i < this.maxChannels; i++) {
                    this.masterChannelSplitter.connect(this.masterChannelAnalysers[i], i);
                }
                
                // MultiBand出力 -> スペクトラム用アナライザー -> destination
                outputNode.connect(this.masterAnalyser);
                outputNode.connect(this.audioContext.destination);

                // MultiBand Compプロセッサのノードは sourceNodes に含めない
                // （これらは再利用されるため、切断しない）
                this.sourceNodes = [
                    source1,
                    source2,
                    this.gainNode1,
                    this.gainNode2,
                    this.analyser1,
                    this.analyser2,
                    this.masterBus,
                    this.masterAnalyser,
                    this.masterChannelSplitter,
                    ...this.masterChannelAnalysers,
                    this.track1ChannelSplitter,
                    ...this.track1ChannelAnalysers,
                    this.track2ChannelSplitter,
                    ...this.track2ChannelAnalysers
                ];
            } else {
                // マルチバンド未設定の場合は従来通り masterBus から直接出力
                // チャンネル分離とアナライザーを接続
                this.masterBus.connect(this.masterChannelSplitter);
                for (let i = 0; i < this.maxChannels; i++) {
                    this.masterChannelSplitter.connect(this.masterChannelAnalysers[i], i);
                }
                
                this.masterBus.connect(this.masterAnalyser);
                this.masterBus.connect(this.audioContext.destination);
                this.sourceNodes = [
                    source1,
                    source2,
                    this.gainNode1,
                    this.gainNode2,
                    this.analyser1,
                    this.analyser2,
                    this.masterBus,
                    this.masterAnalyser,
                    this.masterChannelSplitter,
                    ...this.masterChannelAnalysers,
                    this.track1ChannelSplitter,
                    ...this.track1ChannelAnalysers,
                    this.track2ChannelSplitter,
                    ...this.track2ChannelAnalysers
                ];
            }
            this.loopDuration = loopDuration;

            // 2トラックを同時に再生（オフセット位置から）
            const startAt = this.audioContext.currentTime;
            source1.start(startAt, offset);
            source2.start(startAt, offset);

            // 再生位置計算用の基準時刻（ループ位置 = currentTime - startTime）
            this.startTime = startAt - offset;
            this.isPlaying = true;
            return true;
        } catch (error) {
            console.error('再生エラー:', error);
            this.isPlaying = false;
            throw error;
        }
    }

    stopPreview() {
        this.sourceNodes.forEach(node => {
            try {
                if (node.stop) {
                    node.stop();
                }
                node.disconnect();
            } catch (e) {
                // 既に停止している場合など
            }
        });
        this.sourceNodes = [];
        
        // MultiBand Compプロセッサの出力ノードを切断
        // （入力ノードは masterBus が切断されることで自動的に切断される）
        if (this.multibandCompProcessor &&
            this.multibandCompProcessor.getOutputNode) {
            try {
                const outputNode = this.multibandCompProcessor.getOutputNode();
                if (outputNode) {
                    outputNode.disconnect();
                }
            } catch (e) {
                // 既に切断されている場合など
            }
        }
        
        this.gainNode1 = null;
        this.gainNode2 = null;
        this.analyser1 = null;
        this.analyser2 = null;
        this.masterBus = null;
        this.masterAnalyser = null;
        this.masterChannelSplitter = null;
        this.masterChannelAnalysers = [];
        this.maxChannels = 2;
        this.track1ChannelSplitter = null;
        this.track1ChannelAnalysers = [];
        this.track2ChannelSplitter = null;
        this.track2ChannelAnalysers = [];
        
        // 空間デザインプロセッサーの接続を切断
        if (this.spatialDesignProcessor) {
            if (this.spatialDesignProcessor.disconnectTrack1) {
                this.spatialDesignProcessor.disconnectTrack1();
            }
            if (this.spatialDesignProcessor.disconnectTrack2) {
                this.spatialDesignProcessor.disconnectTrack2();
            }
        }
        
        this.startTime = null;
        this.isPlaying = false;
    }
    
    // マスターバスの周波数スペクトラムデータを取得
    // channel: 'mix' (デフォルト), 'l' (左), 'r' (右)
    getFrequencyData(channel = 'mix') {
        let analyser = null;
        
        if (channel === 'mix') {
            analyser = this.masterAnalyser;
        } else if (channel === 'l' && this.masterChannelAnalysers && this.masterChannelAnalysers.length > 0) {
            analyser = this.masterChannelAnalysers[0];
        } else if (channel === 'r' && this.masterChannelAnalysers && this.masterChannelAnalysers.length > 1) {
            analyser = this.masterChannelAnalysers[1];
        } else {
            // フォールバック: チャンネルが存在しない場合はMixを使用
            analyser = this.masterAnalyser;
        }
        
        if (!analyser) return null;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        return {
            data: dataArray,
            sampleRate: this.audioContext.sampleRate,
            fftSize: analyser.fftSize
        };
    }
    
    /**
     * 加工後の時系列データを取得（波形表示用）
     * @returns {Array<Float32Array>} 各チャンネルの時系列データ
     */
    getTimeDomainData() {
        if (!this.masterChannelAnalysers || this.masterChannelAnalysers.length === 0) {
            return null;
        }
        
        const channels = [];
        for (let i = 0; i < this.masterChannelAnalysers.length; i++) {
            const analyser = this.masterChannelAnalysers[i];
            if (!analyser) {
                channels.push(new Float32Array(0));
                continue;
            }
            
            const bufferLength = analyser.fftSize;
            const dataArray = new Float32Array(bufferLength);
            analyser.getFloatTimeDomainData(dataArray);
            channels.push(dataArray);
        }
        
        return channels;
    }

    getLevel(trackNumber) {
        const analyser = trackNumber === 1 ? this.analyser1 : this.analyser2;
        if (!analyser) return 0;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // 平均音量を計算
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // 0-100の範囲に正規化
        return average / 255;
    }
    
    // トラックのチャンネル別レベルを取得
    // trackNumber: 1 or 2
    // channel: 'l' (左) or 'r' (右)
    getChannelLevel(trackNumber, channel) {
        const channelAnalysers = trackNumber === 1 ? this.track1ChannelAnalysers : this.track2ChannelAnalysers;
        if (!channelAnalysers || channelAnalysers.length < 2) return 0;
        
        const channelIndex = channel === 'l' ? 0 : 1;
        const analyser = channelAnalysers[channelIndex];
        if (!analyser) return 0;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // 平均音量を計算
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // 0-1の範囲に正規化
        return average / 255;
    }
    
    /**
     * 加工後のレベルをチャンネルごとに取得
     * @returns {Array<number>} 各チャンネルのレベル（0-1の範囲）
     */
    getProcessedLevels() {
        if (!this.masterChannelAnalysers || this.masterChannelAnalysers.length === 0) {
            return [];
        }
        
        const levels = [];
        for (let i = 0; i < this.masterChannelAnalysers.length; i++) {
            const analyser = this.masterChannelAnalysers[i];
            if (!analyser) {
                levels.push(0);
                continue;
            }
            
            // 時系列データを取得
            const bufferLength = analyser.fftSize;
            const dataArray = new Float32Array(bufferLength);
            analyser.getFloatTimeDomainData(dataArray);
            
            // RMS（実効値）を計算
            let sum = 0;
            for (let j = 0; j < dataArray.length; j++) {
                sum += dataArray[j] * dataArray[j];
            }
            const rms = Math.sqrt(sum / dataArray.length);
            
            levels.push(rms);
        }
        
        return levels;
    }
    
    /**
     * 最大チャンネル数を取得
     */
    getMaxChannels() {
        return this.maxChannels || 2;
    }

    setTrack1Mute(muted) {
        if (this.gainNode1) {
            this.gainNode1.gain.value = muted ? 0 : 1;
        }
    }

    setTrack2Mute(muted) {
        if (this.gainNode2) {
            this.gainNode2.gain.value = muted ? 0 : 1;
        }
    }

    getCurrentPlaybackTime() {
        if (!this.isPlaying || this.startTime === null || this.loopDuration === 0) {
            return null;
        }
        const elapsed = this.audioContext.currentTime - this.startTime;
        return elapsed % this.loopDuration;
    }
}

