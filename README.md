# 🎵 2026 節奏挑戰 | Beat Party Game (Say the Word on Beat)

[繁體中文](#繁體中文) | [English](#english)

---

## 繁體中文

### 📖 專案簡介與遊戲說明

**2026 節奏挑戰（Beat Party Game）** 是一款適合派對聚會、大型年會、團隊破冰以及親子互動的多人節奏卡點派對遊戲。本專案靈感源自流行熱門的「對拍喊名字 / 卡點挑戰」，並融入現代 Web Audio 合成音效、多房間隔離架構與手機互動干擾功能。

#### 🎮 核心玩法與遊戲規則
1. **多房間開局 (Lobby)**：
   - 玩家可透過遊戲大廳一鍵開局，系統會自動生成 5 碼隨機英文大寫與數字代碼（例如：`RDQKR`）。
   - 支援輸入房間代碼加入特定房間，各場次資料、自訂名冊及干擾操作完全隔離，互不干擾。
2. **節拍卡點規則**：
   - 預設提供熱身關卡以及挑戰關卡，支援「大人模式 (183 BPM)」與「小孩模式 (140 BPM)」。
   - **每局共 16 拍**：
     - **前 8 拍（預備聽拍）**：包含語音口號與預備提示（「預備 一 二 三 GO」），畫面上方節奏點依序跳動。
     - **後 8 拍（挑戰卡點）**：畫面中的 8 宮格圖片將由左至右、由上至下依序點亮**綠色光框 (`.on-beat-active`)**。挑戰者必須在綠框亮起的一瞬間，精準喊出對應格子的名稱或人名！
   - 支援每關 3 局連貫挑戰與自訂局數。
3. **手機自助上傳與即時干擾 (Mobile Join & Sabotage)**：
   - 現場觀眾與參賽者可使用手機掃描 QR Code 或造訪 `join.html?room=房間碼`。
   - **照片與姓名上傳**：快速上傳個人照片與名字，自動加入該房間的名冊候選題庫。
   - **發送干擾文字與迷因圖**：在舞台挑戰進行時，觀眾可即時發送搞笑彈幕或表情包，直接覆蓋在大螢幕中央對挑戰者進行干擾！
4. **跨裝置相容與零延遲對拍**：
   - 支援大螢幕全螢幕投影（`F11` 或右上角投影按鈕）。
   - 背景音樂全面採用 Web Audio API 內存解碼與微秒級精確時鐘，徹底解決 iPad / iOS Chrome 與 Safari 各種重新啟動時的延遲與音畫錯位問題。
   - 具備房間在線人數心跳（Heartbeat）即時統計，無人房間會自動安全回收清理。

---

### 🚀 本機啟動方式 (Local Run)

本專案後端採用純原生 Node.js 開發，無需安裝額外的 npm 依賴套件。

#### 前置需求
- 安裝 [Node.js](https://nodejs.org/) (建議版本 v18 以上)

#### 啟動步驟
1. 進入專案目錄：
   ```bash
   cd beat-party-game
   ```
2. 啟動伺服器：
   ```bash
   node server.js
   ```
   *(如需自訂埠號，可透過環境變數指定，例如 `PORT=3000 node server.js`，預設為 8000)*
3. 開啟瀏覽器訪問：
   - 遊戲大廳（首頁）：[http://localhost:8000/lobby.html](http://localhost:8000/lobby.html)
   - 主舞台遊戲端：[http://localhost:8000/](http://localhost:8000/)
   - 手機報名與干擾端：[http://localhost:8000/join.html](http://localhost:8000/join.html)

---

### 🐳 容器啟動方式 (Docker & Container)

本專案已包含優化的 `Dockerfile` 與 `.dockerignore`，映像檔極為輕量（採用 `node:18-alpine`）。

#### 1. 使用 Docker 本機建置與運行

1. **建置 Docker 映像檔**：
   ```bash
   docker build -t beat-party-game:latest .
   ```
2. **啟動容器**：
   ```bash
   docker run -d -p 8080:8080 --name beat-party beat-party-game:latest
   ```
3. 瀏覽器造訪 [http://localhost:8080/lobby.html](http://localhost:8080/lobby.html)。

#### 2. 部署至 Google Cloud Run (或雲端容器平台)

本容器預設監聽 `PORT` 環境變數（Cloud Run 預設為 `8080`），支援一鍵部署：

```bash
# 1. 標記映像檔至 GCP Artifact Registry (請替換 PROJECT_ID, REGION 與 REPO_NAME)
export IMAGE_URI="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/YOUR_REPO/beat-party-game:latest"

# 2. 建置並推送至 Artifact Registry
docker build -t $IMAGE_URI .
docker push $IMAGE_URI

# 3. 部署至 Cloud Run
gcloud run deploy beat-party-game \
  --image=$IMAGE_URI \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --min-instances=0
```

---

## English

### 📖 Introduction & Gameplay Guide

**Beat Party Game (Say the Word on Beat)** is a fast-paced, interactive rhythm party game designed for parties, corporate events, team-building icebreakers, and family game nights. Inspired by the viral "Say the Word on Beat" trend, this game combines Web Audio synthesis, multi-room isolation, and real-time mobile spectator sabotage.

#### 🎮 How to Play
1. **Multi-Room Lobby**:
   - Create a dedicated game room with a single click in the Lobby. A unique 5-character alphanumeric room code (e.g., `RDQKR`) will be generated.
   - Join existing rooms with a code. Game configurations, participant rosters, and player interactions are isolated between rooms.
2. **Rhythm & Beat Challenge**:
   - Supports Warm-up and Advanced stages, with tailored BPM presets for Adults (183 BPM) and Kids (140 BPM).
   - **16 Beats per Round**:
     - **First 8 Beats (Preparation)**: Audio countdown voice line ("Ready, 1, 2, 3, GO!") and animated beat indicators.
     - **Next 8 Beats (Action)**: The 8-grid cards light up sequentially with a glowing green neon frame (`.on-beat-active`) from left to right, top to bottom. The player must shout the corresponding name or item on each beat!
   - Features standard 3-round sequential challenges and custom round limits.
3. **Mobile Join & Live Sabotage**:
   - Spectators can join instantly via mobile by scanning the QR code or visiting `join.html?room=ROOM_CODE`.
   - **Photo & Name Submission**: Upload selfies and names on the fly to inject real participants into the 8-grid roster.
   - **Live Sabotage Screen Overlays**: Audience members can fire real-time text barrages and meme image distractions right onto the main stage screen while the challenger is playing!
4. **Cross-Device Compatibility & Low-Latency Audio**:
   - One-click full-screen projection for TV/projector screens.
   - Powered by Web Audio API memory decoding with sample-accurate clocking, eliminating audio-visual desync glitches across iPad, iOS Chrome, and Safari.
   - Automatic room heartbeat monitoring and cleanup of inactive sessions.

---

### 🚀 Running Locally

The backend is built with pure Node.js and requires no external `npm install` dependencies.

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later recommended)

#### Steps
1. Navigate to the project directory:
   ```bash
   cd beat-party-game
   ```
2. Start the server:
   ```bash
   node server.js
   ```
   *(Default port is 8000; customize via environment variable, e.g., `PORT=3000 node server.js`)*
3. Open in your browser:
   - Lobby (Home): [http://localhost:8000/lobby.html](http://localhost:8000/lobby.html)
   - Game Stage: [http://localhost:8000/](http://localhost:8000/)
   - Mobile Join & Sabotage: [http://localhost:8000/join.html](http://localhost:8000/join.html)

---

### 🐳 Containerization & Deployment (Docker)

The project includes an optimized `Dockerfile` based on `node:18-alpine`.

#### 1. Build and Run Locally with Docker
1. **Build image**:
   ```bash
   docker build -t beat-party-game:latest .
   ```
2. **Run container**:
   ```bash
   docker run -d -p 8080:8080 --name beat-party beat-party-game:latest
   ```
3. Visit [http://localhost:8080/lobby.html](http://localhost:8080/lobby.html).

#### 2. Deploy to Google Cloud Run
```bash
export IMAGE_URI="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/YOUR_REPO/beat-party-game:latest"

docker build -t $IMAGE_URI .
docker push $IMAGE_URI

gcloud run deploy beat-party-game \
  --image=$IMAGE_URI \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --min-instances=0
```
