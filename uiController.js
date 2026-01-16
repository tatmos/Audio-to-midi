// 上部UI処理クラス
class UIController {
    constructor(loopMaker) {
        this.loopMaker = loopMaker;
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.fileInput1 = document.getElementById('file-input-1');
        this.fileInput2 = document.getElementById('file-input-2');
        this.saveBtn = document.getElementById('save-btn');
        this.playBtn = document.getElementById('play-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.status = document.getElementById('status');
        this.muteTrack1Btn = document.getElementById('mute-track1');
        this.muteTrack2Btn = document.getElementById('mute-track2');
        this.dropZone1 = document.getElementById('original-drop-zone-1');
        this.dropZone2 = document.getElementById('original-drop-zone-2');
        this.dropOverlay1 = document.getElementById('drop-overlay-1');
        this.dropOverlay2 = document.getElementById('drop-overlay-2');
        this.waveformTrack1 = document.getElementById('waveform-track1');
        this.waveformTrack2 = document.getElementById('waveform-track2');
        this.filenameInput = document.getElementById('filename-input');
        this.overwriteDialog = document.getElementById('overwrite-dialog');
        this.overwriteFilename = document.getElementById('overwrite-filename');
        this.overwriteConfirmBtn = document.getElementById('overwrite-confirm');
        this.overwriteRenameBtn = document.getElementById('overwrite-rename');
        this.overwriteCancelBtn = document.getElementById('overwrite-cancel');
        this.clearOriginal1Btn = document.getElementById('clear-original-1');
        this.clearOriginal2Btn = document.getElementById('clear-original-2');
        this.addWaveform2Btn = document.getElementById('add-waveform-2-btn');
        this.originalWaveformContainer2 = document.getElementById('original-waveform-container-2');
        this.addWaveformContainer = document.querySelector('.add-waveform-container');
        this.addTrack2Btn = document.getElementById('add-track-2-btn');
        this.removeTrack2Btn = document.getElementById('remove-track-2-btn');
        this.trackContainer2 = document.getElementById('track-container-2');
        this.addTrackContainer = document.querySelector('.add-track-container');
        this.toggleSettingsTrack1Btn = document.getElementById('toggle-settings-track1');
        this.toggleSettingsTrack2Btn = document.getElementById('toggle-settings-track2');
        this.trackSettings1 = document.getElementById('track-settings-1');
        this.trackSettings2 = document.getElementById('track-settings-2');
        this.toggleSpatialDesignBtn = document.getElementById('toggle-spatial-design');
        this.spatialControls = document.getElementById('spatial-controls');
        
        // ミュート状態
        this.track1Muted = false;
        this.track2Muted = false;
        
        // 上書き確認ダイアログのイベントリスナー
        if (this.overwriteConfirmBtn) {
            this.overwriteConfirmBtn.addEventListener('click', () => this.handleOverwriteConfirm());
        }
        if (this.overwriteRenameBtn) {
            this.overwriteRenameBtn.addEventListener('click', () => this.handleOverwriteRename());
        }
        if (this.overwriteCancelBtn) {
            this.overwriteCancelBtn.addEventListener('click', () => this.handleOverwriteCancel());
        }
        
        // 初期状態でクリアボタンの有効/無効を設定
        this.updateClearButtonsState();
    }

    setupEventListeners() {
        this.fileInput1.addEventListener('change', (e) => this.handleFileUpload(e, 1));
        if (this.fileInput2) {
            this.fileInput2.addEventListener('change', (e) => this.handleFileUpload(e, 2));
        }
        this.saveBtn.addEventListener('click', () => this.saveFile());
        this.playBtn.addEventListener('click', () => this.playPreview());
        this.stopBtn.addEventListener('click', () => this.stopPreview());
        this.muteTrack1Btn.addEventListener('click', () => this.toggleMuteTrack1());
        if (this.muteTrack2Btn) {
            this.muteTrack2Btn.addEventListener('click', () => this.toggleMuteTrack2());
        }
        if (this.clearOriginal1Btn) {
            this.clearOriginal1Btn.addEventListener('click', () => this.clearOriginalWaveform(1));
        }
        if (this.clearOriginal2Btn) {
            this.clearOriginal2Btn.addEventListener('click', () => this.clearOriginalWaveform(2));
        }
        if (this.addWaveform2Btn) {
            this.addWaveform2Btn.addEventListener('click', () => this.addWaveform2());
        }
        if (this.addTrack2Btn) {
            this.addTrack2Btn.addEventListener('click', () => this.addTrack2());
        }
        if (this.removeTrack2Btn) {
            this.removeTrack2Btn.addEventListener('click', () => this.removeTrack2());
        }
        if (this.toggleSettingsTrack1Btn) {
            this.toggleSettingsTrack1Btn.addEventListener('click', () => this.toggleTrackSettings(1));
        }
        if (this.toggleSettingsTrack2Btn) {
            this.toggleSettingsTrack2Btn.addEventListener('click', () => this.toggleTrackSettings(2));
        }
        if (this.toggleSpatialDesignBtn) {
            this.toggleSpatialDesignBtn.addEventListener('click', () => this.toggleSpatialDesign());
        }

        // ドロップオーバーレイボタン（元波形1）
        if (this.dropOverlay1) {
            this.dropOverlay1.addEventListener('click', () => {
                if (this.fileInput1) {
                    this.fileInput1.click();
                }
            });
        }

        // ドロップオーバーレイボタン（元波形2）
        if (this.dropOverlay2) {
            this.dropOverlay2.addEventListener('click', () => {
                if (this.fileInput2) {
                    this.fileInput2.click();
                }
            });
        }

        // ドロップゾーン1（元波形1）
        if (this.dropZone1) {
            ['dragenter', 'dragover'].forEach(evt => {
                this.dropZone1.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone1.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach(evt => {
                this.dropZone1.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone1.classList.remove('dragover');
                });
            });

            this.dropZone1.addEventListener('drop', (e) => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    // 同じファイルを再度読み込めるようにリセット
                    this.fileInput1.value = '';
                    this.loadFile(files[0], 1);
                }
            });
        }

        // ドロップゾーン2（元波形2）
        if (this.dropZone2) {
            ['dragenter', 'dragover'].forEach(evt => {
                this.dropZone2.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone2.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach(evt => {
                this.dropZone2.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone2.classList.remove('dragover');
                });
            });

            this.dropZone2.addEventListener('drop', (e) => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    // 同じファイルを再度読み込めるようにリセット
                    this.fileInput2.value = '';
                    this.loadFile(files[0], 2);
                }
            });
        }

        const clickHandler = (e) => {
            if (!this.loopMaker || !this.loopMaker.track1Buffer) return;
            if (!this.loopMaker.audioPlayer || !this.loopMaker.audioPlayer.isPlaying) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            if (width <= 0) return;

            const ratio = Math.min(1, Math.max(0, x / width));
            const duration = this.loopMaker.track1Buffer.duration;
            const targetTime = duration * ratio;

            this.loopMaker.seekTo(targetTime);
        };

        if (this.waveformTrack1) {
            this.waveformTrack1.addEventListener('click', clickHandler);
        }
        if (this.waveformTrack2) {
            this.waveformTrack2.addEventListener('click', clickHandler);
        }
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            const isOverlapSlider = e.target.id === 'overlap-rate';
            // 入力欄にフォーカスがある場合は無視するが、オーバーラップ率スライダーだけは許可
            if (isInput && !isOverlapSlider) {
                return;
            }
            
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                this.togglePlayback();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                // フォーカスされているトラックをミュート（デフォルトはトラック1）
                this.toggleMuteTrack1();
            }
        });
    }

    async handleFileUpload(event, trackNumber) {
        const file = event.target.files[0];
        if (!file) return;

        await this.loadFile(file, trackNumber);
    }

    async loadFile(file, trackNumber) {
        if (!file) return;

        this.showStatus(`元波形${trackNumber}を読み込み中...`, 'info');

        try {
            // 再生中なら停止してから読み込み
            if (this.loopMaker.audioPlayer && this.loopMaker.audioPlayer.isPlaying) {
                this.loopMaker.audioPlayer.stopPreview();
                this.loopMaker.stopPlaybackAnimation();
                this.playBtn.disabled = false;
                this.stopBtn.disabled = true;
            }

            // AudioContextがまだ作成されていない場合は作成
            if (!this.loopMaker.audioContext) {
                this.loopMaker.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.loopMaker.audioProcessor = new AudioProcessor(this.loopMaker.audioContext);
                this.loopMaker.audioPlayer = new AudioPlayer(this.loopMaker.audioContext);
            }

            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.loopMaker.audioContext.decodeAudioData(arrayBuffer);
            
            // トラック番号に応じてバッファを設定
            if (trackNumber === 1) {
                this.loopMaker.originalBuffer1 = audioBuffer;
                // 元波形1を表示
                if (this.loopMaker.originalWaveformViewer1) {
                    this.loopMaker.originalWaveformViewer1.setAudioBuffer(audioBuffer);
                    this.loopMaker.useRangeStart1 = 0;
                    this.loopMaker.useRangeEnd1 = audioBuffer.duration;
                    this.loopMaker.originalWaveformViewer1.setRange(this.loopMaker.useRangeStart1, this.loopMaker.useRangeEnd1);
                    if (this.dropOverlay1) {
                        this.dropOverlay1.classList.add('hidden');
                    }
                }
            } else if (trackNumber === 2) {
                this.loopMaker.originalBuffer2 = audioBuffer;
                // 元波形2を表示
                if (this.loopMaker.originalWaveformViewer2) {
                    this.loopMaker.originalWaveformViewer2.setAudioBuffer(audioBuffer);
                    this.loopMaker.useRangeStart2 = 0;
                    this.loopMaker.useRangeEnd2 = audioBuffer.duration;
                    this.loopMaker.originalWaveformViewer2.setRange(this.loopMaker.useRangeStart2, this.loopMaker.useRangeEnd2);
                    if (this.dropOverlay2) {
                        this.dropOverlay2.classList.add('hidden');
                    }
                }
            }
            
            // エフェクトを初期化
            this.loopMaker.initializeEffects();
            
            // バッファを生成（長い方を基準にする）
            this.loopMaker.updateBuffers();
            
            // 元波形を追加したタイミングで、それぞれのトラックの0ポジションにリージョンを追加
            this.addRegionsForTracks();
            
            // ファイル名を保存用ファイル名に反映（最初のファイルのみ）
            if (this.filenameInput && file && file.name && !this.filenameInput.value) {
                const originalName = file.name;
                // 拡張子を .wav に統一（元が .wav ならそのまま）
                const dotIndex = originalName.lastIndexOf('.');
                let base = originalName;
                if (dotIndex > 0) {
                    base = originalName.substring(0, dotIndex);
                }
                const newName = base + '.wav';
                this.filenameInput.value = newName;
                this.filenameInput.disabled = false;
            }
            
            this.loopMaker.drawWaveforms();
            this.updateClearButtonsState();
            this.enableControls();
            this.showStatus(`元波形${trackNumber}の読み込みが完了しました`, 'success');
        } catch (error) {
            this.showStatus(`エラー: ${error.message}`, 'error');
            console.error(error);
        }
    }

    togglePlayback() {
        if ((!this.loopMaker.originalBuffer1 && !this.loopMaker.originalBuffer2) || !this.loopMaker.audioPlayer) return;
        
        if (this.loopMaker.audioPlayer.isPlaying) {
            this.stopPreview();
        } else {
            this.playPreview();
        }
    }

    async playPreview() {
        if ((!this.loopMaker.originalBuffer1 && !this.loopMaker.originalBuffer2) || !this.loopMaker.audioPlayer || !this.loopMaker.track1Buffer || !this.loopMaker.track2Buffer) return;

        try {
            this.playBtn.disabled = true;
            this.stopBtn.disabled = false;

            // リージョン情報からプレビュー用バッファを生成
            const previewTrack1 = this.loopMaker.buildPreviewBufferFromRegions
                ? this.loopMaker.buildPreviewBufferFromRegions(1)
                : this.loopMaker.track1Buffer;
            const previewTrack2 = this.loopMaker.buildPreviewBufferFromRegions
                ? this.loopMaker.buildPreviewBufferFromRegions(2)
                : this.loopMaker.track2Buffer;

            if (!previewTrack1 || !previewTrack2) {
                this.showStatus('プレビュー用バッファの生成に失敗しました', 'error');
                this.playBtn.disabled = false;
                this.stopBtn.disabled = true;
                return;
            }

            // 再生開始位置を決定（選択中のリージョンの開始位置から再生）
            let offsetSeconds = 0;
            const starts = [];
            if (this.loopMaker.regionController1 && this.loopMaker.regionController1.getSelectedRegion()) {
                starts.push(this.loopMaker.regionController1.getSelectedRegion().startTime);
            }
            if (this.loopMaker.regionController2 && this.loopMaker.regionController2.getSelectedRegion()) {
                starts.push(this.loopMaker.regionController2.getSelectedRegion().startTime);
            }
            if (starts.length > 0) {
                offsetSeconds = Math.min(...starts);
            }

            // トラック1と2の加工後のバッファを再生（offsetSeconds から）
            this.loopMaker.audioPlayer.playPreviewWithBuffers(previewTrack1, previewTrack2, offsetSeconds);
            
            // 再生開始直後に、現在のミュート状態を反映
            // （再生前にミュートしていた場合でも、再生開始時に反映されるようにする）
            if (this.track1Muted) {
                this.loopMaker.audioPlayer.setTrack1Mute(true);
            }
            if (this.track2Muted) {
                this.loopMaker.audioPlayer.setTrack2Mute(true);
            }

            this.loopMaker.startPlaybackAnimation();
            
            this.showStatus('再生中...', 'info');
        } catch (error) {
            this.showStatus('再生エラー: ' + error.message, 'error');
            console.error(error);
            this.playBtn.disabled = false;
            this.stopBtn.disabled = true;
        }
    }

    stopPreview() {
        if (this.loopMaker.audioPlayer) {
            this.loopMaker.audioPlayer.stopPreview();
        }
        this.loopMaker.stopPlaybackAnimation();
        this.playBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.showStatus('停止しました', 'info');
    }

    clearOriginalWaveform(trackNumber) {
        // 再生中なら停止
        if (this.loopMaker.audioPlayer && this.loopMaker.audioPlayer.isPlaying) {
            this.loopMaker.audioPlayer.stopPreview();
            this.loopMaker.stopPlaybackAnimation();
            this.playBtn.disabled = false;
            this.stopBtn.disabled = true;
        }

        if (trackNumber === 1) {
            // 元波形1をクリア
            this.loopMaker.originalBuffer1 = null;
            this.loopMaker.useRangeStart1 = 0;
            this.loopMaker.useRangeEnd1 = 0;
            
            // 元波形ビューアをクリア
            if (this.loopMaker.originalWaveformViewer1) {
                this.loopMaker.originalWaveformViewer1.setAudioBuffer(null);
            }
            
            // ドロップオーバーレイを表示
            if (this.dropOverlay1) {
                this.dropOverlay1.classList.remove('hidden');
            }
            
            // トラック1のリージョンをクリア
            if (this.loopMaker.regionController1) {
                this.loopMaker.regionController1.clearRegions();
            }
            
            // ファイル入力もリセット
            if (this.fileInput1) {
                this.fileInput1.value = '';
            }
        } else if (trackNumber === 2) {
            // 元波形2をクリア
            this.loopMaker.originalBuffer2 = null;
            this.loopMaker.useRangeStart2 = 0;
            this.loopMaker.useRangeEnd2 = 0;
            
            // 元波形ビューアをクリア
            if (this.loopMaker.originalWaveformViewer2) {
                this.loopMaker.originalWaveformViewer2.setAudioBuffer(null);
            }
            
            // ドロップオーバーレイを表示
            if (this.dropOverlay2) {
                this.dropOverlay2.classList.remove('hidden');
            }
            
            // トラック2のリージョンをクリア
            if (this.loopMaker.regionController2) {
                this.loopMaker.regionController2.clearRegions();
            }
            
            // ファイル入力もリセット
            if (this.fileInput2) {
                this.fileInput2.value = '';
            }
            
            // 元波形2のセクションを非表示に戻す
            if (this.originalWaveformContainer2) {
                this.originalWaveformContainer2.classList.add('hidden');
            }
            // 「元波形2を追加」ボタンを再表示
            if (this.addWaveformContainer) {
                this.addWaveformContainer.classList.remove('hidden');
            }
        }
        
        // バッファを更新
        this.loopMaker.updateBuffers();
        
        // 波形を再描画
        this.loopMaker.drawWaveforms();
        
        // コントロールの有効/無効を更新
        this.updateClearButtonsState();
        this.enableControls();
        
        this.showStatus(`元波形${trackNumber}をクリアしました`, 'info');
    }

    addWaveform2() {
        // 元波形2のセクションを表示
        if (this.originalWaveformContainer2) {
            this.originalWaveformContainer2.classList.remove('hidden');
        }
        // 「元波形2を追加」ボタンを非表示
        if (this.addWaveformContainer) {
            this.addWaveformContainer.classList.add('hidden');
        }
        // ファイル入力2をクリックしてファイル選択を促す
        if (this.fileInput2) {
            this.fileInput2.click();
        }
    }

    addTrack2() {
        // トラック2のセクションを表示
        if (this.trackContainer2) {
            this.trackContainer2.classList.remove('hidden');
        }
        // 「トラック2を追加」ボタンを非表示
        if (this.addTrackContainer) {
            this.addTrackContainer.classList.add('hidden');
        }
        this.showStatus('トラック2を追加しました', 'info');
    }

    toggleTrackSettings(trackNumber) {
        const settings = trackNumber === 1 ? this.trackSettings1 : this.trackSettings2;
        const button = trackNumber === 1 ? this.toggleSettingsTrack1Btn : this.toggleSettingsTrack2Btn;
        
        if (!settings || !button) return;
        
        const isHidden = settings.classList.contains('hidden');
        
        if (isHidden) {
            // 開く
            settings.classList.remove('hidden');
            button.textContent = '▲';
            button.classList.add('open');
        } else {
            // 閉じる
            settings.classList.add('hidden');
            button.textContent = '▼';
            button.classList.remove('open');
        }
    }

    toggleSpatialDesign() {
        if (!this.spatialControls || !this.toggleSpatialDesignBtn) return;
        
        const isHidden = this.spatialControls.classList.contains('hidden');
        
        if (isHidden) {
            // 開く
            this.spatialControls.classList.remove('hidden');
            this.toggleSpatialDesignBtn.textContent = '▲';
            this.toggleSpatialDesignBtn.classList.add('open');
            
            // キャンバスの表示更新
            if (this.loopMaker.spatialDesignUI) {
                // キャンバスのサイズが正しく設定されるように少し遅延させる
                setTimeout(() => {
                    this.loopMaker.spatialDesignUI.render();
                }, 10);
            }
        } else {
            // 閉じる
            this.spatialControls.classList.add('hidden');
            this.toggleSpatialDesignBtn.textContent = '▼';
            this.toggleSpatialDesignBtn.classList.remove('open');
        }
    }

    removeTrack2() {
        // 再生中なら停止
        if (this.loopMaker.audioPlayer && this.loopMaker.audioPlayer.isPlaying) {
            this.loopMaker.audioPlayer.stopPreview();
            this.loopMaker.stopPlaybackAnimation();
            this.playBtn.disabled = false;
            this.stopBtn.disabled = true;
        }

        // トラック2のリージョンをクリア
        if (this.loopMaker.regionController2) {
            this.loopMaker.regionController2.clearRegions();
        }

        // トラック2のセクションを非表示
        if (this.trackContainer2) {
            this.trackContainer2.classList.add('hidden');
        }
        // 「トラック2を追加」ボタンを再表示
        if (this.addTrackContainer) {
            this.addTrackContainer.classList.remove('hidden');
        }

        // バッファを更新（トラック2がない状態で）
        this.loopMaker.updateBuffers();
        
        // 波形を再描画
        this.loopMaker.drawWaveforms();
        
        this.showStatus('トラック2を削除しました', 'info');
    }

    updateClearButtonsState() {
        // 元波形1の✕ボタンの有効/無効を更新
        if (this.clearOriginal1Btn) {
            this.clearOriginal1Btn.disabled = !this.loopMaker.originalBuffer1;
        }
        // 元波形2の✕ボタンの有効/無効を更新
        if (this.clearOriginal2Btn) {
            this.clearOriginal2Btn.disabled = !this.loopMaker.originalBuffer2;
        }
    }

    async saveFile() {
        if (!this.loopMaker.mixedBuffer || !this.loopMaker.audioProcessor) return;

        try {
            // ファイル名を取得
            let filename = this.filenameInput ? this.filenameInput.value.trim() : 'se_editor_output.wav';
            if (!filename) {
                filename = 'se_editor_output.wav';
            }
            
            // .wav拡張子がない場合は追加
            if (!filename.toLowerCase().endsWith('.wav')) {
                filename += '.wav';
                if (this.filenameInput) {
                    this.filenameInput.value = filename;
                }
            }

            // File System Access APIが利用可能な場合
            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'WAV files',
                            accept: { 'audio/wav': ['.wav'] }
                        }]
                    });
                    
                    // ファイルが既に存在するかチェック（File System Access APIでは自動的に警告が表示される）
                    // ここでは直接保存を実行（ブラウザが同名ファイルの警告を自動表示）
                    const writable = await fileHandle.createWritable();
                    const wav = this.loopMaker.audioProcessor.bufferToWav(this.loopMaker.mixedBuffer);
                    await writable.write(wav);
                    await writable.close();
                    
                    // ファイル名を更新
                    if (this.filenameInput) {
                        this.filenameInput.value = fileHandle.name;
                    }
                    
                    this.showStatus('ファイルを保存しました', 'success');
                    return;
                } catch (error) {
                    // ユーザーがキャンセルした場合
                    if (error.name === 'AbortError') {
                        this.showStatus('保存をキャンセルしました', 'info');
                        return;
                    }
                    // その他のエラーは通常のダウンロード方式にフォールバック
                    console.warn('File System Access API error:', error);
                }
            }

            // 通常のダウンロード方式（File System Access APIが利用不可の場合）
            // ブラウザのダウンロードフォルダに同名ファイルがある場合、ブラウザが自動的に「(1)」などを付ける
            this.showStatus('ファイルを生成中...', 'info');
            this.loopMaker.audioProcessor.saveMixedBuffer(this.loopMaker.mixedBuffer, filename);
            this.showStatus('ファイルを保存しました', 'success');
        } catch (error) {
            this.showStatus('保存エラー: ' + error.message, 'error');
            console.error(error);
        }
    }

    enableControls() {
        this.saveBtn.disabled = false;
        this.playBtn.disabled = false;
        if (this.filenameInput) {
            this.filenameInput.disabled = false;
        }
        
        // ピッチコントロールを有効化
        const pitchInputs = document.querySelectorAll('.pitch-input');
        pitchInputs.forEach(input => {
            input.disabled = false;
        });
        
        // ピッチトランスポーズを有効化
        if (this.loopMaker.pitchTransposeUI) {
            this.loopMaker.pitchTransposeUI.enable();
        }
        
        // MultiBand Compを有効化
        if (this.loopMaker.multibandCompUI) {
            this.loopMaker.multibandCompUI.enable();
        }
        
        // Spatial Designを有効化
        if (this.loopMaker.spatialDesignUI) {
            this.loopMaker.spatialDesignUI.enable();
        }
        
        // クリアボタンの状態を更新
        this.updateClearButtonsState();
    }

    showStatus(message, type = 'info') {
        this.status.textContent = message;
        this.status.className = 'status ' + type;
    }

    showOverwriteDialog(filename) {
        if (!this.overwriteDialog || !this.overwriteFilename) return;
        this.overwriteFilename.textContent = filename;
        this.overwriteDialog.classList.remove('hidden');
        this.pendingFilename = filename;
    }

    hideOverwriteDialog() {
        if (!this.overwriteDialog) return;
        this.overwriteDialog.classList.add('hidden');
        this.pendingFilename = null;
    }

    handleOverwriteConfirm() {
        if (!this.pendingFilename) return;
        this.hideOverwriteDialog();
        // 上書き保存を実行
        this.showStatus('ファイルを生成中...', 'info');
        this.loopMaker.audioProcessor.saveMixedBuffer(this.loopMaker.mixedBuffer, this.pendingFilename);
        this.showStatus('ファイルを保存しました', 'success');
    }

    handleOverwriteRename() {
        if (!this.pendingFilename) return;
        this.hideOverwriteDialog();
        // 別名で保存（File System Access APIを使用）
        if ('showSaveFilePicker' in window) {
            this.saveFileWithPicker(this.pendingFilename);
        } else {
            // 通常のダウンロード方式（ブラウザが自動的に「(1)」などを付ける）
            this.showStatus('ファイルを生成中...', 'info');
            this.loopMaker.audioProcessor.saveMixedBuffer(this.loopMaker.mixedBuffer, this.pendingFilename);
            this.showStatus('ファイルを保存しました', 'success');
        }
    }

    handleOverwriteCancel() {
        this.hideOverwriteDialog();
        this.showStatus('保存をキャンセルしました', 'info');
    }

    async saveFileWithPicker(suggestedName) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{
                    description: 'WAV files',
                    accept: { 'audio/wav': ['.wav'] }
                }]
            });
            
            const writable = await fileHandle.createWritable();
            const wav = this.loopMaker.audioProcessor.bufferToWav(this.loopMaker.mixedBuffer);
            await writable.write(wav);
            await writable.close();
            
            if (this.filenameInput) {
                this.filenameInput.value = fileHandle.name;
            }
            
            this.showStatus('ファイルを保存しました', 'success');
        } catch (error) {
            if (error.name === 'AbortError') {
                this.showStatus('保存をキャンセルしました', 'info');
            } else {
                this.showStatus('保存エラー: ' + error.message, 'error');
            }
        }
    }

    toggleMuteTrack1() {
        this.track1Muted = !this.track1Muted;
        if (this.loopMaker.audioPlayer) {
            this.loopMaker.audioPlayer.setTrack1Mute(this.track1Muted);
        }
        this.updateMuteButton(this.muteTrack1Btn, this.track1Muted);
    }

    toggleMuteTrack2() {
        this.track2Muted = !this.track2Muted;
        if (this.loopMaker.audioPlayer) {
            this.loopMaker.audioPlayer.setTrack2Mute(this.track2Muted);
        }
        this.updateMuteButton(this.muteTrack2Btn, this.track2Muted);
    }

    updateMuteButton(button, muted) {
        if (muted) {
            button.classList.add('muted');
            button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
        } else {
            button.classList.remove('muted');
            button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
        }
    }
    
    // 各トラックの0ポジションにリージョンを追加
    addRegionsForTracks() {
        if (!this.loopMaker.trackDisplayDuration || this.loopMaker.trackDisplayDuration <= 0) return;
        
        // トラック1にリージョンを追加（元波形1がある場合）
        if (this.loopMaker.originalBuffer1 && this.loopMaker.regionController1) {
            const range1Duration = this.loopMaker.useRangeEnd1 - this.loopMaker.useRangeStart1;
            // 既存のリージョンをクリア
            this.loopMaker.regionController1.clearRegions();
            // 0ポジションにリージョンを追加
            this.loopMaker.regionController1.addRegion(
                0,
                range1Duration,
                this.loopMaker.originalBuffer1,
                this.loopMaker.useRangeStart1
            );
        }
        
        // トラック2にリージョンを追加（元波形2がある場合）
        if (this.loopMaker.originalBuffer2 && this.loopMaker.regionController2) {
            const range2Duration = this.loopMaker.useRangeEnd2 - this.loopMaker.useRangeStart2;
            // 既存のリージョンをクリア
            this.loopMaker.regionController2.clearRegions();
            // 0ポジションにリージョンを追加
            this.loopMaker.regionController2.addRegion(
                0,
                range2Duration,
                this.loopMaker.originalBuffer2,
                this.loopMaker.useRangeStart2
            );
        }
    }
}

