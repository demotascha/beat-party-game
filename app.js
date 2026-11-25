// app.js - 遊戲主邏輯、關卡節奏控制、裁判系統與 UI 交互

function makeEmojiAvatar(emoji, bg1, bg2) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="28" fill="url(#g)"/>
    <text x="60" y="68" font-size="64" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const WARMUP_ANIMALS = [
  { name: "貓", avatar: makeEmojiAvatar("🐱", "#ff9a9e", "#fecfef") },
  { name: "狗", avatar: makeEmojiAvatar("🐶", "#f6d365", "#fda085") },
  { name: "雞", avatar: makeEmojiAvatar("🐔", "#ffecd2", "#fcb69f") },
  { name: "鳥", avatar: makeEmojiAvatar("🐦", "#89f7fe", "#66a6ff") },
  { name: "豬", avatar: makeEmojiAvatar("🐷", "#fbc2eb", "#a6c1ee") },
  { name: "牛", avatar: makeEmojiAvatar("🐮", "#e0c3fc", "#8ec5fc") }
];

const WARMUP_FRUITS = [
  { name: "蘋果", avatar: makeEmojiAvatar("🍎", "#ff5858", "#f09819") },
  { name: "香蕉", avatar: makeEmojiAvatar("🍌", "#f7971e", "#ffd200") },
  { name: "葡萄", avatar: makeEmojiAvatar("🍇", "#8e2de2", "#4a00e0") },
  { name: "西瓜", avatar: makeEmojiAvatar("🍉", "#11998e", "#38ef7d") },
  { name: "草莓", avatar: makeEmojiAvatar("🍓", "#ff416c", "#ff4b2b") },
  { name: "鳳梨", avatar: makeEmojiAvatar("🍍", "#f2994a", "#f2c94c") }
];

function makeColorAvatar(bg1, bg2, stroke = "#ffffff") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <linearGradient id="c" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="28" fill="url(#c)"/>
    <circle cx="60" cy="60" r="38" fill="${bg1}" stroke="${stroke}" stroke-width="6"/>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// 6 種極高對比、絕對不會撞色混淆的顏色（移除易與紅/黃/藍混淆的橘色與紫色，改為黑白分明的黑與白）
const WARMUP_COLORS = [
  { name: "紅", avatar: makeColorAvatar("#ff1e1e", "#b30000"), family: "red" },
  { name: "黃", avatar: makeColorAvatar("#ffe600", "#eab308"), family: "yellow" },
  { name: "藍", avatar: makeColorAvatar("#0066ff", "#002b80"), family: "blue" },
  { name: "綠", avatar: makeColorAvatar("#00cc44", "#006622"), family: "green" },
  { name: "白", avatar: makeColorAvatar("#ffffff", "#cbd5e1", "#334155"), family: "white" },
  { name: "黑", avatar: makeColorAvatar("#111827", "#000000", "#94a3b8"), family: "black" }
];

class BeatPartyGame {
  constructor() {
    this.currentLevel = '1'; // 'w1': 動物熱身, 'w2': 水果熱身, 'w3': 顏色熱身, '1': 2位, '2': 3位, '3': 4位
    this.bpmLevels = {
      'w1': { dynamicWarmup: true, pool: WARMUP_ANIMALS, label: "熱身 1（動物大集合）" },
      'w2': { dynamicWarmup: true, pool: WARMUP_FRUITS,  label: "熱身 2（水果大集合）" },
      'w3': { dynamicWarmup: true, pool: WARMUP_COLORS,  label: "熱身 3（顏色大集合）" },
      '1':  { count: 2, label: "Level 1（簡單模式 - 2位）" },
      '2':  { count: 3, label: "Level 2（進階模式 - 隨機3位）" },
      '3':  { count: 4, label: "Level 3（魔王模式 - 隨機4位）" }
    };
    // 設定 (參考 bc.aeiou.tw：大人標準 183 BPM，小孩題庫自動放慢為 140 BPM)
    const saved = JSON.parse(localStorage.getItem('beat_game_settings_v2') || '{}');
    this.adultBpm = saved.adultBpm || saved.bpm || 183;
    this.childBpm = saved.childBpm || 140;
    this.bpm = window.rosterManager.activeGroup === 'child' ? this.childBpm : this.adultBpm;
    window.beatAudio.setPlaybackRateByBpm(this.bpm);
    this.roundsPerLevel = saved.rounds || 3;
    this.warmupPickCount = parseInt(saved.warmupPickCount) || 2;
    this.offsetMs = saved.offsetMs || 0;
    this.introSec = typeof saved.introSec === 'number' ? saved.introSec : 0;
    this.gapBeats = typeof saved.gapBeats === 'number' ? saved.gapBeats : 0;
    this.sabotageEnabled = typeof saved.sabotageEnabled === 'boolean' ? saved.sabotageEnabled : true;
    this.currentRound = 1;

    this.isPlaying = false;
    this.timerId = null;
    this.currentRoundCells = []; // 當前 8 格同學資料 (索引 0~7)
    this.currentStep = 0;        // 當前拍數 (0~3 預備拍，4~11 挑戰拍 8 格)
    this.totalStepsInRound = 12; // 4 拍預備 + 8 拍依序唸出 8 格

    // 計分與裁判
    this.score = 0;
    this.penaltyDrinks = 0;

    this.initElements();
    this.bindEvents();
    this.setupNewRound();
    this.startBarragePolling();
  }

  initElements() {
    this.gridContainer = document.getElementById('gridContainer');
    this.btnToggle = document.getElementById('btnToggle');
    this.btnRedraw = document.getElementById('btnRedraw');
    this.promptText = document.getElementById('promptText');
    this.beatDots = document.querySelectorAll('.beat-dot');
    this.levelTabs = document.querySelectorAll('.level-tab[data-level]');
    this.rosterGroupMainTabs = document.querySelectorAll('.level-tab[data-roster-group]');
    this.warmupCountSelectWrap = document.getElementById('warmupCountSelectWrap');
    this.selectWarmupCount = document.getElementById('selectWarmupCount');
    if (this.selectWarmupCount) {
      this.selectWarmupCount.value = String(this.warmupPickCount);
    }

    // 房間徽章與手機報名連結
    const roomBadge = document.getElementById('roomBadgeDisplay');
    const linkJoinPage = document.getElementById('linkJoinPage');
    const joinRoomText = document.getElementById('joinRoomText');
    this.onlineCountBadge = document.getElementById('onlineCountBadge');
    const curRoom = window.rosterManager ? window.rosterManager.roomId : 'DEFAULT';
    if (roomBadge) roomBadge.innerText = `場次: ${curRoom}`;
    if (joinRoomText) joinRoomText.innerText = curRoom;
    if (linkJoinPage) linkJoinPage.href = `join.html?room=${encodeURIComponent(curRoom)}`;
    this.startOnlineCountHeartbeat();

    // 關卡 70% 抽屜預覽視窗元件
    this.drawerOverlay = document.getElementById('drawerOverlay');
    this.levelPreviewDrawer = document.getElementById('levelPreviewDrawer');
    this.drawerTitle = document.getElementById('drawerTitle');
    this.drawerHint = document.getElementById('drawerHint');
    this.drawerPoolGrid = document.getElementById('drawerPoolGrid');
    this.btnCloseDrawer = document.getElementById('btnCloseDrawer');

    // 背景音樂按鈕
    this.btnMusicToggle = document.getElementById('btnMusicToggle');
    this.musicStatusText = document.getElementById('musicStatusText');
    this.roundEl = document.getElementById('roundValue');
    this.bpmEl = document.getElementById('bpmValue');

    // 設定 Modal
    this.modalSettings = document.getElementById('modalSettings');
    this.sliderBpm = document.getElementById('sliderBpm');
    this.sliderBpmVal = document.getElementById('sliderBpmVal');
    this.sliderGap = document.getElementById('sliderGap');
    this.sliderGapVal = document.getElementById('sliderGapVal');
    this.sliderOffset = document.getElementById('sliderOffset');
    this.sliderOffsetVal = document.getElementById('sliderOffsetVal');
    this.sliderIntro = document.getElementById('sliderIntro');
    this.sliderIntroVal = document.getElementById('sliderIntroVal');
    this.selectRounds = document.getElementById('selectRounds');
    this.checkSabotage = document.getElementById('checkSabotage');
    this.btnSabotageToggle = document.getElementById('btnSabotageToggle');
    this.sabotageStatusText = document.getElementById('sabotageStatusText');
    this.ytStatusText = document.getElementById('ytStatusText');

    // 裁判統計
    this.scoreEl = document.getElementById('scoreValue');
    this.penaltyEl = document.getElementById('penaltyValue');
    this.btnSuccess = document.getElementById('btnSuccess');
    this.btnWrong = document.getElementById('btnWrong');
    this.btnResetScore = document.getElementById('btnResetScore');

    // 投影與全螢幕
    this.btnFullscreen = document.getElementById('btnFullscreen');

    // 名冊 Modal
    this.btnRoster = document.getElementById('btnRoster');
    this.rosterBtnLabel = document.getElementById('rosterBtnLabel');
    this.modalRoster = document.getElementById('modalRoster');
    this.btnGroupAdult = document.getElementById('btnGroupAdult');
    this.btnGroupChild = document.getElementById('btnGroupChild');
    this.btnCloseModal = document.getElementById('btnCloseModal');
    this.rosterGrid = document.getElementById('rosterGrid');
    this.btnBatchUpload = document.getElementById('btnBatchUpload');
    this.btnAddPerson = document.getElementById('btnAddPerson');
    this.batchFileInput = document.getElementById('batchFileInput');
    this.btnResetRoster = document.getElementById('btnResetRoster');
    this.checkOnlyUploaded = document.getElementById('checkOnlyUploaded');
    this.uploadedCountLabel = document.getElementById('uploadedCountLabel');

    // 單張換照隱藏 input
    this.singleFileInput = document.getElementById('singleFileInput');
    this.editingStudentIndex = -1;

    // Toast & 即時彈幕層
    this.toastNotice = document.getElementById('toastNotice');
    this.toastText = document.getElementById('toastText');
    this.barrageLayer = document.getElementById('barrageLayer');
    this.lastBarrageId = 0;
  }

  bindEvents() {
    // 關卡切換（點選時彈出右邊 70% 視窗說明該關卡可能出現的圖片）
    this.levelTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const lvl = tab.dataset.level;
        this.switchLevel(lvl);
        this.openLevelPreviewDrawer(lvl);
      });
    });

    // 關閉右側 70% 關卡預覽抽屜
    if (this.btnCloseDrawer) {
      this.btnCloseDrawer.addEventListener('click', () => this.closeLevelPreviewDrawer());
    }
    if (this.drawerOverlay) {
      this.drawerOverlay.addEventListener('click', () => this.closeLevelPreviewDrawer());
    }

    // 主畫面大人/小孩題庫快速切換
    this.rosterGroupMainTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchRosterGroup(tab.dataset.rosterGroup);
      });
    });

    // 熱身模式抽圖數量自選 (2~6)
    if (this.selectWarmupCount) {
      this.selectWarmupCount.addEventListener('change', (e) => {
        this.warmupPickCount = parseInt(e.target.value) || 2;
        const saved = JSON.parse(localStorage.getItem('beat_game_settings_v2') || '{}');
        saved.warmupPickCount = this.warmupPickCount;
        localStorage.setItem('beat_game_settings_v2', JSON.stringify(saved));
        this.setupNewRound();
        this.showToast(`🎲 熱身模式已設定每局隨機抽取 ${this.warmupPickCount} 種圖片！`, '#00d2ff');
      });
    }

    // 開始 / 暫停按鈕 & 重新抽圖片按鈕
    this.btnToggle.addEventListener('click', () => {
      this.togglePlay();
    });
    if (this.btnRedraw) {
      this.btnRedraw.addEventListener('click', () => {
        this.setupNewRound();
        this.showToast('🎲 已重新抽取 8 宮格圖片！', '#00d2ff');
      });
    }

    // 全部音效開關
    this.btnMusicToggle.addEventListener('click', () => {
      const audio = window.beatAudio;
      audio.setMuted(!audio.isMuted);
      this.musicStatusText.innerText = audio.isMuted ? '🔇' : '🔊';
      if (!audio.isMuted && this.isPlaying) audio.playBGM();
      this.showToast(audio.isMuted ? '🔇 已靜音' : '🔊 音效已開啟', audio.isMuted ? '#ffaa00' : '#00ff88');
    });

    // 設定 Modal
    document.getElementById('btnSettings').addEventListener('click', () => this.openSettings());
    document.getElementById('btnCloseSettings').addEventListener('click', () => this.modalSettings.classList.remove('open'));
    this.modalSettings.addEventListener('click', (e) => { if (e.target === this.modalSettings) this.modalSettings.classList.remove('open'); });
    this.sliderBpm.addEventListener('input', () => { this.sliderBpmVal.innerText = `${this.sliderBpm.value} BPM`; });
    this.sliderGap.addEventListener('input', () => { this.sliderGapVal.innerText = `${this.sliderGap.value} 拍`; });
    this.sliderOffset.addEventListener('input', () => { this.sliderOffsetVal.innerText = `${this.sliderOffset.value} ms`; });
    this.sliderIntro.addEventListener('input', () => { this.sliderIntroVal.innerText = `${this.sliderIntro.value} s`; });
    const inputCustomBgm = document.getElementById('inputCustomBgm');
    if (inputCustomBgm) {
      inputCustomBgm.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (f) { window.beatAudio.setCustomAudioFile(f); this.showToast(`🎵 已載入：${f.name}`, '#00ff88'); }
      });
    }
    document.getElementById('btnSaveSettings').addEventListener('click', () => this.saveSettings());
    if (this.btnSabotageToggle) {
      this.btnSabotageToggle.addEventListener('click', () => {
        this.setSabotageEnabled(!this.sabotageEnabled, true);
      });
    }
    this.syncSabotageUI();
    this.updateInfo();

    // 空白鍵快捷鍵控制
    window.addEventListener('keydown', (e) => {
      // 若在輸入框內打字則不觸發
      if (e.target.tagName === 'INPUT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === '1') {
        this.switchLevel('1');
      } else if (e.key === '2') {
        this.switchLevel('2');
      } else if (e.key === '3') {
        this.switchLevel('3');
      } else if (e.key === '4') {
        this.switchLevel('w1');
      } else if (e.key === '5') {
        this.switchLevel('w2');
      } else if (e.key === '6') {
        this.switchLevel('w3');
      } else if (e.code === 'ArrowUp' || e.key === 'o' || e.key === 'O') {
        this.recordSuccess();
      } else if (e.code === 'ArrowDown' || e.key === 'x' || e.key === 'X') {
        this.recordWrong();
      } else if (e.key === 'r' || e.key === 'R') {
        this.setupNewRound();
        this.showToast('🎲 已重新抽取 8 宮格圖片！', '#00d2ff');
      }
    });

    // 裁判按鈕
    this.btnSuccess.addEventListener('click', () => this.recordSuccess());
    this.btnWrong.addEventListener('click', () => this.recordWrong());
    if (this.btnResetScore) {
      this.btnResetScore.addEventListener('click', () => this.resetScore());
    }

    // 全螢幕投影切換
    this.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());

    // 名冊 Modal 開關與大人/小孩分組切換
    this.btnRoster.addEventListener('click', () => this.openRosterModal());
    this.btnCloseModal.addEventListener('click', () => this.closeRosterModal());
    this.modalRoster.addEventListener('click', (e) => {
      if (e.target === this.modalRoster) this.closeRosterModal();
    });
    if (this.btnGroupAdult) {
      this.btnGroupAdult.addEventListener('click', () => this.switchRosterGroup('adult'));
    }
    if (this.btnGroupChild) {
      this.btnGroupChild.addEventListener('click', () => this.switchRosterGroup('child'));
    }
    if (this.checkOnlyUploaded) {
      this.checkOnlyUploaded.addEventListener('change', (e) => {
        const rm = window.rosterManager;
        rm.setOnlyUploaded(e.target.checked);
        this.syncRosterGroupUI();
        this.setupNewRound();
        const cnt = rm.getUploadedCount();
        if (e.target.checked && cnt === 0) {
          this.showToast('⚠️ 目前尚無已上傳照片的人物，將暫時使用預設角色', '#ffaa00');
        } else {
          this.showToast(e.target.checked ? `✅ 已設定僅從已上傳的 ${cnt} 位人物中抽取` : '👥 已恢復從全部名冊中抽取', '#00ff88');
        }
      });
    }
    this.syncRosterGroupUI();

    // 批次換照與手動新增名額
    this.btnBatchUpload.addEventListener('click', () => {
      this.batchFileInput.click();
    });
    if (this.btnAddPerson) {
      this.btnAddPerson.addEventListener('click', () => {
        const rm = window.rosterManager;
        const newIdx = rm.addStudent();
        this.renderRosterCards();
        this.setupNewRound();
        this.showToast(`➕ 已新增 ${rm.groupLabel} #${newIdx + 1}（目前共 ${rm.roster.length} 位）`, '#00ff88');
      });
    }
    this.batchFileInput.addEventListener('change', (e) => this.handleBatchUpload(e));

    // 單張換照
    this.singleFileInput.addEventListener('change', (e) => this.handleSingleUpload(e));

    // 重設名冊
    this.btnResetRoster.addEventListener('click', () => {
      const rm = window.rosterManager;
      if (confirm(`確定要還原「${rm.groupLabel}（${rm.maxCount}位）」為預設姓名與向量頭像嗎？`)) {
        rm.resetToDefault();
        this.renderRosterCards();
        this.setupNewRound();
        this.showToast(`✅ ${rm.groupLabel}名冊已恢復預設！`);
      }
    });
  }

  openSettings() {
    const a = window.beatAudio;
    this.sliderBpm.value = this.bpm;
    this.sliderBpmVal.innerText = `${this.bpm} BPM`;
    this.sliderGap.value = this.gapBeats;
    this.sliderGapVal.innerText = `${this.gapBeats} 拍`;
    this.sliderOffset.value = this.offsetMs;
    this.sliderOffsetVal.innerText = `${this.offsetMs} ms`;
    this.sliderIntro.value = this.introSec;
    this.sliderIntroVal.innerText = `${this.introSec} s`;
    this.selectRounds.value = String(this.roundsPerLevel);
    if (this.checkSabotage) this.checkSabotage.checked = this.sabotageEnabled;
    this.modalSettings.classList.add('open');
  }

  syncSabotageUI() {
    if (this.sabotageStatusText) {
      this.sabotageStatusText.innerText = this.sabotageEnabled ? '開啟' : '關閉';
    }
    if (this.checkSabotage) {
      this.checkSabotage.checked = this.sabotageEnabled;
    }
  }

  setSabotageEnabled(enabled, showNotice = false) {
    this.sabotageEnabled = !!enabled;
    this.syncSabotageUI();
    localStorage.setItem('beat_game_settings_v2', JSON.stringify({
      bpm: this.bpm, adultBpm: this.adultBpm, childBpm: this.childBpm, rounds: this.roundsPerLevel, offsetMs: this.offsetMs, introSec: this.introSec, gapBeats: this.gapBeats, sabotageEnabled: this.sabotageEnabled
    }));
    if (location.protocol !== 'file:') {
      const roomId = window.rosterManager ? window.rosterManager.roomId : 'DEFAULT';
      fetch(`/api/sabotage-config?room=${encodeURIComponent(roomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: this.sabotageEnabled })
      }).catch(() => {});
    }
    if (showNotice) {
      this.showToast(this.sabotageEnabled ? '😈 已開啟玩家干擾道具功能' : '🛡️ 已關閉玩家干擾道具功能', this.sabotageEnabled ? '#00ff88' : '#ffaa00');
    }
  }

  saveSettings() {
    const a = window.beatAudio;
    this.bpm = parseFloat(this.sliderBpm.value);
    if (window.rosterManager.activeGroup === 'child') {
      this.childBpm = this.bpm;
    } else {
      this.adultBpm = this.bpm;
    }
    a.setPlaybackRateByBpm(this.bpm);
    this.gapBeats = parseFloat(this.sliderGap.value);
    this.offsetMs = parseInt(this.sliderOffset.value);
    this.introSec = parseFloat(this.sliderIntro.value);
    this.roundsPerLevel = parseInt(this.selectRounds.value);
    const sab = this.checkSabotage ? this.checkSabotage.checked : this.sabotageEnabled;
    this.setSabotageEnabled(sab, false);
    this.currentRound = Math.min(this.currentRound, this.roundsPerLevel);
    this.updateInfo();
    this.modalSettings.classList.remove('open');
    this.showToast('✅ 設定已儲存', '#00ff88');
  }

  // 啟動房間心跳與在線人數更新
  startOnlineCountHeartbeat() {
    if (location.protocol === 'file:') return;
    const curRoom = window.rosterManager ? window.rosterManager.roomId : 'DEFAULT';
    const sid = window.rosterManager ? window.rosterManager.sessionId : 'host_anon';
    const updateCount = async () => {
      try {
        const res = await fetch(`/api/room/heartbeat?room=${encodeURIComponent(curRoom)}&sid=${encodeURIComponent(sid)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (this.onlineCountBadge && typeof data.onlineCount === 'number') {
          this.onlineCountBadge.innerHTML = `🟢 <b>${data.onlineCount}</b> 人在線`;
        }
      } catch (e) {}
    };
    updateCount();
    setInterval(updateCount, 3000);
  }

  // 打開右側 70% 關卡候選圖片視窗
  openLevelPreviewDrawer(levelKey) {
    if (!this.levelPreviewDrawer) return;
    const cfg = this.bpmLevels[levelKey];
    if (!cfg) return;

    const pool = cfg.pool ? [...cfg.pool] : window.rosterManager.getCandidatePool();
    const groupName = window.rosterManager.groupLabel;

    this.drawerTitle.innerHTML = `<span>🎯 ${cfg.label}</span>`;
    if (cfg.dynamicWarmup) {
      const warmupCount = Math.max(2, Math.min(6, this.warmupPickCount || 2));
      this.drawerHint.innerHTML = `💡 此熱身關卡固定由以下 <b>${pool.length}</b> 種圖片中，依設定隨機抽取 <b>${warmupCount}</b> 種圖片排列於 8 宮格：`;
    } else {
      this.drawerHint.innerHTML = `💡 目前為「${groupName}題庫」，隨機從以下候選名冊（共 <b>${pool.length}</b> 位）中抽取 <b>${cfg.count}</b> 位排列於 8 宮格：`;
    }

    this.drawerPoolGrid.innerHTML = '';
    pool.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'drawer-item-card';
      card.innerHTML = `
        <img class="drawer-item-img" src="${item.avatar}" alt="${item.name}">
        <div class="drawer-item-name">${item.name}</div>
      `;
      this.drawerPoolGrid.appendChild(card);
    });

    this.drawerOverlay.classList.add('open');
    this.levelPreviewDrawer.classList.add('open');
  }

  closeLevelPreviewDrawer() {
    if (this.drawerOverlay) this.drawerOverlay.classList.remove('open');
    if (this.levelPreviewDrawer) this.levelPreviewDrawer.classList.remove('open');
  }

  updateInfo() {
    if (this.roundEl) this.roundEl.innerText = `${this.currentRound} / ${this.roundsPerLevel}`;
    if (this.bpmEl) this.bpmEl.innerText = this.bpm;
  }

  switchLevel(level) {
    const lvl = String(level);
    if (this.currentLevel === lvl) return;
    this.currentLevel = lvl;
    this.currentRound = 1;
    this.updateInfo();
    this.levelTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.level === lvl);
    });

    const isWarmup = lvl.startsWith('w');
    if (this.warmupCountSelectWrap) {
      this.warmupCountSelectWrap.style.display = isWarmup ? 'inline-flex' : 'none';
    }

    const isRunning = this.isPlaying;
    this.stopGame();
    this.setupNewRound();

    if (isRunning) {
      this.startGame();
    }
  }

  // 關卡規則：
  // Level 1: 簡單 2 位 (固定取前 2 位，輪流或分佈在 8 格)
  // Level 2: 隨機即選 3 位 (從名冊隨機挑 3 位，混合填入 8 格)
  // Level 3: 隨機選 4 位 (從名冊隨機挑 4 位，混合填入 8 格)
  setupNewRound() {
    const cfg = this.bpmLevels[this.currentLevel] || this.bpmLevels['1'];
    const pool = cfg.pool ? [...cfg.pool] : window.rosterManager.getCandidatePool();
    // 熱身關卡：可自選隨機抽出圖片數目 (2~6 種，預設 2 種)
    let pickCount = cfg.count;
    if (cfg.dynamicWarmup) {
      pickCount = Math.max(2, Math.min(6, this.warmupPickCount || 2));
    }
    const selectedStudents = pool.sort(() => 0.5 - Math.random()).slice(0, Math.min(pickCount, pool.length));

    // 填滿 8 格圖片：確保挑選的人員都有出現，其餘隨機分佈填滿 8 格
    const cells = [];
    selectedStudents.forEach(stu => cells.push(stu));
    while (cells.length < 8) {
      const pick = selectedStudents[Math.floor(Math.random() * selectedStudents.length)];
      cells.push(pick);
    }
    // 打亂這 8 格的位置分佈
    this.currentRoundCells = cells.sort(() => 0.5 - Math.random());

    this.renderGrid();
  }

  renderGrid() {
    this.gridContainer.innerHTML = '';
    this.currentRoundCells.forEach((student, index) => {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.id = `grid-cell-${index}`;

      cell.innerHTML = `
        <span class="cell-badge">#${index + 1}</span>
        <div class="cell-avatar-wrap">
          <img class="cell-avatar" src="${student.avatar}" alt="${student.name}" />
        </div>
      `;
      this.gridContainer.appendChild(cell);
    });
  }

  togglePlay() {
    window.beatAudio.init();
    if (this.isPlaying) {
      this.stopGame();
    } else {
      this.startGame();
    }
  }

  startGame() {
    this.isPlaying = true;
    this.btnToggle.innerHTML = '⏸ 暫停 (Space)';
    this.btnToggle.classList.remove('btn-primary');
    this.btnToggle.classList.add('btn-danger');

    // 啟動背景音樂 (YouTube / 自訂音檔)，並依據大人(183 BPM)或小孩(140 BPM)同步調整音樂播放速度
    window.beatAudio.setPlaybackRateByBpm(this.bpm);
    window.beatAudio.playBGM();
    if (window.beatAudio.ytError && window.beatAudio.useYoutube && !window.beatAudio.customAudio) {
      this.showToast(`⚠️ ${window.beatAudio.ytError}，改用內建節拍`, '#ffaa00');
    }

    this.currentRound = 1;
    this.currentStep = -1;
    this.startTimeMs = performance.now();
    this.syncAnchorMs = null;
    this.lastBgmSec = null;
    this.lastBgmChangeMs = performance.now();
    this.lastObservedBgmSec = null;
    this.loopOffsetSec = 0; // 處理 beats.mp3 自動循環時的累計時間
    this.bgmFailed = false;
    this.setupNewRound();
    this.clearAllHighlights();
    this.runBeatLoop();
  }

  stopGame() {
    this.isPlaying = false;
    cancelAnimationFrame(this.timerId);
    this.timerId = null;
    this.btnToggle.innerHTML = '▶ 開始卡點 (Space)';
    this.btnToggle.classList.remove('btn-danger');
    this.btnToggle.classList.add('btn-primary');

    // 暫停 YouTube 背景音樂
    window.beatAudio.pauseBGM();

    this.clearAllHighlights();
    if (this.promptText) this.promptText.innerText = '按空白鍵開始卡點！';
    this.resetBeatDots();
  }

  runBeatLoop() {
    if (!this.isPlaying) return;

    const a = window.beatAudio;
    const usingYt = a.useYoutube && a.isYtReady && !a.customAudio && !a.ytError;
    const bgmSec = a.getBGMTimeSec();

    // 若以 YouTube 為主且還在緩衝中，先等待 YouTube 真正出聲，避免畫面搶跑
    if (usingYt && bgmSec === null) {
      if (this.promptText) this.promptText.innerText = '⏳ 等待 YouTube 音軌同步中...';
      this.timerId = requestAnimationFrame(() => this.runBeatLoop());
      return;
    }

    // bc.aeiou.tw 節拍算法：183 BPM，每局 16 拍 (前 8 拍預備聽拍 + 後 8 拍依序亮第 1~8 格，每格 1 拍)
    const beatSec = 60 / this.bpm;
    const totalBeatsPerRound = 16 + this.gapBeats;
    const roundSec = beatSec * totalBeatsPerRound;

    let rawSec;
    // 本地 beats.mp3 使用固定 183 BPM 格線對齊：由於 playbackRate 已隨 this.bpm 同步縮放，
    // currentTime 本身就會以放慢/加快後的速度推進，因此用音軌原生 beatSec (60/183) 計算拍點即可完美對拍！
    const now = performance.now();
    const isBufferPlaying = a.isBgmPlaying && a.bufferSource;
    let isBgmAdvancing = false;
    if (isBufferPlaying) {
      isBgmAdvancing = true;
    } else if (bgmSec !== null && !this.bgmFailed) {
      if (this.lastObservedBgmSec === null || bgmSec !== this.lastObservedBgmSec) {
        this.lastObservedBgmSec = bgmSec;
        this.lastBgmChangeMs = now;
        isBgmAdvancing = true;
      } else if (now - this.lastBgmChangeMs < 400) {
        isBgmAdvancing = true;
      } else {
        isBgmAdvancing = false;
      }
    }

    const hasValidBgm = isBgmAdvancing;
    const audioBeatSec = (!usingYt && hasValidBgm) ? (60 / 183) : beatSec;
    const audioRoundSec = audioBeatSec * totalBeatsPerRound;

    if (isBufferPlaying && bgmSec !== null) {
      // Web Audio AudioBufferSourceNode 零延遲時鐘
      rawSec = bgmSec;
    } else if (!usingYt && hasValidBgm) {
      if (this.lastBgmSec !== null && bgmSec < this.lastBgmSec - 1) {
        const dur = (a.audioBuffer && a.audioBuffer.duration) || (a.customAudio && a.customAudio.duration) || this.lastBgmSec;
        this.loopOffsetSec += dur;
      }
      this.lastBgmSec = bgmSec;
      rawSec = this.loopOffsetSec + bgmSec;
    } else if (hasValidBgm) {
      if (this.syncAnchorMs === null) {
        this.syncAnchorMs = now - bgmSec * 1000;
        this.lastBgmSec = bgmSec;
      } else if (bgmSec !== this.lastBgmSec) {
        this.lastBgmSec = bgmSec;
        const targetAnchor = now - bgmSec * 1000;
        const diff = targetAnchor - this.syncAnchorMs;
        this.syncAnchorMs = Math.abs(diff) > 1000 ? targetAnchor : this.syncAnchorMs + diff * 0.25;
      }
      rawSec = (now - this.syncAnchorMs) / 1000;
    } else {
      rawSec = (now - this.startTimeMs) / 1000;
    }

    const elapsedSec = rawSec - this.introSec - (this.offsetMs / 1000);

    if (elapsedSec < 0) {
      if (this.promptText) this.promptText.innerText = '🎵 前奏鼓點中，準備開始...';
      this.timerId = requestAnimationFrame(() => this.runBeatLoop());
      return;
    }

    const roundIdx = Math.floor(elapsedSec / audioRoundSec) + 1;
    if (roundIdx > this.roundsPerLevel) {
      this.stopGame();
      this.currentRound = 1;
      this.updateInfo();
      this.setupNewRound();
      window.beatAudio.playSuccessSound();
      this.showToast(`🏆 ${this.bpmLevels[this.currentLevel].label} 完成 ${this.roundsPerLevel} 局！`, '#00ff88');
      return;
    }

    if (roundIdx !== this.currentRound) {
      this.currentRound = roundIdx;
      this.currentStep = -1;
      this.updateInfo();
      this.setupNewRound();
    }

    const inRoundSec = elapsedSec % audioRoundSec;
    const beatInRound = inRoundSec / audioBeatSec; // 0.0 ~ 16.0 (前 8 拍預備，後 8 拍亮 8 格)
    if (beatInRound >= 16) {
      if (this.currentStep !== 12) {
        this.currentStep = 12;
        this.clearAllHighlights();
      }
      this.timerId = requestAnimationFrame(() => this.runBeatLoop());
      return;
    }
    const step = beatInRound < 8
      ? Math.floor(beatInRound / 2)           // 0, 1, 2, 3 (前 8 拍預備)
      : 4 + Math.floor(beatInRound - 8);      // 4..11 (後 8 拍，每 1 拍亮 1 格！)

    if (step !== this.currentStep && step >= 0 && step < this.totalStepsInRound) {
      this.currentStep = step;
      this.processBeatStep(step);
    }

    this.timerId = requestAnimationFrame(() => this.runBeatLoop());
  }

  processBeatStep(step) {
    this.clearAllHighlights();
    // 熱血編曲：鼓組 + Bass + 和弦 + 上升音效，依步驟自動編排
    window.beatAudio.playMusicStep(step, 60 / this.bpm, this.currentRound);

    // 前 4 拍：預備拍（1, 2, 3, GO）
    if (step < 4) {
      this.updateBeatDots(step, true);

      if (step === 0) {
        if (this.promptText) this.promptText.innerText = '預備～ (1)';
        window.beatAudio.speak('預備 一 二 三 GO');
      } else if (step === 1) {
        if (this.promptText) this.promptText.innerText = '備～ (2)';
      } else if (step === 2) {
        if (this.promptText) this.promptText.innerText = '備～ (3)';
      } else if (step === 3) {
        if (this.promptText) this.promptText.innerText = 'GO！ 由左至右開始！';
      }
    } 
    // 後 8 拍：挑戰拍，依序「由左至右、由上往下」卡點跳耀 8 格 (0 ~ 7)
    else {
      const challengeBeatIndex = step - 4; // 0 到 7，對應 8 格
      this.updateBeatDots(challengeBeatIndex, false);

      const targetCellIndex = challengeBeatIndex; // 依序 0, 1, 2, 3, 4, 5, 6, 7
      const targetStudent = this.currentRoundCells[targetCellIndex];

      if (this.promptText) this.promptText.innerText = `第 ${targetCellIndex + 1} 格 👉【 ${targetStudent.name} 】`;

      // 節奏鼓點 + 8 格哨音

      for (let i = 0; i < targetCellIndex; i++) {
        const c = document.getElementById(`grid-cell-${i}`);
        if (c) c.classList.add('box-passed');
      }

      // 高亮當前跳耀到的格子 (由左至右、由上往下)
      const activeCell = document.getElementById(`grid-cell-${targetCellIndex}`);
      if (activeCell) {
        activeCell.classList.add('on-beat-active');
      }
    }
  }

  clearAllHighlights() {
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(c => c.classList.remove('on-beat-active', 'box-passed'));
  }

  updateBeatDots(beatIndex, isPrep) {
    this.beatDots.forEach((dot, idx) => {
      dot.className = 'beat-dot';
      if (idx <= beatIndex) {
        dot.classList.add(isPrep ? 'prep' : 'active');
      }
    });
  }

  resetBeatDots() {
    this.beatDots.forEach(dot => {
      dot.className = 'beat-dot';
    });
  }

  // 裁判功能
  recordSuccess() {
    this.score++;
    this.scoreEl.innerText = this.score;
    window.beatAudio.playSuccessSound();
    this.showToast('🎉 卡點成功！+1 分', '#00ff88');
  }

  recordWrong() {
    this.penaltyDrinks++;
    this.penaltyEl.innerText = this.penaltyDrinks;
    window.beatAudio.playFailSound();
    this.showToast('❌ 挑戰失敗！', '#ff007f');
  }

  resetScore() {
    this.score = 0;
    this.penaltyDrinks = 0;
    this.scoreEl.innerText = '0';
    this.penaltyEl.innerText = '0';
    this.showToast('🔄 分數與挑戰失敗次數已歸零重新計算！', '#00d2ff');
  }

  showToast(text, color = '#ff007f') {
    this.toastText.innerText = text;
    this.toastNotice.style.background = color;
    this.toastNotice.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastNotice.classList.remove('show');
    }, 2200);
  }

  // 全螢幕投影切換
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        alert(`無法進入全螢幕：${err.message}`);
      });
      this.btnFullscreen.innerHTML = '🔲 退出全螢幕';
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      this.btnFullscreen.innerHTML = '📺 全螢幕投影';
    }
  }

  // 名冊管理 Modal
  syncRosterGroupUI() {
    const rm = window.rosterManager;
    const isAdult = rm.activeGroup === 'adult';
    if (this.btnGroupAdult) this.btnGroupAdult.classList.toggle('btn-primary', isAdult);
    if (this.btnGroupChild) this.btnGroupChild.classList.toggle('btn-primary', !isAdult);
    if (this.rosterGroupMainTabs) {
      this.rosterGroupMainTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.rosterGroup === rm.activeGroup);
      });
    }
    if (this.btnBatchUpload) {
      this.btnBatchUpload.innerText = `📁 批次選取${rm.groupLabel}照片 (超過 ${rm.roster.length} 張會自動新增)`;
    }
    if (this.btnGroupAdult) {
      this.btnGroupAdult.innerText = `🧑 大人 (${rm.rosters.adult.length} 位)`;
    }
    if (this.btnGroupChild) {
      this.btnGroupChild.innerText = `🧒 小孩 (${rm.rosters.child.length} 位)`;
    }
    const mainAdult = document.getElementById('tabMainAdult');
    const mainChild = document.getElementById('tabMainChild');
    if (mainAdult) mainAdult.innerHTML = `<span>🧑 大人題庫 (${rm.rosters.adult.length}人)</span>`;
    if (mainChild) mainChild.innerHTML = `<span>🧒 小孩題庫 (${rm.rosters.child.length}人)</span>`;
    if (this.rosterBtnLabel) {
      this.rosterBtnLabel.innerText = `${rm.groupLabel} ${rm.roster.length}人`;
    }
    if (this.checkOnlyUploaded) {
      this.checkOnlyUploaded.checked = rm.onlyUploaded;
    }
    if (this.uploadedCountLabel) {
      this.uploadedCountLabel.innerText = `已上傳 ${rm.getUploadedCount()} 位`;
    }
  }

  switchRosterGroup(group) {
    window.rosterManager.setGroup(group);
    // 切換為小孩題庫時自動放慢為適合小朋友的 140 BPM，大人題庫則恢復 183 BPM
    this.bpm = group === 'child' ? (this.childBpm || 140) : (this.adultBpm || 183);
    window.beatAudio.setPlaybackRateByBpm(this.bpm);
    this.updateInfo();
    this.syncRosterGroupUI();
    this.renderRosterCards();
    this.setupNewRound();
    const rm = window.rosterManager;
    this.showToast(`👥 已切換為「${rm.groupLabel}題庫」• 速度自動調整為 ${this.bpm} BPM`, '#00d2ff');
  }

  openRosterModal() {
    this.syncRosterGroupUI();
    this.renderRosterCards();
    this.modalRoster.classList.add('open');
  }

  closeRosterModal() {
    this.modalRoster.classList.remove('open');
    this.setupNewRound(); // 更新名冊後刷新當前遊戲格
  }

  renderRosterCards() {
    this.rosterGrid.innerHTML = '';
    this.syncRosterGroupUI();
    const roster = window.rosterManager.roster;

    roster.forEach((student, index) => {
      const card = document.createElement('div');
      card.className = 'roster-card';
      card.innerHTML = `
        <span class="roster-card-num">#${student.id}</span>
        <button type="button" class="roster-card-del" title="刪除此人員照片與名字（還原為預設空位）" data-index="${index}">🗑️</button>
        <div class="roster-avatar-wrap" title="點擊更換此同學照片">
          <img src="${student.avatar}" alt="${student.name}" id="roster-img-${index}" />
        </div>
        <input type="text" class="roster-name-input" value="${student.name}" placeholder="輸入名字" data-index="${index}" />
      `;

      // 綁定單人刪除（還原為預設空位，避免操作錯誤或重複）
      const delBtn = card.querySelector('.roster-card-del');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.rosterManager.deleteStudent(index);
        this.renderRosterCards();
        this.setupNewRound();
        this.showToast(`🗑️ 已刪除並重置 #${index + 1} 資料`, '#ffaa00');
      });

      // 綁定單張更換相片
      const avatarWrap = card.querySelector('.roster-avatar-wrap');
      avatarWrap.addEventListener('click', () => {
        this.editingStudentIndex = index;
        this.singleFileInput.click();
      });

      // 綁定即時修改姓名
      const input = card.querySelector('.roster-name-input');
      input.addEventListener('change', (e) => {
        const newName = e.target.value;
        window.rosterManager.updateStudent(index, newName);
        // 若為自動向量圖，刷新頭像
        const img = document.getElementById(`roster-img-${index}`);
        img.src = window.rosterManager.roster[index].avatar;
      });

      this.rosterGrid.appendChild(card);
    });
  }

  // 批次上傳多張照片 (若選取數量超過目前人數，自動往後新增名額！)
  async handleBatchUpload(e) {
    const rm = window.rosterManager;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    this.showToast(`📸 正在批次處理 ${files.length} 張${rm.groupLabel}照片...`, '#00d2ff');

    for (let i = 0; i < files.length; i++) {
      try {
        const compressedBase64 = await RosterManager.compressImage(files[i], 240, 0.88);
        if (i >= rm.roster.length) {
          rm.addStudent(null, compressedBase64);
        } else {
          rm.updateStudent(i, null, compressedBase64);
        }
      } catch (err) {
        console.error(`第 ${i + 1} 張照片讀取失敗:`, err);
      }
    }

    this.renderRosterCards();
    this.setupNewRound();
    this.showToast(`🎉 成功更新 ${files.length} 位${rm.groupLabel}照片（共 ${rm.roster.length} 位）！`, '#00ff88');
    this.batchFileInput.value = '';
  }

  // 單張上傳照片
  async handleSingleUpload(e) {
    const file = e.target.files[0];
    if (!file || this.editingStudentIndex < 0) return;

    try {
      const compressedBase64 = await RosterManager.compressImage(file, 180, 0.75);
      window.rosterManager.updateStudent(this.editingStudentIndex, null, compressedBase64);
      this.renderRosterCards();
      this.showToast(`✅ 已更新 #${this.editingStudentIndex + 1} 同學照片！`, '#00ff88');
    } catch (err) {
      alert("圖片讀取失敗，請重試");
    }
    this.singleFileInput.value = '';
    this.editingStudentIndex = -1;
  }

  // 輪詢伺服器端玩家發送的即時 Emoji / 圖片 / 文字彈幕，隨機位置浮動顯示 3 秒後自動消失
  startBarragePolling() {
    if (location.protocol === 'file:') return;
    const roomId = window.rosterManager ? window.rosterManager.roomId : 'DEFAULT';
    // 啟動時先將本機設定的干擾開關同步給伺服器
    this.setSabotageEnabled(this.sabotageEnabled, false);
    // 先取得目前最新 ID，避免載入舊彈幕
    fetch(`/api/barrage?room=${encodeURIComponent(roomId)}&since=0`)
      .then(r => r.json())
      .then(d => { if (typeof d.lastId === 'number') this.lastBarrageId = d.lastId; })
      .catch(() => {});

    setInterval(async () => {
      try {
        const res = await fetch(`/api/barrage?room=${encodeURIComponent(roomId)}&since=${this.lastBarrageId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          data.items.forEach(item => {
            if (item.id > this.lastBarrageId) this.lastBarrageId = item.id;
            this.spawnFloatingBarrage(item);
          });
        }
      } catch (e) {}
    }, 600);
  }

  spawnFloatingBarrage(item) {
    if (!this.barrageLayer) return;

    // 支援遊戲干擾功能 (Sabotage / Interference)，若後台關閉干擾則直接忽略
    if (item.type === 'sabotage') {
      if (this.sabotageEnabled) {
        this.triggerSabotageEffect(item.content, item.sender);
      }
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'barrage-item';

    // 隨機顯示在畫面 12% ~ 88% 範圍內
    const leftPct = 12 + Math.random() * 76;
    const topPct = 18 + Math.random() * 68;
    wrap.style.left = `${leftPct}%`;
    wrap.style.top = `${topPct}%`;

    if (item.type === 'image') {
      const img = document.createElement('img');
      img.className = 'barrage-image';
      img.src = item.content;
      wrap.appendChild(img);
    } else if (item.type === 'text') {
      const txt = document.createElement('div');
      txt.className = 'barrage-text';
      txt.textContent = item.sender ? `${item.sender}：${item.content}` : item.content;
      wrap.appendChild(txt);
    } else {
      const em = document.createElement('div');
      em.className = 'barrage-emoji';
      em.textContent = item.content;
      wrap.appendChild(em);
    }

    if (item.sender && item.type !== 'text') {
      const s = document.createElement('div');
      s.className = 'barrage-sender';
      s.textContent = item.sender;
      wrap.appendChild(s);
    }

    this.barrageLayer.appendChild(wrap);
    // 3 秒動畫結束後自動移除 DOM
    setTimeout(() => {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 3000);
  }

  // 現場玩家發動瑪利歐道具干擾效果 (持續 3 秒後恢復)
  triggerSabotageEffect(effectKey, sender) {
    const who = sender ? `【${sender}】` : '有玩家';
    const grid = this.gridContainer;
    if (!grid) return;

    if (effectKey === 'blooper') {
      // 🦑 魷魚噴墨干擾：畫面上浮現 5 團大黑墨汁遮擋視線 3 秒
      this.showToast(`🦑 ${who}發動了【墨魚噴墨干擾】！`, '#ff007f');
      for (let i = 0; i < 5; i++) {
        const ink = document.createElement('div');
        ink.className = 'sabotage-ink-blot';
        ink.style.left = `${18 + Math.random() * 64}%`;
        ink.style.top = `${22 + Math.random() * 56}%`;
        ink.innerHTML = '🦑';
        this.barrageLayer.appendChild(ink);
        setTimeout(() => { if (ink.parentNode) ink.parentNode.removeChild(ink); }, 3000);
      }
    } else if (effectKey === 'pow') {
      // 💥 POW 磚塊天搖地動：8 宮格劇烈震動搖晃 3 秒
      this.showToast(`💥 ${who}發動了【POW 磚塊大地震】！`, '#ffaa00');
      grid.classList.add('sabotage-pow-shake');
      setTimeout(() => grid.classList.remove('sabotage-pow-shake'), 3000);
    } else if (effectKey === 'flip') {
      // 🙃 顛倒魔鏡：8 宮格圖片上下顛倒旋轉 3 秒
      this.showToast(`🙃 ${who}發動了【顛倒魔鏡干擾】！`, '#a855f7');
      grid.classList.add('sabotage-upside-down');
      setTimeout(() => grid.classList.remove('sabotage-upside-down'), 3000);
    } else if (effectKey === 'boo') {
      // 👻 害羞幽靈迷霧：8 宮格忽明忽暗模糊閃爍 3 秒
      this.showToast(`👻 ${who}發動了【幽靈迷霧干擾】！`, '#00d2ff');
      grid.classList.add('sabotage-boo-fog');
      setTimeout(() => grid.classList.remove('sabotage-boo-fog'), 3000);
    }
  }
}

// 頁面載入完成後初始化
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new BeatPartyGame();
});
