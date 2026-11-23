FROM node:18-alpine

WORKDIR /app

# 設定環境變數 (Cloud Run 預設會注入 PORT 變數，通常為 8080)
ENV NODE_ENV=production
ENV PORT=8080

# 複製專案原始碼至容器
COPY . .

# 建立房間資料儲存目錄
RUN mkdir -p rooms-data

# 開放埠號
EXPOSE 8080

# 啟動 Node.js 伺服器
CMD ["node", "server.js"]
