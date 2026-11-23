// server.js - 多房間/場次房間碼支援 Node.js 後端伺服器 (支援心跳與安全自動回收清理)
// 啟動方式：node server.js (預設 Port 8000)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const DATA_DIR = path.resolve(__dirname, 'rooms-data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// 產生 5 碼隨機英文大寫+數字代碼 (避免容易混淆的 0, O, 1, I)
function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 嚴格的安全路徑檢查：僅能刪除 ./rooms-data/room-XXXXX.json，防止路徑遍歷與向上刪除漏洞
function getSafeRoomFilePath(roomId) {
  const safeId = String(roomId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!safeId) return null;
  const fileName = `room-${safeId}.json`;
  const resolvedPath = path.resolve(DATA_DIR, fileName);
  // 必須完全位於 DATA_DIR 目錄內，且不能相等（必須是其內部檔案）
  const relative = path.relative(DATA_DIR, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative !== fileName) {
    return null;
  }
  return resolvedPath;
}

// 記憶體中的房間實例快取
const activeRooms = new Map();

function loadRoom(roomId, autoCreate = true) {
  const id = String(roomId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!id) return null;

  if (activeRooms.has(id)) {
    return activeRooms.get(id);
  }

  const file = getSafeRoomFilePath(id);
  if (!file) return null;

  let data = null;
  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.warn(`讀取房間 ${id} 檔案失敗:`, e);
    }
  }

  // 舊版單機向下相容：若 DEFAULT 沒有檔案，嘗試讀取根目錄 roster-data.json
  if (!data && id === 'DEFAULT') {
    const legacyFile = path.join(__dirname, 'roster-data.json');
    if (fs.existsSync(legacyFile)) {
      try { data = JSON.parse(fs.readFileSync(legacyFile, 'utf8')); } catch (e) {}
    }
  }

  if (!data) {
    if (!autoCreate) return null;
    data = {
      roomId: id,
      version: 1,
      adult: null,
      child: null,
      sabotageEnabled: true,
      createdAt: Date.now()
    };
  }

  const roomObj = {
    data,
    liveBarrage: [],
    nextBarrageId: 1,
    sessions: new Map(), // sessionId -> lastActiveTimestamp
    lastActive: Date.now()
  };
  activeRooms.set(id, roomObj);
  return roomObj;
}

function saveRoom(roomObj) {
  const file = getSafeRoomFilePath(roomObj.data.roomId);
  if (!file) return;
  try {
    fs.writeFileSync(file, JSON.stringify(roomObj.data, null, 2), 'utf8');
  } catch (e) {
    console.error(`儲存房間 ${roomObj.data.roomId} 失敗:`, e);
  }
}

// 安全刪除房間資料檔（嚴格限制僅能刪除 ./rooms-data/ 內的檔案，防禦向上刪除）
function safelyDeleteRoom(roomId) {
  const id = String(roomId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!id || id === 'DEFAULT') return false; // 保留 DEFAULT

  activeRooms.delete(id);
  const file = getSafeRoomFilePath(id);
  if (file && fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
      console.log(`🧹 [自動清理] 房間 ${id} 所有人員皆已離線，已安全刪除 ./rooms-data/room-${id}.json`);
      return true;
    } catch (err) {
      console.error(`刪除房間 ${id} 失敗:`, err);
    }
  }
  return false;
}

// 背景定時任務：檢查心跳與已斷線 session，若房間 25 秒內無任何活躍在線人數則自動回收刪除
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of activeRooms.entries()) {
    if (roomId === 'DEFAULT') continue;
    // 清理超過 12 秒沒送心跳的連線 session
    for (const [sid, lastSeen] of room.sessions.entries()) {
      if (now - lastSeen > 12000) {
        room.sessions.delete(sid);
      }
    }
    // 若該房間上線人數為 0 且距離最後活躍時間超過 25 秒，安全刪除 json 檔案
    if (room.sessions.size === 0 && now - room.lastActive > 25000) {
      safelyDeleteRoom(roomId);
    }
  }
}, 5000);

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function updateRoomHeartbeat(room, reqUrl) {
  if (!room) return;
  const sid = reqUrl.searchParams.get('sid') || 'anonymous';
  room.sessions.set(sid, Date.now());
  room.lastActive = Date.now();
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;
  const rawRoom = (urlObj.searchParams.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const roomId = rawRoom || 'DEFAULT';

  // CORS 支援
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // API: 建立新房間 (產生 5 碼隨機碼)
  if (pathname === '/api/room/create' && req.method === 'POST') {
    let newCode = generateRoomCode();
    let safePath = getSafeRoomFilePath(newCode);
    while (fs.existsSync(safePath)) {
      newCode = generateRoomCode();
      safePath = getSafeRoomFilePath(newCode);
    }
    const newRoom = loadRoom(newCode, true);
    updateRoomHeartbeat(newRoom, urlObj);
    saveRoom(newRoom);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, roomId: newCode }));
  }

  // API: 驗證/檢查房間是否存在（在 lobby 輸入號碼時核對）
  if (pathname === '/api/room/check' && req.method === 'GET') {
    const code = (urlObj.searchParams.get('room') || '').toUpperCase().trim();
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '請提供房間代碼' }));
    }
    const safeFile = getSafeRoomFilePath(code);
    const exists = activeRooms.has(code) || (safeFile && fs.existsSync(safeFile)) || code === 'DEFAULT';
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, roomId: code, exists }));
  }

  // API: 心跳與取得當前房間在線人數
  if (pathname === '/api/room/heartbeat' && req.method === 'GET') {
    const room = loadRoom(roomId, false);
    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '房間不存在' }));
    }
    updateRoomHeartbeat(room, urlObj);
    // 計算活躍人數 (12 秒內有發送心跳者)
    const now = Date.now();
    let onlineCount = 0;
    for (const [sid, lastSeen] of room.sessions.entries()) {
      if (now - lastSeen <= 12000) onlineCount++;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, roomId, onlineCount: Math.max(1, onlineCount) }));
  }

  // API 1: 取得指定房間共用名冊
  if (pathname === '/api/roster' && req.method === 'GET') {
    const room = loadRoom(roomId, true);
    updateRoomHeartbeat(room, urlObj);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(room.data));
  }

  // API 2: 整批更新指定房間名冊
  if (pathname === '/api/roster' && req.method === 'POST') {
    try {
      const room = loadRoom(roomId, true);
      updateRoomHeartbeat(room, urlObj);
      const body = await readJsonBody(req);
      if (body.adult) room.data.adult = body.adult;
      if (body.child) room.data.child = body.child;
      room.data.version = Date.now();
      saveRoom(room);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true, roomId, version: room.data.version }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  // API 3: 參與者手機單人報名上傳 (存入所屬房間)
  if (pathname === '/api/join' && req.method === 'POST') {
    try {
      const room = loadRoom(roomId, true);
      updateRoomHeartbeat(room, urlObj);
      const { group = 'adult', slotIndex, name, avatar } = await readJsonBody(req);
      const g = group === 'child' ? 'child' : 'adult';
      const defaultMax = g === 'child' ? 20 : 30;
      if (!Array.isArray(room.data[g]) || room.data[g].length < defaultMax) {
        const existing = Array.isArray(room.data[g]) ? room.data[g] : [];
        room.data[g] = Array.from({ length: defaultMax }, (_, i) => existing[i] || ({
          id: i + 1,
          name: `${g === 'child' ? '小孩' : '大人'} ${i + 1}`,
          avatar: '',
          isCustomAvatar: false
        }));
      }
      const list = room.data[g];
      const trimmedName = (name || '').trim();

      // 防重複邏輯：
      // 1. 若該名字已存在於名冊中，直接覆蓋更新該人員頭像，避免連點兩次產生重複人名
      let idx = -1;
      if (trimmedName) {
        idx = list.findIndex(item => item && item.name === trimmedName);
      }
      // 2. 若為新名字且指定了 slotIndex
      if (idx === -1 && typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < list.length) {
        idx = slotIndex;
      }
      // 3. 若為 -2 則強制新增在尾端
      if (slotIndex === -2) {
        idx = list.length;
      } else if (idx === -1) {
        // 4. 自動排入：找第一個未上傳自訂照片的預設空位
        idx = list.findIndex(item => !item || !item.isCustomAvatar);
        if (idx === -1) idx = list.length;
      }
      const fallbackName = `${g === 'child' ? '小孩' : '大人'} ${idx + 1}`;
      list[idx] = {
        id: idx + 1,
        name: trimmedName || (list[idx] ? list[idx].name : fallbackName),
        avatar: avatar || (list[idx] ? list[idx].avatar : ''),
        isCustomAvatar: true
      };
      // 重建連續正確的 id，避免任何破口
      for (let i = 0; i < list.length; i++) {
        if (!list[i]) {
          const fn = `${g === 'child' ? '小孩' : '大人'} ${i + 1}`;
          list[i] = { id: i + 1, name: fn, avatar: '', isCustomAvatar: false };
        } else {
          list[i].id = i + 1;
        }
      }
      room.data.version = Date.now();
      saveRoom(room);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true, roomId, group: g, slotId: idx + 1, total: list.length, version: room.data.version }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  // API 4: 取得指定房間即時互動彈幕與干擾開關
  if (pathname === '/api/barrage' && req.method === 'GET') {
    const room = loadRoom(roomId, true);
    updateRoomHeartbeat(room, urlObj);
    const since = parseInt(urlObj.searchParams.get('since') || '0', 10);
    const now = Date.now();
    room.liveBarrage = room.liveBarrage.filter(item => now - item.ts < 15000);
    const items = room.liveBarrage.filter(item => item.id > since);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      roomId,
      items,
      lastId: room.nextBarrageId - 1,
      sabotageEnabled: typeof room.data.sabotageEnabled === 'boolean' ? room.data.sabotageEnabled : true
    }));
  }

  // API 5: 發送即時互動彈幕 (Emoji / 圖片 / 文字 / 干擾道具) 到所屬房間
  if (pathname === '/api/barrage' && req.method === 'POST') {
    try {
      const room = loadRoom(roomId, true);
      updateRoomHeartbeat(room, urlObj);
      const isSabotageOn = typeof room.data.sabotageEnabled === 'boolean' ? room.data.sabotageEnabled : true;
      const { type = 'emoji', content = '', sender = '' } = await readJsonBody(req);
      if (type === 'sabotage' && !isSabotageOn) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, disabled: true, error: '該場次主持人已關閉干擾道具功能' }));
      }
      const trimmed = String(content).trim();
      if (!trimmed) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: 'Empty content' }));
      }
      const item = {
        id: room.nextBarrageId++,
        type,
        content: trimmed,
        sender: String(sender || '').trim().slice(0, 12),
        ts: Date.now()
      };
      room.liveBarrage.push(item);
      if (room.liveBarrage.length > 100) room.liveBarrage.shift();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true, roomId, item, sabotageEnabled: isSabotageOn }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  // API 6: 後台切換該場次干擾功能開關
  if (pathname === '/api/sabotage-config' && req.method === 'POST') {
    try {
      const room = loadRoom(roomId, true);
      updateRoomHeartbeat(room, urlObj);
      const { enabled } = await readJsonBody(req);
      room.data.sabotageEnabled = !!enabled;
      saveRoom(room);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true, roomId, sabotageEnabled: room.data.sabotageEnabled }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  // 靜態檔案服務 (首頁預設為 lobby.html)
  let filePath = pathname === '/' ? '/lobby.html' : pathname;
  const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(__dirname, safePath);

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(fullPath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n🎉 2026 節奏挑戰 多場次伺服器已啟動！`);
  console.log(`👉 遊戲大廳首頁：http://localhost:${PORT}`);
  console.log(`👉 大螢幕舞台：http://localhost:${PORT}/index.html`);
  console.log(`👉 手機互動頁面：http://localhost:${PORT}/join.html`);
  console.log(`🛡️ 安全防護啟動：嚴格限定 ./rooms-data/ 檔案清理，防止路徑遍歷！\n`);
});
