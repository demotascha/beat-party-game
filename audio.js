// audio.js - Web Audio 節拍引擎 + YouTube(b9r9uvM4jlo) / 自訂音檔背景音樂
class BeatAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;          // 全部靜音
    this.synthEnabled = false;     // 預設關閉內建合成鼓點 + 8 格哨音
    this.voiceEnabled = false;     // 預設關閉「預備 1 2 3 GO」人聲
    this.useYoutube = false;       // 預設改用 beats.mp3 (bc.aeiou.tw 同款音軌)
    this.ytVideoId = 'b9r9uvM4jlo';
    this.ytPlayer = null;
    this.isYtReady = false;
    this.ytError = null;
    this.customAudio = null;
    this.audioBuffer = null;
    this.bufferSource = null;
    this.bgmStartTime = 0;
    this.bgmStartOffset = 0;
    this.isBgmPlaying = false;
    this.initAudioBuffer();
    this.loadSettings();
    this.initYouTube();
  }

  // 使用 Web Audio API 預載解碼 beats.mp3
  // 徹底解決 iOS/iPadOS Chrome 下 HTML5 Audio 重新播放時 currentTime 延遲與音畫錯位問題
  async initAudioBuffer() {
    try {
      const response = await fetch('audio/beats.mp3');
      const arrayBuffer = await response.arrayBuffer();
      this.init(); // 確保 ctx 初始化
      if (this.ctx) {
        this.ctx.decodeAudioData(arrayBuffer, (decoded) => {
          this.audioBuffer = decoded;
        }, (err) => {
          console.warn('音訊解碼失敗，將降級使用 HTML5 Audio:', err);
          this.setupHtml5AudioFallback();
        });
      } else {
        this.setupHtml5AudioFallback();
      }
    } catch (e) {
      console.warn('音訊載入失敗，將降級使用 HTML5 Audio:', e);
      this.setupHtml5AudioFallback();
    }
  }

  setupHtml5AudioFallback() {
    if (!this.customAudio) {
      this.customAudio = new Audio('audio/beats.mp3');
      this.customAudio.loop = true;
      this.customAudio.preload = 'auto';
    }
  }

  /* ---------- 設定儲存 ---------- */
  loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('beat_audio_settings_v2') || '{}');
      if (typeof s.synthEnabled === 'boolean') this.synthEnabled = s.synthEnabled;
      if (typeof s.voiceEnabled === 'boolean') this.voiceEnabled = s.voiceEnabled;
      if (typeof s.useYoutube === 'boolean') this.useYoutube = s.useYoutube;
    } catch (e) {}
  }
  saveSettings() {
    localStorage.setItem('beat_audio_settings_v2', JSON.stringify({
      synthEnabled: this.synthEnabled, voiceEnabled: this.voiceEnabled, useYoutube: this.useYoutube
    }));
  }

  /* ---------- YouTube 背景音樂 ---------- */
  initYouTube() {
    // file:// 開啟時 YouTube 內嵌會被拒絕 (錯誤 153)，需用 http(s) 開啟
    if (location.protocol === 'file:') {
      this.ytError = '目前以 file:// 開啟，YouTube 無法內嵌播放，請改用本機伺服器 (http://localhost) 開啟';
      return;
    }
    const create = () => {
      try {
        this.ytPlayer = new window.YT.Player('ytPlayer', {
          height: '200', width: '200', // 太小 (<200px) 的播放器可能被 YouTube 拒絕播放
          videoId: this.ytVideoId,
          playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0, loop: 1, playlist: this.ytVideoId, origin: location.origin },
          events: {
            onReady: () => { this.isYtReady = true; this.ytError = null; },
            onError: (e) => { this.isYtReady = false; this.ytError = `YouTube 播放錯誤 (代碼 ${e.data})`; },
            onStateChange: (e) => { if (e.data === window.YT.PlayerState.ENDED) this.ytPlayer.playVideo(); }
          }
        });
      } catch (e) { this.ytError = 'YouTube 播放器建立失敗'; }
    };
    if (window.YT && window.YT.Player) create();
    else window.onYouTubeIframeAPIReady = create;
  }

  setCustomAudioFile(file) {
    if (!this.customAudio) { this.customAudio = new Audio(); this.customAudio.loop = true; }
    this.customAudio.src = URL.createObjectURL(file);
  }

  // 依據目前目標 BPM 自動調整 beats.mp3 與 YouTube 的播放倍率 (例如小孩模式 140 BPM ≈ 0.77x 放慢且不變調)
  setPlaybackRateByBpm(bpm) {
    const baseBpm = 183;
    const rate = Math.max(0.5, Math.min(1.5, (bpm || baseBpm) / baseBpm));
    this.playbackRate = rate;
    if (this.bufferSource && this.bufferSource.playbackRate) {
      try {
        this.bufferSource.playbackRate.setValueAtTime(rate, this.ctx.currentTime);
      } catch (e) {}
    }
    if (this.customAudio) {
      this.customAudio.preservesPitch = true;
      this.customAudio.playbackRate = rate;
    }
    if (this.isYtReady && this.ytPlayer && typeof this.ytPlayer.setPlaybackRate === 'function') {
      try {
        this.ytPlayer.setPlaybackRate(rate < 0.85 ? 0.75 : 1);
      } catch (e) {}
    }
  }

  playBGM() {
    if (this.isMuted) return;

    // 優先使用 Web Audio AudioBufferSourceNode，毫秒級精準同步且在 iOS Chrome 重啟時完全無延遲
    if (this.audioBuffer && this.ctx) {
      this.init();
      this.pauseBGM(); // 確保停止先前的 source
      
      const source = this.ctx.createBufferSource();
      source.buffer = this.audioBuffer;
      source.loop = true;
      source.playbackRate.value = this.playbackRate || 1.0;
      
      // 連接到混音總線
      source.connect(this.bus || this.ctx.destination);
      
      this.bgmStartTime = this.ctx.currentTime;
      this.bgmStartOffset = 0;
      source.start(0, 0);
      this.bufferSource = source;
      this.isBgmPlaying = true;
      return;
    }

    if (this.customAudio) {
      if (!this.customAudio.src) {
        this.customAudio.src = 'audio/beats.mp3';
        this.customAudio.load();
      }
      try {
        this.customAudio.currentTime = 0;
      } catch (e) {}
      if (this.playbackRate) this.customAudio.playbackRate = this.playbackRate;
      const p = this.customAudio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(err => {
          console.warn('音檔播放受阻或載入中:', err);
          if (window.gameApp) {
            window.gameApp.bgmFailed = true;
          }
        });
      }
      return;
    }
    if (this.useYoutube && this.isYtReady && this.ytPlayer) {
      try {
        this.ytPlayer.unMute();
        this.ytPlayer.setVolume(90);
        this.ytPlayer.seekTo(0, true);
        this.ytPlayer.playVideo();
        return;
      } catch (e) { console.warn('YouTube 播放受阻', e); }
    }
  }

  pauseBGM() {
    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
        this.bufferSource.disconnect();
      } catch (e) {}
      this.bufferSource = null;
    }
    this.isBgmPlaying = false;

    if (this.customAudio) {
      try {
        this.customAudio.pause();
        this.customAudio.currentTime = 0;
      } catch (e) {}
    }
    if (this.isYtReady && this.ytPlayer) { try { this.ytPlayer.pauseVideo(); } catch (e) {} }
  }

  // 取得目前背景音樂的精準播放秒數，供畫面對拍使用
  getBGMTimeSec() {
    if (this.isBgmPlaying && this.bufferSource && this.ctx && this.audioBuffer) {
      const elapsed = (this.ctx.currentTime - this.bgmStartTime) * (this.playbackRate || 1.0);
      const dur = this.audioBuffer.duration;
      return dur > 0 ? (elapsed % dur) : elapsed;
    }
    if (!this.useYoutube && this.customAudio && this.customAudio.src && !this.customAudio.paused) {
      return this.customAudio.currentTime;
    }
    if (this.useYoutube && this.isYtReady && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
      try {
        if (this.ytPlayer.getPlayerState() === 1) return this.ytPlayer.getCurrentTime();
      } catch (e) {}
    }
    if (this.customAudio && this.customAudio.src && !this.customAudio.paused) {
      return this.customAudio.currentTime;
    }
    return null;
  }

  setMuted(m) {
    this.isMuted = m;
    if (m) { this.pauseBGM(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  }

  /* ---------- Web Audio ---------- */
  // 必須在使用者點擊/按鍵的事件中呼叫，瀏覽器才允許出聲
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.bus) this._buildMixBus();
    // 解鎖 iOS/Safari：播放一段無聲 buffer
    if (!this._unlocked) {
      const b = this.ctx.createBuffer(1, 1, 22050);
      const s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.bus); s.start(0);
      this._unlocked = true;
    }
  }

  /* ---------- 混音總線：壓縮器 + 殘響，讓聲音更飽滿有力 ---------- */
  _buildMixBus() {
    const ctx = this.ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    // 殘響 (人工 impulse response)
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const verbGain = ctx.createGain(); verbGain.gain.value = 0.18;
    this.bus.connect(comp);
    this.bus.connect(verb); verb.connect(verbGain); verbGain.connect(comp);
    comp.connect(ctx.destination);
  }

  _noiseBuf(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // 韓系 808 Sub-Bass (深沉正弦波 + 輕微泛音 + 滑音 Glide)
  playBass(freq, t, dur, glideTo = null) {
    const ctx = this._ready(); if (!ctx) return;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sine'; o2.type = 'triangle';
    o1.frequency.setValueAtTime(freq, t);
    o2.frequency.setValueAtTime(freq * 2, t);
    if (glideTo) {
      o1.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.8);
      o2.frequency.exponentialRampToValueAtTime(glideTo * 2, t + dur * 0.8);
    }
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o1.connect(g); o2.connect(f); f.connect(g); g.connect(this.bus);
    [o1, o2].forEach(o => { o.start(t); o.stop(t + dur + 0.02); });
  }

  // K-Pop Pluck 彈撥音色 (清脆、時尚的現代韓系合成器)
  playKpopPluck(freq, t, dur = 0.18, vol = 0.22) {
    const ctx = this._ready(); if (!ctx) return;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'triangle'; o2.type = 'sawtooth';
    o1.frequency.value = freq; o2.frequency.value = freq * 1.004;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(6500, t);
    f.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.bus);
    [o1, o2].forEach(o => { o.start(t); o.stop(t + dur + 0.02); });
  }

  // Future Bass 寬廣和弦 Stab (帶 7th/9th 延伸和弦的現代感)
  playChordStab(freqs, t, dur, vol = 0.11) {
    const ctx = this._ready(); if (!ctx) return;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(5500, t); f.frequency.exponentialRampToValueAtTime(1100, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    f.connect(g); g.connect(this.bus);
    freqs.forEach(fr => [-10, 0, 10].forEach(det => {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = fr; o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.02);
    }));
  }

  // 上升白噪音 + 音高爬升 (預備拍的緊張感)
  playRiser(t, dur) {
    const ctx = this._ready(); if (!ctx) return;
    const n = ctx.createBufferSource(); n.buffer = this._noiseBuf(dur);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.02, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur);
    n.connect(f); f.connect(g); g.connect(this.bus); n.start(t); n.stop(t + dur);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(1760, t + dur);
    og.gain.setValueAtTime(0.01, t); og.gain.linearRampToValueAtTime(0.08, t + dur);
    o.connect(og); og.connect(this.bus); o.start(t); o.stop(t + dur);
  }

  // 銅鈸 Crash (GO! 爆發點)
  playCrash(t) {
    const ctx = this._ready(); if (!ctx) return;
    const n = ctx.createBufferSource(); n.buffer = this._noiseBuf(1.5);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    n.connect(f); f.connect(g); g.connect(this.bus); n.start(t); n.stop(t + 1.5);
  }

  // 拍手 Clap (三層錯開，更像真人拍手)
  playClap(t) {
    const ctx = this._ready(); if (!ctx) return;
    [0, 0.012, 0.024].forEach((off, i) => {
      const n = ctx.createBufferSource(); n.buffer = this._noiseBuf(0.2);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 1.5;
      const g = ctx.createGain(), s = t + off, d = i === 2 ? 0.18 : 0.03;
      g.gain.setValueAtTime(0.55, s); g.gain.exponentialRampToValueAtTime(0.001, s + d);
      n.connect(f); f.connect(g); g.connect(this.bus); n.start(s); n.stop(s + d + 0.01);
    });
  }

  /**
   * 韓系 K-Pop 風格自動編曲 (由 app 每拍呼叫)
   * step 0~3 = 預備拍 (每步 1 拍)，step 4~11 = 8 格 (每步半拍)
   * 採用 K-Pop 時尚小調 7th/9th 和弦進行 (F#m9 - Dmaj7 - A - E) + 808 低音 + Pluck 旋律
   */
  playMusicStep(step, beatSec, round = 1) {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    // K-Pop 經典時尚小調進行：F#m9 -> Dmaj7 -> Amaj7 -> E6
    const prog = [
      { root: 46.25, chord: [185.00, 220.00, 277.18, 329.63] }, // F#m7
      { root: 36.71, chord: [146.83, 185.00, 220.00, 277.18] }, // Dmaj7
      { root: 55.00, chord: [220.00, 277.18, 329.63, 415.30] }, // Amaj7
      { root: 41.20, chord: [164.81, 207.65, 246.94, 329.63] }  // E6
    ];
    const c = prog[(round - 1) % 4];
    const hype = Math.min(1, 0.65 + round * 0.08);
    // K-Pop 8 格抓耳 Hook 旋律 (F# 小調五聲音階)
    const hook = [739.99, 880.00, 1108.73, 880.00, 739.99, 659.25, 739.99, 1108.73];

    if (step < 4) {
      // ===== 預備拍：808 重擊 + Pluck 琶音 + Trap Hi-Hat 滾奏 =====
      if (step === 0) {
        this.playRiser(t, beatSec * 4);
        this.playChordStab(c.chord, t, beatSec * 0.9, 0.09);
      }
      this.playKick(t);
      this.playBass(c.root, t, beatSec * 0.85);
      this.playKpopPluck(c.chord[step % c.chord.length] * 2, t, beatSec * 0.4, 0.2);
      if (step === 1 || step === 3) this.playClap(t);
      // Trap 風格細碎 Hi-Hat + 小鼓推進
      const rolls = [2, 3, 4, 6][step];
      for (let i = 0; i < rolls; i++) {
        this.playHiHat(t + (beatSec / rolls) * i, i === 0);
        if (step >= 2) this.playSnare(t + (beatSec / rolls) * i);
      }
      this.playPrepBeep(step === 3);
    } else {
      // ===== 8 格：Jersey/K-Pop 切分律動 + 808 滑音 + 抓耳 Pluck Hook =====
      const i = step - 4, half = beatSec / 2;
      if (i === 0) {
        this.playCrash(t);
        this.playChordStab(c.chord.map(f => f * 2), t, beatSec * 1.4, 0.13 * hype);
      }
      if (i === 4) this.playChordStab(c.chord.map(f => f * 2), t, beatSec * 1.1, 0.1 * hype);
      // K-Pop 切分大鼓 (第 1, 3, 4, 7 格感)
      if (i === 0 || i === 3 || i === 4 || i === 6) this.playKick(t);
      if (i === 2 || i === 6) this.playClap(t);
      this.playHiHat(t, i % 2 === 1);
      // 808 低音 + 第 7 格滑音
      this.playBass(c.root, t, half * 0.9, i === 7 ? c.root * 1.5 : null);
      // 韓系 Pluck 旋律取代單調哨音，保留清脆卡點感
      this.playKpopPluck(hook[i], t, half * 0.85, 0.28 * hype);
      this.playBoxStepCue(i, t);
      if (i === 7) {
        // 韓團舞曲常見的 3 連音過門
        this.playHiHat(t + half * 0.33, true);
        this.playSnare(t + half * 0.66);
      }
    }
  }

  _ready(isSynth = true) {
    if (this.isMuted || (isSynth && !this.synthEnabled)) return null;
    this.init();
    return this.ctx;
  }

  playKick(time = 0) {
    const ctx = this._ready(); if (!ctx) return;
    const t = time || ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.setValueAtTime(165, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(18, t + 0.3);
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain); gain.connect(this.bus);
    osc.start(t); osc.stop(t + 0.31);
  }

  playSnare(time = 0) {
    const ctx = this._ready(); if (!ctx) return;
    const t = time || ctx.currentTime;
    const size = Math.floor(ctx.sampleRate * 0.16);
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < size; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.045));
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1400; filter.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
    noise.connect(filter); filter.connect(g); g.connect(this.bus);
    noise.start(t); noise.stop(t + 0.16);
  }

  playHiHat(time = 0, isAccent = false) {
    const ctx = this._ready(); if (!ctx) return;
    const t = time || ctx.currentTime;
    const size = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = isAccent ? 6000 : 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(isAccent ? 0.35 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    noise.connect(filter); filter.connect(g); g.connect(this.bus);
    noise.start(t); noise.stop(t + 0.05);
  }

  // 8 格依序跳動時的哨音 + 木魚提示音
  playBoxStepCue(boxIndex = 0, time = 0) {
    const ctx = this._ready(); if (!ctx) return;
    const t = time || ctx.currentTime;
    const down = boxIndex % 2 === 0;
    const freqs = [2349.32, 2637.02, 2349.32, 2793.83, 2349.32, 2637.02, 2349.32, 3135.96];
    const f = freqs[boxIndex % 8];
    const w = ctx.createOscillator(), wg = ctx.createGain();
    w.type = 'sine';
    w.frequency.setValueAtTime(f * 0.94, t); w.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    wg.gain.setValueAtTime(0.01, t); wg.gain.linearRampToValueAtTime(down ? 0.3 : 0.2, t + 0.012);
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    w.connect(wg); wg.connect(this.bus); w.start(t); w.stop(t + 0.14);
    const wood = ctx.createOscillator(), wog = ctx.createGain();
    wood.type = 'triangle';
    wood.frequency.setValueAtTime(down ? 920 : 1120, t); wood.frequency.exponentialRampToValueAtTime(460, t + 0.055);
    wog.gain.setValueAtTime(down ? 0.42 : 0.32, t); wog.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    wood.connect(wog); wog.connect(this.bus); wood.start(t); wood.stop(t + 0.06);
  }

  playPrepBeep(isGo = false) {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = isGo ? 'square' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 1046.5 : 587.33, t);
    gain.gain.setValueAtTime(isGo ? 0.3 : 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isGo ? 0.2 : 0.1));
    osc.connect(gain); gain.connect(this.bus);
    osc.start(t); osc.stop(t + (isGo ? 0.2 : 0.1));
  }

  // 成功 / 失敗音效不受「合成鼓點」開關影響
  playSuccessSound() {
    const ctx = this._ready(false); if (!ctx) return;
    [587.33, 739.99, 880, 1174.66].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.07;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.25);
    });
  }

  playFailSound() {
    const ctx = this._ready(false); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, t); o.frequency.linearRampToValueAtTime(110, t + 0.4);
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.4);
  }

  speak(text) {
    if (this.isMuted || !this.voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-TW'; u.rate = 1.5; u.pitch = 1.3; u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
}

window.beatAudio = new BeatAudioEngine();
