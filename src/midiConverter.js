// MIDI変換クラス（Basic Pitchを使用）
class MidiConverter {
    constructor() {
        this.basicPitch = null;
        this.isInitializing = false;
    }

    // Basic Pitchモデルの初期化
    async initialize() {
        if (this.basicPitch) {
            return; // 既に初期化済み
        }

        if (this.isInitializing) {
            // 初期化中の場合は待機
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.basicPitch) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }

        this.isInitializing = true;

        try {
            // TensorFlow.jsをインポート（Basic Pitchが依存している）
            await import('@tensorflow/tfjs');
            
            // Basic Pitchをインポート
            const { BasicPitch, outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime } = await import('@spotify/basic-pitch');
            
            // 関数を保存
            this.outputToNotesPoly = outputToNotesPoly;
            this.addPitchBendsToNoteEvents = addPitchBendsToNoteEvents;
            this.noteFramesToTime = noteFramesToTime;
            
            // モデルパスを指定（publicディレクトリにコピーしたモデルを使用）
            // Viteのbaseパスを考慮して動的にパスを解決
            // import.meta.env.BASE_URLは通常 '/' または '/Audio-to-midi/' のような値
            const basePath = import.meta.env.BASE_URL || '/';
            // basePathが '/' で終わっている場合はそのまま、そうでなければ '/' を追加
            const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
            const modelPath = `${normalizedBase}model/model.json`;
            
            // Basic Pitchインスタンスを作成（モデルパスを指定）
            this.basicPitch = new BasicPitch(modelPath);
            
            this.isInitializing = false;
        } catch (error) {
            this.isInitializing = false;
            console.error('Basic Pitch初期化エラー詳細:', error);
            throw new Error(`Basic Pitchの初期化に失敗しました: ${error.message}`);
        }
    }

    // AudioBufferからMIDIノートイベントに変換
    async convertAudioToMidiNotes(audioBuffer, audioProcessor, onProgress = null) {
        if (!this.basicPitch) {
            await this.initialize();
        }

        // Basic Pitchは22050Hz、モノラルを要求するため、前処理が必要
        const targetSampleRate = 22050;
        let processedBuffer = audioBuffer;
        
        if (!audioProcessor) {
            throw new Error('AudioProcessorが必要です');
        }

        // モノラルに変換
        processedBuffer = audioProcessor.convertToMono(processedBuffer);
        
        // 22050Hzにリサンプリング
        if (processedBuffer.sampleRate !== targetSampleRate) {
            processedBuffer = audioProcessor.resample(processedBuffer, targetSampleRate);
        }

        const frames = [];
        const onsets = [];
        const contours = [];

        try {
            // Basic Pitchでオーディオを解析
            await this.basicPitch.evaluateModel(
                processedBuffer,
                (f, o, c) => {
                    // フレームごとのピッチ、オンセット、コントゥアを収集
                    frames.push(...f);
                    onsets.push(...o);
                    contours.push(...c);
                },
                (progress) => {
                    // 進捗コールバック
                    if (onProgress) {
                        onProgress(progress);
                    }
                }
            );

            // ノートイベントに変換
            const rawNotes = this.outputToNotesPoly(
                frames,
                onsets,
                0.25, // onsetThreshold
                0.25, // offsetThreshold
                5     // minNoteLength
            );

            // ピッチベンドを追加
            const notesWithBends = this.addPitchBendsToNoteEvents(
                contours,
                rawNotes
            );

            // フレーム単位から時間単位に変換
            const timedNotes = this.noteFramesToTime(notesWithBends);

            return timedNotes;
        } catch (error) {
            throw new Error(`MIDI変換エラー: ${error.message}`);
        }
    }

    // MIDIノートからMIDIファイル（バイナリ）を生成
    // tempoBPM: テンポ（BPM、デフォルトは120）
    generateMidiFile(notes, tempoBPM = 120) {
        if (!notes || notes.length === 0) {
            // ノートがない場合は空のMIDIファイルを返す
            return this.generateEmptyMidiFile();
        }

        // MIDIファイルの構造を構築
        // フォーマット: 1 (シングルトラック)
        // 分解能: 480 ticks/quarter note
        const ticksPerQuarter = 480;
        const tempo = Math.max(20, Math.min(300, tempoBPM)); // BPMを20-300の範囲に制限

        // ノートをソート（時間順）
        // Basic Pitchのノートは startTimeSeconds プロパティを持つ
        const sortedNotes = [...notes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

        // トラックイベントを構築
        const trackEvents = [];

        // テンポ設定
        // BPMからmicroseconds per quarter noteへの変換: 60,000,000 / BPM
        // 小数点を含むBPMをサポートするため、Math.roundを使用（より正確な丸め）
        const microsecondsPerQuarter = Math.round(60000000 / tempo);
        // 範囲チェック（MIDI仕様: 1 ～ 16,777,215）
        const clampedMicroseconds = Math.max(1, Math.min(16777215, microsecondsPerQuarter));
        // 3バイトで表現（24ビット）
        const tempoData = [
            (clampedMicroseconds >> 16) & 0xFF, // 上位8ビット
            (clampedMicroseconds >> 8) & 0xFF,  // 中位8ビット
            clampedMicroseconds & 0xFF           // 下位8ビット
        ];
        
        trackEvents.push({
            deltaTime: 0,
            type: 'meta',
            metaType: 0x51, // Set Tempo
            data: tempoData
        });

        // 各ノートをMIDIイベントに変換
        // Basic Pitchのノートオブジェクトのプロパティ:
        // - pitchMidi: MIDIノート番号 (0-127)
        // - startTimeSeconds: 開始時間（秒）
        // - durationSeconds: 継続時間（秒）
        // - amplitude: 振幅（0-1、ベロシティに変換）
        let lastTime = 0;
        for (const note of sortedNotes) {
            const startTick = Math.floor((note.startTimeSeconds * 60 * ticksPerQuarter) / tempo);
            const durationTick = Math.floor((note.durationSeconds * 60 * ticksPerQuarter) / tempo);
            
            const deltaTime = Math.max(0, startTick - lastTime);

            // Note On
            const pitchMidi = Math.round(note.pitchMidi);
            const velocity = Math.min(127, Math.max(1, Math.round(note.amplitude * 127)));
            
            trackEvents.push({
                deltaTime,
                type: 'noteOn',
                channel: 0,
                note: pitchMidi, // MIDIノート番号 (0-127)
                velocity: velocity
            });

            // Note Off（durationTick後）
            const noteOffTick = startTick + durationTick;
            trackEvents.push({
                deltaTime: durationTick,
                type: 'noteOff',
                channel: 0,
                note: pitchMidi,
                velocity: 0
            });

            lastTime = noteOffTick;
        }

        // End of Track
        trackEvents.push({
            deltaTime: 0,
            type: 'meta',
            metaType: 0x2F, // End of Track
            data: []
        });

        // MIDIファイルをバイナリに変換
        return this.buildMidiFile(trackEvents, ticksPerQuarter);
    }

    // 空のMIDIファイルを生成
    generateEmptyMidiFile() {
        const midiHeader = new Uint8Array([
            0x4D, 0x54, 0x68, 0x64, // "MThd"
            0x00, 0x00, 0x00, 0x06, // ヘッダー長
            0x00, 0x01,             // フォーマット（シングルトラック）
            0x00, 0x01,             // トラック数
            0x01, 0xE0              // 分解能（480 ticks/quarter note）
        ]);

        const trackChunk = new Uint8Array([
            0x4D, 0x54, 0x72, 0x6B, // "MTrk"
            0x00, 0x00, 0x00, 0x04, // トラック長
            0x00, 0xFF, 0x2F, 0x00  // エンドオブトラック
        ]);

        const midiData = new Uint8Array(midiHeader.length + trackChunk.length);
        midiData.set(midiHeader, 0);
        midiData.set(trackChunk, midiHeader.length);

        return midiData;
    }

    // MIDIイベントからMIDIファイルを構築
    buildMidiFile(trackEvents, ticksPerQuarter) {
        // MIDIヘッダー
        const midiHeader = new Uint8Array([
            0x4D, 0x54, 0x68, 0x64, // "MThd"
            0x00, 0x00, 0x00, 0x06, // ヘッダー長
            0x00, 0x01,             // フォーマット（シングルトラック）
            0x00, 0x01,             // トラック数
            (ticksPerQuarter >> 8) & 0xFF, // 分解能（上位バイト）
            ticksPerQuarter & 0xFF          // 分解能（下位バイト）
        ]);

        // トラックデータを構築
        const trackData = [];
        let lastEventTime = 0;

        for (const event of trackEvents) {
            // デルタタイムを可変長でエンコード
            const deltaTime = event.deltaTime;
            if (deltaTime < 128) {
                trackData.push(deltaTime);
            } else if (deltaTime < 16384) {
                trackData.push(0x80 | ((deltaTime >> 7) & 0x7F));
                trackData.push(deltaTime & 0x7F);
            } else {
                // より大きな値は3バイトまたは4バイトでエンコード
                let value = deltaTime;
                const bytes = [];
                while (value > 0) {
                    bytes.push(value & 0x7F);
                    value >>= 7;
                }
                for (let i = bytes.length - 1; i >= 0; i--) {
                    trackData.push((i === 0 ? 0x00 : 0x80) | bytes[i]);
                }
            }

            // イベントタイプに応じてデータを追加
            if (event.type === 'noteOn') {
                trackData.push(0x90 | event.channel); // Note On
                trackData.push(event.note);
                trackData.push(event.velocity);
            } else if (event.type === 'noteOff') {
                trackData.push(0x80 | event.channel); // Note Off
                trackData.push(event.note);
                trackData.push(0x00); // velocity 0
            } else if (event.type === 'meta') {
                trackData.push(0xFF); // Meta Event
                trackData.push(event.metaType);
                if (event.data && event.data.length > 0) {
                    trackData.push(event.data.length);
                    trackData.push(...event.data);
                } else {
                    trackData.push(0x00);
                }
            }
        }

        // トラック長を計算
        const trackLength = trackData.length;
        const trackChunk = new Uint8Array(8 + trackLength);
        
        // "MTrk"ヘッダー
        trackChunk[0] = 0x4D; // 'M'
        trackChunk[1] = 0x54; // 'T'
        trackChunk[2] = 0x72; // 'r'
        trackChunk[3] = 0x6B; // 'k'
        
        // トラック長（4バイト）
        trackChunk[4] = (trackLength >> 24) & 0xFF;
        trackChunk[5] = (trackLength >> 16) & 0xFF;
        trackChunk[6] = (trackLength >> 8) & 0xFF;
        trackChunk[7] = trackLength & 0xFF;
        
        // トラックデータ
        trackChunk.set(trackData, 8);

        // ヘッダーとトラックを結合
        const midiFile = new Uint8Array(midiHeader.length + trackChunk.length);
        midiFile.set(midiHeader, 0);
        midiFile.set(trackChunk, midiHeader.length);

        return midiFile;
    }
}

export { MidiConverter };
