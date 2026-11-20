// app.js - 遊戲主邏輯、關卡節奏控制、裁判系統與 UI 交互

class BeatPartyGame {
  constructor() {
    this.currentLevel = 1; // 1: 92 BPM (2人), 2: 106 BPM (3人), 3: 120 BPM (4人)
    this.bpmLevels = {
      1: { bpm: 92, count: 2, label: "Level 1（簡單模式）" },
      2: { bpm: 106, count: 3, label: "Level 2（進階模式）" },
      3: { bpm: 120, count: 4, label: "Level 3（魔王地獄）" }
    };

    this.isPlaying = false;
    this.timerId = null;
    this.currentRoundCells = []; // 當前 8 格同學資料
    this.beatSequence = [];      // 挑戰拍順序 (索引 0~7)
    this.currentStep = 0;        // 當前拍數 (0~3 預備拍，4~7 挑戰拍)
    this.totalStepsInRound = 8;  // 4 拍預備 + 4 拍挑戰

    // 計分與裁判
    this.score = 0;
    this.penaltyDrinks = 0;

    this.initElements();
    this.bindEvents();
    this.setupNewRound();
  }

  initElements() {
    this.gridContainer = document.getElementById('gridContainer');
    this.btnToggle = document.getElementById('btnToggle');
    this.promptText = document.getElementById('promptText');
    this.beatDots = document.querySelectorAll('.beat-dot');
    this.levelTabs = document.querySelectorAll('.level-tab');

    // 裁判統計
    this.scoreEl = document.getElementById('scoreValue');
    this.penaltyEl = document.getElementById('penaltyValue');
    this.btnSuccess = document.getElementById('btnSuccess');
    this.btnWrong = document.getElementById('btnWrong');

    // 投影與全螢幕
    this.btnFullscreen = document.getElementById('btnFullscreen');

    // 名冊 Modal
    this.btnRoster = document.getElementById('btnRoster');
    this.modalRoster = document.getElementById('modalRoster');
    this.btnCloseModal = document.getElementById('btnCloseModal');
    this.rosterGrid = document.getElementById('rosterGrid');
    this.btnBatchUpload = document.getElementById('btnBatchUpload');
    this.batchFileInput = document.getElementById('batchFileInput');
    this.btnResetRoster = document.getElementById('btnResetRoster');

    // 單張換照隱藏 input
    this.singleFileInput = document.getElementById('singleFileInput');
    this.editingStudentIndex = -1;

    // Toast
    this.toastNotice = document.getElementById('toastNotice');
    this.toastText = document.getElementById('toastText');
  }

  bindEvents() {
    // 關卡切換
    this.levelTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const lvl = parseInt(tab.dataset.level);
        this.switchLevel(lvl);
      });
    });

    // 開始 / 暫停按鈕
    this.btnToggle.addEventListener('click', () => {
      this.togglePlay();
    });

    // 空白鍵快捷鍵控制
    window.addEventListener('keydown', (e) => {
      // 若在輸入框內打字則不觸發
      if (e.target.tagName === 'INPUT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === '1') {
        this.switchLevel(1);
      } else if (e.key === '2') {
        this.switchLevel(2);
      } else if (e.key === '3') {
        this.switchLevel(3);
      } else if (e.code === 'ArrowUp' || e.key === 'o' || e.key === 'O') {
        this.recordSuccess();
      } else if (e.code === 'ArrowDown' || e.key === 'x' || e.key === 'X') {
        this.recordWrong();
      }
    });

    // 裁判按鈕
    this.btnSuccess.addEventListener('click', () => this.recordSuccess());
    this.btnWrong.addEventListener('click', () => this.recordWrong());

    // 全螢幕投影切換
    this.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());

    // 名冊 Modal 開關
    this.btnRoster.addEventListener('click', () => this.openRosterModal());
    this.btnCloseModal.addEventListener('click', () => this.closeRosterModal());
    this.modalRoster.addEventListener('click', (e) => {
      if (e.target === this.modalRoster) this.closeRosterModal();
    });

    // 批次換照
    this.btnBatchUpload.addEventListener('click', () => {
      this.batchFileInput.click();
    });
    this.batchFileInput.addEventListener('change', (e) => this.handleBatchUpload(e));

    // 單張換照
    this.singleFileInput.addEventListener('change', (e) => this.handleSingleUpload(e));

    // 重設名冊
    this.btnResetRoster.addEventListener('click', () => {
      if (confirm('確定要還原為預設 20 位老同學姓名與向量頭像嗎？')) {
        window.rosterManager.resetToDefault();
        this.renderRosterCards();
        this.setupNewRound();
        this.showToast('✅ 名冊已恢復預設！');
      }
    });
  }

  switchLevel(level) {
    if (this.currentLevel === level) return;
    this.currentLevel = level;
    this.levelTabs.forEach(tab => {
      tab.classList.toggle('active', parseInt(tab.dataset.level) === level);
    });

    const isRunning = this.isPlaying;
    this.stopGame();
    this.setupNewRound();

    if (isRunning) {
      this.startGame();
    }
  }

  // 隨機抽選同學並混排於 8 宮格
  setupNewRound() {
    const studentCount = this.bpmLevels[this.currentLevel].count;
    const allStudents = [...window.rosterManager.roster];

    // 洗牌並抽取指定人數
    const shuffled = allStudents.sort(() => 0.5 - Math.random());
    const selectedStudents = shuffled.slice(0, studentCount);

    // 填充 8 宮格：確保每個選中的人至少出現一次，其餘隨機填滿
    const cells = [];
    selectedStudents.forEach(stu => cells.push(stu));
    while (cells.length < 8) {
      const pick = selectedStudents[Math.floor(Math.random() * selectedStudents.length)];
      cells.push(pick);
    }
    // 打亂 8 格順序
    this.currentRoundCells = cells.sort(() => 0.5 - Math.random());

    // 生成隨機跳耀順序（4 拍卡點）：挑選 4 個不同的格位或連續動態
    this.beatSequence = [];
    const availableIndices = [0, 1, 2, 3, 4, 5, 6, 7];
    const shuffledIdx = availableIndices.sort(() => 0.5 - Math.random());
    this.beatSequence = shuffledIdx.slice(0, 4);

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
        <div class="cell-name">${student.name}</div>
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

    this.currentStep = 0;
    this.runBeatLoop();
  }

  stopGame() {
    this.isPlaying = false;
    clearTimeout(this.timerId);
    this.timerId = null;
    this.btnToggle.innerHTML = '▶ 開始卡點 (Space)';
    this.btnToggle.classList.remove('btn-danger');
    this.btnToggle.classList.add('btn-primary');

    this.clearAllHighlights();
    this.promptText.innerText = '按空白鍵開始卡點！';
    this.resetBeatDots();
  }

  runBeatLoop() {
    if (!this.isPlaying) return;

    const bpm = this.bpmLevels[this.currentLevel].bpm;
    const intervalMs = (60 / bpm) * 1000;

    this.processBeatStep(this.currentStep);

    this.currentStep++;
    if (this.currentStep >= this.totalStepsInRound) {
      this.currentStep = 0;
      // 每輪結束後自動洗牌進入下一局，保持派對無縫節奏！
      this.setupNewRound();
    }

    this.timerId = setTimeout(() => {
      this.runBeatLoop();
    }, intervalMs);
  }

  processBeatStep(step) {
    this.clearAllHighlights();

    // 前 4 拍：預備拍（1, 2, 3, GO）
    if (step < 4) {
      this.updateBeatDots(step, true);

      if (step === 0) {
        this.promptText.innerText = '預備～ (1)';
        window.beatAudio.playKick();
        window.beatAudio.playPrepBeep(false);
      } else if (step === 1) {
        this.promptText.innerText = '備～ (2)';
        window.beatAudio.playSnare();
        window.beatAudio.playPrepBeep(false);
      } else if (step === 2) {
        this.promptText.innerText = '備～ (3)';
        window.beatAudio.playKick();
        window.beatAudio.playPrepBeep(false);
      } else if (step === 3) {
        this.promptText.innerText = 'GO！ (4)';
        window.beatAudio.playSnare();
        window.beatAudio.playPrepBeep(true);
      }
    } 
    // 後 4 拍：挑戰拍（跳耀至指定同學方塊）
    else {
      const challengeBeatIndex = step - 4; // 0, 1, 2, 3
      this.updateBeatDots(challengeBeatIndex, false);

      const targetCellIndex = this.beatSequence[challengeBeatIndex];
      const targetStudent = this.currentRoundCells[targetCellIndex];

      this.promptText.innerText = `喊出名字！👉【 ${targetStudent.name} 】`;

      // 節奏鼓點 (重音 Kick + Snare)
      if (challengeBeatIndex % 2 === 0) {
        window.beatAudio.playKick();
      } else {
        window.beatAudio.playSnare();
      }
      window.beatAudio.playHiHat(0, true);

      // 高亮當前跳耀到的格子 (霓虹綠邊框)
      const activeCell = document.getElementById(`grid-cell-${targetCellIndex}`);
      if (activeCell) {
        activeCell.classList.add('on-beat-active');
      }
    }
  }

  clearAllHighlights() {
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(c => c.classList.remove('on-beat-active'));
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
    window.beatAudio.playWrongSound();
    this.showToast('🍺 喊錯罰酒！罰酒一杯！', '#ff007f');
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
  openRosterModal() {
    this.renderRosterCards();
    this.modalRoster.classList.add('open');
  }

  closeRosterModal() {
    this.modalRoster.classList.remove('open');
    this.setupNewRound(); // 更新名冊後刷新當前遊戲格
  }

  renderRosterCards() {
    this.rosterGrid.innerHTML = '';
    const roster = window.rosterManager.roster;

    roster.forEach((student, index) => {
      const card = document.createElement('div');
      card.className = 'roster-card';
      card.innerHTML = `
        <span class="roster-card-num">#${student.id}</span>
        <div class="roster-avatar-wrap" title="點擊更換此同學照片">
          <img src="${student.avatar}" alt="${student.name}" id="roster-img-${index}" />
        </div>
        <input type="text" class="roster-name-input" value="${student.name}" placeholder="輸入名字" data-index="${index}" />
      `;

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

  // 批次上傳多張照片 (最多 20 張)
  async handleBatchUpload(e) {
    const files = Array.from(e.target.files).slice(0, 20);
    if (files.length === 0) return;

    this.showToast(`📸 正在批次處理 ${files.length} 張照片...`, '#00d2ff');

    for (let i = 0; i < files.length; i++) {
      try {
        const compressedBase64 = await RosterManager.compressImage(files[i], 180, 0.75);
        window.rosterManager.updateStudent(i, null, compressedBase64);
      } catch (err) {
        console.error(`第 ${i + 1} 張照片讀取失敗:`, err);
      }
    }

    this.renderRosterCards();
    this.showToast(`🎉 成功更新 ${files.length} 位同學照片！`, '#00ff88');
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
}

// 頁面載入完成後初始化
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new BeatPartyGame();
});
