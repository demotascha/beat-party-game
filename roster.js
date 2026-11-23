// roster.js - 大人(最多 30 位) 與 小孩(最多 20 位) 名冊管理與本地存儲

const DEFAULT_ADULT_NAMES = [
  "小明", "大華", "志豪", "雅婷", "冠宇",
  "怡君", "建宏", "佳穎", "俊傑", "思婷",
  "家豪", "欣怡", "柏翰", "詩涵", "承恩",
  "佩君", "宗翰", "詠晴", "子軒", "鈺婷",
  "哲瑋", "婉婷", "彥廷", "郁婷", "威廷",
  "宇軒", "心怡", "浩然", "佳蓉", "敬騰"
];

const DEFAULT_CHILD_NAMES = [
  "小寶", "妞妞", "樂樂", "多多", "糖糖",
  "安安", "果果", "豆豆", "球球", "米米",
  "噗噗", "圓圓", "可可", "奇奇", "跳跳",
  "小星", "芽芽", "布丁", "麻糬", "皮皮"
];

// 生成《超級瑪利歐 3D 世界 Super Mario 3D World》立體渲染風格預設頭像 (3D 球體光影 + 立體問號磚塊框 + 3D 瑪利歐帽)
function generateAvatarSvg(name, index) {
  const capThemes = [
    ['#FF4B4B', '#E52521', '#8E0000'], // 3D 瑪利歐紅
    ['#6EE768', '#43B047', '#145A18'], // 3D 路易吉綠
    ['#FFF176', '#FBD000', '#C68400'], // 3D 瓦利歐黃
    ['#FF94C8', '#FF52A2', '#A0004E'], // 3D 碧姬粉
    ['#B388FF', '#7E57C2', '#311B92'], // 3D 瓦路易吉紫
    ['#4FC3F7', '#049CD8', '#004C8C']  // 3D 奇諾比奧藍
  ];
  const [capLight, capMid, capDark] = capThemes[index % capThemes.length];
  const initial = (name || "M").slice(-1);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <!-- 3D 藍天放射漸層 -->
      <radialGradient id="sky3d_${index}" cx="50%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#8BE9FD"/>
        <stop offset="55%" stop-color="#2979FF"/>
        <stop offset="100%" stop-color="#0D47A1"/>
      </radialGradient>
      <!-- 3D 肌膚立體球面光影 -->
      <radialGradient id="skin3d_${index}" cx="38%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#FFE8D6"/>
        <stop offset="55%" stop-color="#FFAA43"/>
        <stop offset="100%" stop-color="#D97B48"/>
      </radialGradient>
      <!-- 3D 帽子立體高光漸層 -->
      <radialGradient id="cap3d_${index}" cx="35%" cy="28%" r="70%">
        <stop offset="0%" stop-color="${capLight}"/>
        <stop offset="50%" stop-color="${capMid}"/>
        <stop offset="100%" stop-color="${capDark}"/>
      </radialGradient>
      <!-- 3D 黃金問號磚塊金屬漸層 -->
      <linearGradient id="gold3d_${index}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF59D"/>
        <stop offset="45%" stop-color="#FBD000"/>
        <stop offset="100%" stop-color="#E67E00"/>
      </linearGradient>
      <!-- 3D 綠水管立體漸層 -->
      <linearGradient id="pipe3d_${index}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#1B5E20"/>
        <stop offset="28%" stop-color="#76FF03"/>
        <stop offset="55%" stop-color="#43B047"/>
        <stop offset="100%" stop-color="#0D3B10"/>
      </linearGradient>
      <filter id="drop3d_${index}" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>

    <!-- 3D 世界天空背景与立體白雲 -->
    <rect width="120" height="120" rx="22" fill="url(#sky3d_${index})"/>
    <ellipse cx="28" cy="28" rx="18" ry="10" fill="#FFFFFF" opacity="0.9" filter="url(#drop3d_${index})"/>
    <ellipse cx="92" cy="24" rx="15" ry="8" fill="#FFFFFF" opacity="0.85" filter="url(#drop3d_${index})"/>

    <!-- 底部 3D 瑪利歐綠水管平台 -->
    <rect x="20" y="96" width="80" height="20" rx="4" fill="url(#pipe3d_${index})" filter="url(#drop3d_${index})"/>
    <rect x="14" y="92" width="92" height="9" rx="4" fill="url(#pipe3d_${index})" stroke="#0D3B10" stroke-width="1"/>

    <!-- 3D 角色立體頭像與大鼻子 -->
    <g filter="url(#drop3d_${index})">
      <circle cx="60" cy="64" r="25" fill="url(#skin3d_${index})"/>
      <!-- 3D 帽子球體與立體帽簷 -->
      <path d="M 33 54 C 33 27, 87 27, 87 54 Z" fill="url(#cap3d_${index})"/>
      <path d="M 29 53 Q 60 45 91 53 Q 95 60 85 60 L 35 60 Z" fill="${capDark}"/>
      <!-- 帽子 3D 高光與圓形立體徽章 -->
      <ellipse cx="48" cy="37" rx="10" ry="4" fill="#FFFFFF" opacity="0.35" transform="rotate(-15 48 37)"/>
      <circle cx="60" cy="43" r="10.5" fill="#FFFFFF"/>
      <text x="60" y="47" font-family="'Arial Black', sans-serif" font-size="13" font-weight="900" fill="${capDark}" text-anchor="middle">${initial}</text>
      <!-- 3D 晶亮大眼睛 + 眼神高光 -->
      <ellipse cx="50" cy="65" rx="3.8" ry="5.5" fill="#0D47A1"/>
      <ellipse cx="70" cy="65" rx="3.8" ry="5.5" fill="#0D47A1"/>
      <circle cx="48.8" cy="63" r="1.6" fill="#FFFFFF"/>
      <circle cx="68.8" cy="63" r="1.6" fill="#FFFFFF"/>
      <!-- 3D 瑪利歐招牌圓球大鼻子與立體翹鬍子 -->
      <path d="M 45 76 Q 52 71 60 74 Q 68 71 75 76 Q 68 83 60 79 Q 52 83 45 76 Z" fill="#4E2708"/>
      <ellipse cx="60" cy="70" rx="7.5" ry="5.8" fill="url(#skin3d_${index})"/>
      <ellipse cx="58" cy="68.5" rx="2.8" ry="1.6" fill="#FFFFFF" opacity="0.65"/>
    </g>

    <!-- 3D 立體斜角黃金問號磚塊相框 + 立體銀色鉚釘 -->
    <rect x="4" y="4" width="112" height="112" rx="18" fill="none" stroke="url(#gold3d_${index})" stroke-width="8"/>
    <rect x="7" y="7" width="106" height="106" rx="15" fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="1.5"/>
    <circle cx="13" cy="13" r="3" fill="#E0E0E0" stroke="#616161" stroke-width="1"/>
    <circle cx="107" cy="13" r="3" fill="#E0E0E0" stroke="#616161" stroke-width="1"/>
    <circle cx="13" cy="107" r="3" fill="#E0E0E0" stroke="#616161" stroke-width="1"/>
    <circle cx="107" cy="107" r="3" fill="#E0E0E0" stroke="#616161" stroke-width="1"/>
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

class RosterManager {
  constructor() {
    this.remoteVersion = 0;
    this.roomId = this.getRoomIdFromUrl();
    this.sessionId = this.getOrCreateSessionId();
    this.storageKeys = {
      adult: `class_reunion_roster_adult_v1_${this.roomId}`,
      child: `class_reunion_roster_child_v1_${this.roomId}`,
      activeGroup: `class_reunion_active_group_v1_${this.roomId}`,
      onlyUploaded: `class_reunion_only_uploaded_v1_${this.roomId}`
    };
    this.groupConfig = {
      adult: { max: 30, label: '大人', defaultNames: DEFAULT_ADULT_NAMES },
      child: { max: 20, label: '小孩', defaultNames: DEFAULT_CHILD_NAMES }
    };
    this.activeGroup = localStorage.getItem(this.storageKeys.activeGroup) || 'adult';
    if (!this.groupConfig[this.activeGroup]) this.activeGroup = 'adult';
    this.onlyUploaded = localStorage.getItem(this.storageKeys.onlyUploaded) === 'true';
    this.rosters = {
      adult: this.loadGroupRoster('adult'),
      child: this.loadGroupRoster('child')
    };
    this.startRemoteSync();
  }

  getOrCreateSessionId() {
    let sid = sessionStorage.getItem('beat_game_session_id');
    if (!sid) {
      sid = 'sid_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      sessionStorage.setItem('beat_game_session_id', sid);
    }
    return sid;
  }

  getRoomIdFromUrl() {
    try {
      const p = new URLSearchParams(window.location.search);
      const r = (p.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      return r || 'DEFAULT';
    } catch (e) {
      return 'DEFAULT';
    }
  }

  // 與 node server.js 後端自動同步 (每 2.5 秒拉取最新參與者手機報名資料與心跳)
  startRemoteSync() {
    if (location.protocol === 'file:') return;
    const pull = async () => {
      try {
        const res = await fetch(`/api/roster?room=${encodeURIComponent(this.roomId)}&sid=${encodeURIComponent(this.sessionId)}`);
        if (!res.ok) return;
        const data = await res.json();
        // 伺服器端名冊若為 null 或初始狀態，且本機尚未初始化，則將本機預設名冊推送到伺服器
        if (!data.adult && !data.child) {
          this.pushToServer();
          return;
        }
        if (data.version && data.version !== this.remoteVersion) {
          this.remoteVersion = data.version;
          let changed = false;
          ['adult', 'child'].forEach(g => {
            if (Array.isArray(data[g]) && data[g].length >= this.groupConfig[g].max) {
              this.rosters[g] = data[g];
              localStorage.setItem(this.storageKeys[g], JSON.stringify(data[g]));
              changed = true;
            }
          });
          if (changed && window.gameApp) {
            if (window.gameApp.modalRoster && window.gameApp.modalRoster.classList.contains('open')) {
              window.gameApp.renderRosterCards();
            }
            if (!window.gameApp.isPlaying) {
              window.gameApp.setupNewRound();
            }
          }
        }
      } catch (e) {}
    };
    pull();
    setInterval(pull, 2500);
  }

  pushToServer() {
    if (location.protocol === 'file:') return;
    // 手機加入頁 (join.html) 僅能透過 /api/join 單人報名，嚴禁呼叫 pushToServer 整批覆寫房間名冊
    if (location.pathname.includes('join.html')) return;
    fetch(`/api/roster?room=${encodeURIComponent(this.roomId)}&sid=${encodeURIComponent(this.sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adult: this.rosters.adult, child: this.rosters.child })
    }).then(r => r.json()).then(d => { if (d.version) this.remoteVersion = d.version; }).catch(() => {});
  }

  // 向下相容：回傳目前所選分組 (大人 或 小孩) 的名冊陣列
  get roster() {
    return this.rosters[this.activeGroup];
  }

  get maxCount() {
    return Math.max(this.groupConfig[this.activeGroup].max, this.roster.length);
  }

  get defaultMaxCount() {
    return this.groupConfig[this.activeGroup].max;
  }

  // 新增名額（超過預設大人 30 / 小孩 20 時可直接動態新增）
  addStudent(newName = null, newAvatar = null, group = this.activeGroup) {
    const cfg = this.groupConfig[group];
    const list = this.rosters[group];
    const idx = list.length;
    const name = (newName && newName.trim()) ? newName.trim() : `${cfg.label} ${idx + 1}`;
    const item = {
      id: idx + 1,
      name,
      avatar: newAvatar || generateAvatarSvg(name, idx),
      isCustomAvatar: !!newAvatar
    };
    list.push(item);
    this.saveRoster(group);
    return idx;
  }

  get groupLabel() {
    return this.groupConfig[this.activeGroup].label;
  }

  setGroup(group) {
    if (!this.groupConfig[group]) return;
    this.activeGroup = group;
    localStorage.setItem(this.storageKeys.activeGroup, group);
  }

  setOnlyUploaded(val) {
    this.onlyUploaded = !!val;
    localStorage.setItem(this.storageKeys.onlyUploaded, String(this.onlyUploaded));
  }

  // 取得當前遊戲抽選候選池：若勾選「僅從已上傳人物中選取」且已有上傳者，則只回傳 isCustomAvatar === true 的成員
  getCandidatePool() {
    const all = this.roster;
    if (!this.onlyUploaded) return [...all];
    const uploaded = all.filter(item => item.isCustomAvatar);
    return uploaded.length > 0 ? [...uploaded] : [...all];
  }

  getUploadedCount(group = this.activeGroup) {
    return (this.rosters[group] || []).filter(item => item.isCustomAvatar).length;
  }

  loadGroupRoster(group) {
    const cfg = this.groupConfig[group];
    const saved = localStorage.getItem(this.storageKeys[group]);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 保留既有照片與姓名（包含超過預設數量的新增名額），不足預設數量則自動補齊
          const totalLen = Math.max(cfg.max, parsed.length);
          return Array.from({ length: totalLen }, (_, idx) => {
            const defName = cfg.defaultNames[idx] || `${cfg.label} ${idx + 1}`;
            return parsed[idx] ? {
              id: idx + 1,
              name: parsed[idx].name,
              avatar: parsed[idx].avatar,
              isCustomAvatar: !!parsed[idx].isCustomAvatar
            } : {
              id: idx + 1,
              name: defName,
              avatar: generateAvatarSvg(defName, idx),
              isCustomAvatar: false
            };
          });
        }
      } catch (e) {
        console.warn("名冊讀取失敗，還原預設值", e);
      }
    }
    // 僅在 DEFAULT 房間相容舊版單機名冊，其他新開房間一律使用純淨全新名冊
    if (group === 'adult' && this.roomId === 'DEFAULT') {
      try {
        const old = JSON.parse(localStorage.getItem('class_reunion_roster_v1') || 'null');
        if (Array.isArray(old) && old.length > 0) {
          return cfg.defaultNames.map((name, idx) => old[idx] ? {
            id: idx + 1,
            name: old[idx].name,
            avatar: old[idx].avatar,
            isCustomAvatar: !!old[idx].isCustomAvatar
          } : {
            id: idx + 1,
            name,
            avatar: generateAvatarSvg(name, idx),
            isCustomAvatar: false
          });
        }
      } catch (e) {}
    }
    return cfg.defaultNames.map((name, idx) => ({
      id: idx + 1,
      name: name,
      avatar: generateAvatarSvg(name, idx),
      isCustomAvatar: false
    }));
  }

  saveRoster(group = this.activeGroup) {
    try {
      localStorage.setItem(this.storageKeys[group], JSON.stringify(this.rosters[group]));
      this.pushToServer();
    } catch (e) {
      console.error("儲存名冊失敗 (可能超出 LocalStorage 容量)", e);
    }
  }

  updateStudent(index, newName, newAvatar = null) {
    const list = this.roster;
    const label = this.groupLabel;
    if (index >= 0 && index < list.length) {
      if (newName !== null) {
        list[index].name = newName.trim() || `${label} ${index + 1}`;
        if (!list[index].isCustomAvatar) {
          list[index].avatar = generateAvatarSvg(list[index].name, index);
        }
      }
      if (newAvatar) {
        list[index].avatar = newAvatar;
        list[index].isCustomAvatar = true;
      }
      this.saveRoster();
    }
  }

  // 單一成員刪除（若為超過預設數量的額外名額則直接移除，否則還原該編號為預設頭像）
  deleteStudent(index, group = this.activeGroup) {
    const cfg = this.groupConfig[group];
    const list = this.rosters[group];
    if (index >= 0 && index < list.length) {
      if (list.length > cfg.max && index >= cfg.max) {
        list.splice(index, 1);
        list.forEach((item, i) => { item.id = i + 1; });
      } else {
        const defName = cfg.defaultNames[index] || `${cfg.label} ${index + 1}`;
        list[index] = {
          id: index + 1,
          name: defName,
          avatar: generateAvatarSvg(defName, index),
          isCustomAvatar: false
        };
      }
      this.saveRoster(group);
    }
  }

  resetToDefault(group = this.activeGroup) {
    const cfg = this.groupConfig[group];
    this.rosters[group] = cfg.defaultNames.map((name, idx) => ({
      id: idx + 1,
      name: name,
      avatar: generateAvatarSvg(name, idx),
      isCustomAvatar: false
    }));
    this.saveRoster(group);
  }

  // 將上傳的照片轉換為《超級瑪利歐 3D 世界 / 瑪利歐電影》3D CG 玩具質感風格
  // (高解析平滑塑膠光澤 + 3D 球面立體打光 Rim/Specular Light + 3D 立體斜角黃金問號磚塊框 + 3D 瑪利歐立體紅帽與無敵星)
  static compressImage(file, maxDimension = 240, quality = 0.88) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const size = maxDimension;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          // 1. 高解析置中正方形裁切 + 3D 動畫電影級高飽和暖色調渲染
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.filter = 'saturate(1.42) contrast(1.12) brightness(1.06)';
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          ctx.filter = 'none';

          // 2. 3D 玩具模型平滑表面處理 (雙邊保邊柔化 Bilateral-like Smoothing + 柔和漸層色階 + 3D 球面光影)
          const imgData = ctx.getImageData(0, 0, size, size);
          const src = new Uint8ClampedArray(imgData.data);
          const dst = imgData.data;
          const cx = size * 0.42, cy = size * 0.35, maxR = size * 0.75;

          for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
              const i = (y * size + x) * 4;
              const r0 = src[i], g0 = src[i + 1], b0 = src[i + 2];

              // 保邊雙邊平滑：顏色相近才混合，讓皮膚像 3D 皮克斯/瑪利歐公仔一樣光滑但五官依然清晰
              let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const ni = ((y + dy) * size + (x + dx)) * 4;
                  const diff = Math.abs(src[ni] - r0) + Math.abs(src[ni + 1] - g0) + Math.abs(src[ni + 2] - b0);
                  const w = diff < 48 ? 1.0 : 0.15;
                  rSum += src[ni] * w; gSum += src[ni + 1] * w; bSum += src[ni + 2] * w; wSum += w;
                }
              }
              let r = rSum / wSum, g = gSum / wSum, b = bSum / wSum;

              // 柔和 S-Curve 與 3D 球面高光/環境光遮蔽 (Ambient Occlusion)
              const dist = Math.hypot(x - cx, y - cy) / maxR;
              const light = Math.max(0.78, 1.12 - dist * 0.28);
              dst[i] = Math.min(255, Math.round(r * light * 1.03));
              dst[i + 1] = Math.min(255, Math.round(g * light));
              dst[i + 2] = Math.min(255, Math.round(b * light * 0.98));
            }
          }
          ctx.putImageData(imgData, 0, 0);

          // 3. 疊加 3D 塑膠公仔左上方高光反射 (Specular Gloss) 與底部立體綠水管邊緣
          const gloss = ctx.createRadialGradient(size * 0.3, size * 0.22, 4, size * 0.35, size * 0.28, size * 0.55);
          gloss.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
          gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0.06)');
          gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = gloss;
          ctx.fillRect(0, 0, size, size);

          // 4. 底部 3D 圓柱光澤瑪利歐綠水管裝飾 (3D Warp Pipe Rim)
          const pipeGrad = ctx.createLinearGradient(12, 0, size - 12, 0);
          pipeGrad.addColorStop(0, '#145A18');
          pipeGrad.addColorStop(0.25, '#76FF03');
          pipeGrad.addColorStop(0.55, '#43B047');
          pipeGrad.addColorStop(0.85, '#2E7D32');
          pipeGrad.addColorStop(1, '#0D3B10');
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = -2;
          ctx.fillStyle = pipeGrad;
          ctx.fillRect(10, size - 22, size - 20, 12);
          ctx.restore();

          // 5. 左上角 3D 立體光澤瑪利歐紅帽徽章 + 右上角 3D 超級無敵星 (Super Star)
          ctx.save();
          ctx.translate(30, 28);
          ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 3;
          const capGrad = ctx.createRadialGradient(-5, -6, 2, 0, 0, 18);
          capGrad.addColorStop(0, '#FF6B6B');
          capGrad.addColorStop(0.55, '#E52521');
          capGrad.addColorStop(1, '#8E0000');
          ctx.fillStyle = capGrad;
          ctx.beginPath();
          ctx.arc(0, 0, 16, Math.PI, 0, false);
          ctx.lineTo(19, 4);
          ctx.lineTo(-17, 4);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(0, -4, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#D50000';
          ctx.font = '900 9px "Arial Black", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('M', 0, -3.5);
          ctx.restore();

          // 6. 3D 立體斜角黃金問號磚塊相框 (3D Beveled Gold ? Block Frame) + 3D 銀色球體鉚釘
          const frameGrad = ctx.createLinearGradient(0, 0, size, size);
          frameGrad.addColorStop(0, '#FFF59D');
          frameGrad.addColorStop(0.35, '#FBD000');
          frameGrad.addColorStop(0.75, '#F57F17');
          frameGrad.addColorStop(1, '#B25000');
          ctx.lineWidth = 12;
          ctx.strokeStyle = frameGrad;
          ctx.strokeRect(6, 6, size - 12, size - 12);

          // 3D 內側高光與暗部立體斜角 (Bevel Highlight & Shadow)
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.strokeRect(11, 11, size - 22, size - 22);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.strokeRect(13, 13, size - 26, size - 26);

          // 四角 3D 金屬球體鉚釘
          const rivets = [[16, 16], [size - 16, 16], [16, size - 16], [size - 16, size - 16]];
          rivets.forEach(([rx, ry]) => {
            const rg = ctx.createRadialGradient(rx - 1.2, ry - 1.2, 0.5, rx, ry, 4);
            rg.addColorStop(0, '#FFFFFF');
            rg.addColorStop(0.5, '#BDBDBD');
            rg.addColorStop(1, '#424242');
            ctx.fillStyle = rg;
            ctx.beginPath();
            ctx.arc(rx, ry, 3.8, 0, Math.PI * 2);
            ctx.fill();
          });

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

window.rosterManager = new RosterManager();
