# 基隆市 SBIR 申請系統

## 專案簡介 (Project Overview)

本系統為「地方型 SBIR 計畫書」線上申請平台，提供廠商：
- 線上分章填寫計畫內容
- 草稿儲存與附件上傳
- 送件前 PDF 預覽與下載
- 正式送件至後端儲存流程

系統目標為支援政府補助申請流程，並兼顧資料一致性與資安防護。

## 技術棧 (Tech Stack)

- 前端：`Next.js (App Router)`、`React`、`TypeScript`、`Tailwind CSS`
- 後端：`Next.js Route Handlers`（`app/api/**/route.ts`）
- 文件輸出：`pdf-lib`、`@react-pdf/renderer`
- 認證：`next-auth`（Google Provider）
- 雲端儲存：Google Drive API（OAuth / Service Account fallback）
- 資料淨化：`xss`

> 備註：本專案主要資料儲存流程依賴 Google Drive / Google Sheets，非傳統 ORM 資料庫架構。

## 核心架構與資安防護 (Architecture & Security)

目前已實作的主要資安防護如下：

1. **HTTP 安全標頭**
   - 透過 `next.config.ts` 全域 `headers()` 追加：
   - `X-DNS-Prefetch-Control`
   - `Strict-Transport-Security`
   - `X-XSS-Protection`
   - `X-Frame-Options`
   - `X-Content-Type-Options`
   - `Referrer-Policy`

2. **API 權限驗證與 IDOR 防護**
   - 重要 API（草稿、上傳、送件）需登入 Session。
   - 後端驗證資源是否屬於當前登入者資料夾範圍，不符則阻擋。

3. **資料淨化**
   - 伺服器端對表單字串做遞迴淨化，降低惡意標籤注入風險。

4. **檔案上傳防護**
   - MIME 白名單驗證、單檔容量限制（10MB）、UUID 重命名。

5. **狀態鎖定與軟刪除**
   - 已送出/已過期/已刪除計畫會進入鎖定，更新/刪除/上傳將被拒絕。
   - 草稿刪除採軟刪除欄位（`isDeleted` / `deletedAt`）。

6. **稽核軌跡**
   - 關鍵操作寫入 `.data/audit.log`（使用者、動作、目標、時間）。

## PDF 產出引擎特別說明 (PDF Generation Guidelines)

本系統 PDF 產製位於 `app/api/pdf/route.ts`，請遵守以下規範：

- 不使用 HTML `table` 排版（PDF 不是 DOM 渲染）。
- 以 `View/Flex` 概念對應或 `pdf-lib` 線條座標繪製表格。
- 複雜表頭採「扁平網格 + 固定比例欄寬」避免巢狀誤差。
- 需要整塊不分頁時，使用 `wrap={false}` 概念或等價保留空間策略（`ensure(...)`）。
- 對於 `(三) 計畫人力統計`，必須維持既定欄位比例拓撲，不可任意改為多層 column 包覆。

## 環境變數與啟動說明 (Getting Started)

### 1) 安裝套件

```bash
npm install
```

### 2) 設定 `.env.local`

請至少設定下列變數（依實際部署環境補齊）：

```bash
# NextAuth / Google Login
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# Google Drive OAuth（草稿/上傳）
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=

# Google Service Account（送件 fallback）
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=

# Google Sheets（專案總表同步）
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEET_ID=
```

### 3) 本機啟動

```bash
npm run dev
```

啟動後開啟：`http://localhost:3000`

### 4) 建置測試

```bash
npm run build
```

### 5) 正式部署（Vercel）

```bash
npx vercel deploy --prod --yes
```
