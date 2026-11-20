// roster.js - 20 位同學名冊管理與本地存儲 (支援批次更換 20 張照片)

const DEFAULT_NAMES = [
  "小明", "大華", "志豪", "雅婷", "冠宇",
  "怡君", "建宏", "佳穎", "俊傑", "思婷",
  "家豪", "欣怡", "柏翰", "詩涵", "承恩",
  "佩君", "宗翰", "詠晴", "子軒", "鈺婷"
];

// 生成可愛色彩與特徵的向量風格頭像 (SVG Data URI)
function generateAvatarSvg(name, index) {
  const colors = [
    ['#FF6B6B', '#FFE66D'], ['#4ECDC4', '#556270'], ['#A8E6CF', '#3D84A8'],
    ['#FF8B94', '#FFAAA6'], ['#6C5CE7', '#A29BFE'], ['#FD79A8', '#FF7675'],
    ['#00B894', '#00CEC9'], ['#FDCB6E', '#E17055'], ['#0984E3', '#74B9FF'],
    ['#E84393', '#FD79A8'], ['#2D3436', '#636E72'], ['#B53471', '#ED4C67'],
    ['#1289A7', '#12CBC4'], ['#D980FA', '#FDA7DF'], ['#EE5253', '#FF9F43'],
    ['#10AC84', '#1DD1A1'], ['#5F27CD', '#341F97'], ['#48DBFB', '#0ABDE3'],
    ['#FF9FF3', '#F368E0'], ['#222F3E', '#576574']
  ];
  const [bg1, bg2] = colors[index % colors.length];
  const initial = (name || "同").slice(-1);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <linearGradient id="grad${index}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}" />
        <stop offset="100%" stop-color="${bg2}" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.3"/>
      </filter>
    </defs>
    <rect width="120" height="120" rx="30" fill="url(#grad${index})"/>
    <circle cx="60" cy="50" r="26" fill="#FFFFFF" opacity="0.9" filter="url(#shadow)"/>
    <text x="60" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="900" fill="${bg1}" text-anchor="middle" dominant-baseline="middle">${initial}</text>
    <path d="M 28 106 Q 60 76 92 106 Z" fill="#FFFFFF" opacity="0.85" />
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

class RosterManager {
  constructor() {
    this.storageKey = 'class_reunion_roster_v1';
    this.roster = this.loadRoster();
  }

  loadRoster() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 20) {
          return parsed;
        }
      } catch (e) {
        console.warn("名冊讀取失敗，還原預設值", e);
      }
    }
    // 預載 20 組
    return DEFAULT_NAMES.map((name, idx) => ({
      id: idx + 1,
      name: name,
      avatar: generateAvatarSvg(name, idx),
      isCustomAvatar: false
    }));
  }

  saveRoster() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.roster));
    } catch (e) {
      console.error("儲存名冊失敗 (可能超出 LocalStorage 容量)", e);
    }
  }

  updateStudent(index, newName, newAvatar = null) {
    if (index >= 0 && index < this.roster.length) {
      if (newName !== null) {
        this.roster[index].name = newName.trim() || `同學 ${index + 1}`;
        // 若非自訂相片，則自動以新名字更新向量圖
        if (!this.roster[index].isCustomAvatar) {
          this.roster[index].avatar = generateAvatarSvg(this.roster[index].name, index);
        }
      }
      if (newAvatar) {
        this.roster[index].avatar = newAvatar;
        this.roster[index].isCustomAvatar = true;
      }
      this.saveRoster();
    }
  }

  resetToDefault() {
    this.roster = DEFAULT_NAMES.map((name, idx) => ({
      id: idx + 1,
      name: name,
      avatar: generateAvatarSvg(name, idx),
      isCustomAvatar: false
    }));
    this.saveRoster();
  }

  // 壓縮圖片為適當尺寸的 Base64，避免 localStorage 爆滿
  static compressImage(file, maxDimension = 200, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

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
