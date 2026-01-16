// UI制御クラス
class UIController {
    constructor(app) {
        this.app = app;
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.fileInput = document.getElementById('file-input');
        this.playBtn = document.getElementById('play-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.exportMidiBtn = document.getElementById('export-midi-btn');
        this.clearAudioBtn = document.getElementById('clear-audio');
        this.status = document.getElementById('status');
        this.dropZone = document.getElementById('drop-zone');
        this.dropOverlay = document.getElementById('drop-overlay');
        this.waveformCanvas = document.getElementById('waveform-canvas');
    }

    setupEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.playBtn.addEventListener('click', () => this.playPreview());
        this.stopBtn.addEventListener('click', () => this.stopPreview());
        this.exportMidiBtn.addEventListener('click', () => this.exportToMidi());
        
        if (this.clearAudioBtn) {
            this.clearAudioBtn.addEventListener('click', () => this.clearAudio());
        }

        // ドロップオーバーレイボタン
        if (this.dropOverlay) {
            this.dropOverlay.addEventListener('click', () => {
                if (this.fileInput) {
                    this.fileInput.click();
                }
            });
        }

        // ドロップゾーン
        if (this.dropZone) {
            ['dragenter', 'dragover'].forEach(evt => {
                this.dropZone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach(evt => {
                this.dropZone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.remove('dragover');
                });
            });

            this.dropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    // 同じファイルを再度読み込めるようにリセット
                    this.fileInput.value = '';
                    this.loadFile(files[0]);
                }
            });
        }

        // 波形上クリックによるシーク
        if (this.waveformCanvas) {
            this.waveformCanvas.addEventListener('click', (e) => {
                if (!this.app.originalBuffer || !this.app.audioPlayer || !this.app.audioPlayer.isPlaying) return;

                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const width = rect.width;
                if (width <= 0) return;

                const ratio = Math.min(1, Math.max(0, x / width));
                const duration = this.app.originalBuffer.duration;
                const targetTime = duration * ratio;

                this.app.seekTo(targetTime);
            });
        }

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            if (isInput) {
                return;
            }
            
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                this.togglePlayback();
            }
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        await this.loadFile(file);
    }

    async loadFile(file) {
        if (!file) return;

        this.showStatus('ファイルを読み込み中...', 'info');

        try {
            // 再生中なら停止してから読み込み
            if (this.app.audioPlayer && this.app.audioPlayer.isPlaying) {
                this.app.audioPlayer.stopPreview();
                this.app.stopPlaybackAnimation();
                this.playBtn.disabled = false;
                this.stopBtn.disabled = true;
            }

            // AudioContextがまだ作成されていない場合は作成
            if (!this.app.audioContext) {
                this.app.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.app.audioProcessor = new AudioProcessor(this.app.audioContext);
                this.app.audioPlayer = new AudioPlayer(this.app.audioContext);
            }

            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.app.audioContext.decodeAudioData(arrayBuffer);
            
            // バッファを設定
            this.app.originalBuffer = audioBuffer;
            
            // 波形を表示
            if (this.app.originalWaveformViewer) {
                this.app.originalWaveformViewer.setAudioBuffer(audioBuffer);
                this.app.useRangeStart = 0;
                this.app.useRangeEnd = audioBuffer.duration;
                this.app.originalWaveformViewer.setRange(this.app.useRangeStart, this.app.useRangeEnd);
                if (this.dropOverlay) {
                    this.dropOverlay.classList.add('hidden');
                }
            }
            
            this.app.drawWaveform();
            this.enableControls();
            this.showStatus('ファイルの読み込みが完了しました', 'success');
        } catch (error) {
            this.showStatus(`エラー: ${error.message}`, 'error');
            console.error(error);
        }
    }

    togglePlayback() {
        if (!this.app.originalBuffer || !this.app.audioPlayer) return;
        
        if (this.app.audioPlayer.isPlaying) {
            this.stopPreview();
        } else {
            this.playPreview();
        }
    }

    async playPreview() {
        if (!this.app.originalBuffer || !this.app.audioPlayer) return;

        try {
            this.playBtn.disabled = true;
            this.stopBtn.disabled = false;

            // 選択範囲のバッファを取得
            const rangeBuffer = this.app.getSelectedRangeBuffer();
            if (!rangeBuffer) {
                this.showStatus('選択範囲が無効です', 'error');
                this.playBtn.disabled = false;
                this.stopBtn.disabled = true;
                return;
            }

            // 再生開始
            this.app.audioPlayer.playPreviewWithBuffer(rangeBuffer, 0);
            this.app.startPlaybackAnimation();
            
            this.showStatus('再生中...', 'info');
        } catch (error) {
            this.showStatus('再生エラー: ' + error.message, 'error');
            console.error(error);
            this.playBtn.disabled = false;
            this.stopBtn.disabled = true;
        }
    }

    stopPreview() {
        if (this.app.audioPlayer) {
            this.app.audioPlayer.stopPreview();
        }
        this.app.stopPlaybackAnimation();
        this.playBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.showStatus('停止しました', 'info');
    }

    clearAudio() {
        // 再生中なら停止
        if (this.app.audioPlayer && this.app.audioPlayer.isPlaying) {
            this.app.audioPlayer.stopPreview();
            this.app.stopPlaybackAnimation();
            this.playBtn.disabled = false;
            this.stopBtn.disabled = true;
        }

        // バッファをクリア
        this.app.originalBuffer = null;
        this.app.useRangeStart = 0;
        this.app.useRangeEnd = 0;
        
        // 波形ビューアをクリア
        if (this.app.originalWaveformViewer) {
            this.app.originalWaveformViewer.setAudioBuffer(null);
        }
        
        // ドロップオーバーレイを表示
        if (this.dropOverlay) {
            this.dropOverlay.classList.remove('hidden');
        }
        
        // ファイル入力もリセット
        if (this.fileInput) {
            this.fileInput.value = '';
        }

        this.app.drawWaveform();
        this.disableControls();
        this.showStatus('オーディオをクリアしました', 'info');
    }

    async exportToMidi() {
        if (!this.app.originalBuffer) {
            this.showStatus('オーディオファイルが読み込まれていません', 'error');
            return;
        }

        const range = this.app.getSelectedRange();
        if (!range) {
            this.showStatus('選択範囲が無効です', 'error');
            return;
        }

        try {
            this.showStatus('MIDIファイルを生成中...', 'info');
            
            // 選択範囲のバッファを取得
            const rangeBuffer = this.app.getSelectedRangeBuffer();
            if (!rangeBuffer) {
                this.showStatus('選択範囲のバッファを取得できませんでした', 'error');
                return;
            }

            // MIDI変換（TODO: 実際の変換ロジックを実装）
            // 現在はスタブとして、簡単なMIDIファイルを生成
            const midiData = this.generateMidiStub(rangeBuffer);
            
            // MIDIファイルをダウンロード
            const blob = new Blob([midiData], { type: 'audio/midi' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'output.mid';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showStatus('MIDIファイルを出力しました', 'success');
        } catch (error) {
            this.showStatus('MIDI出力エラー: ' + error.message, 'error');
            console.error(error);
        }
    }

    // MIDI生成のスタブ（後で実装予定）
    generateMidiStub(audioBuffer) {
        // 簡易的なMIDIファイル（空のトラック）を生成
        // TODO: 実際のオーディオからMIDIへの変換ロジックを実装
        
        // MIDIファイルヘッダー（最小限の構造）
        const midiHeader = new Uint8Array([
            0x4D, 0x54, 0x68, 0x64, // "MThd"
            0x00, 0x00, 0x00, 0x06, // ヘッダー長
            0x00, 0x01,             // フォーマット（シングルトラック）
            0x00, 0x01,             // トラック数
            0x00, 0xC0              // 分解能（192 ticks/quarter note）
        ]);

        // トラックチャンクヘッダー
        const trackChunk = new Uint8Array([
            0x4D, 0x54, 0x72, 0x6B, // "MTrk"
            0x00, 0x00, 0x00, 0x04, // トラック長
            0x00, 0xFF, 0x2F, 0x00  // エンドオブトラック
        ]);

        // 結合
        const midiData = new Uint8Array(midiHeader.length + trackChunk.length);
        midiData.set(midiHeader, 0);
        midiData.set(trackChunk, midiHeader.length);

        return midiData;
    }

    enableControls() {
        this.playBtn.disabled = false;
        this.exportMidiBtn.disabled = false;
        if (this.clearAudioBtn) {
            this.clearAudioBtn.disabled = false;
        }
    }

    disableControls() {
        this.playBtn.disabled = true;
        this.stopBtn.disabled = true;
        this.exportMidiBtn.disabled = true;
        if (this.clearAudioBtn) {
            this.clearAudioBtn.disabled = true;
        }
    }

    showStatus(message, type = 'info') {
        if (this.status) {
            this.status.textContent = message;
            this.status.className = 'status ' + type;
        }
    }
}
