# 基隆 SBIR 申請網站 — Agent 交接說明

> 換電腦／新 Cursor 對話時，請先讀本檔與 `git log -5`，再繼續工作。

## 專案

| 項目 | 內容 |
|------|------|
| Repo | `https://github.com/hsun710825-blip/keelung-sbir-portal` |
| 正式站 | https://www.keelungsbir.tw |
| 框架 | Next.js 16、Prisma/PostgreSQL、Vercel 自動部署（`main`） |
| 本機路徑 | 任意；以 clone 後的資料夾為準 |

## 完成後預設流程

1. `npm run build` 驗證
2. `git commit` + `git push origin main`（僅在用戶要求或已同意時）
3. `npm run deploy` 部署正式站

## 勿擅自變更（除非用戶明確要求）

- 申請人前台 UI：`app/page.tsx`
- 決算清表業務邏輯：申請經費三欄自計畫書帶入、建議自籌沿用申請自籌、排名規則
- 委員簡報：Drive 資料夾對照規則；對不到則留空

## 重要功能現況（115 複審）

### 決算清表 `/admin/settlement`

- 申請補助／自籌／總計：自 `humanBudget.budgetRows` 合計列或明細 fallback 帶入，可手動改
- 建議補助、建議總計：預設空白；建議自籌：沿用申請自籌
- 關鍵檔：`lib/settlementTable.ts`、`lib/settlementBudget.ts`

### 委員簡報

- Drive 根資料夾：`1TaRpmHR1t8XeVa8UgfE4hTjcczdlwTOi`（`115SBIR審查簡報`）
- 子資料夾：`0622`、`0701`；檔名如 `1.公司簡報.pdf`
- 對照：議程序號 + 公司名稱；無檔案則委員頁留空
- 關鍵檔：`lib/reviewPresentationPdf.ts`、`lib/resolveCommitteePresentationPdf.ts`

### 計畫書 PDF

- 優先 PO 審查完整版 Drive 資料夾（0622/0701 各一），再 fallback 草稿／上傳
- 關鍵檔：`lib/reviewCompleteProposalPdf.ts`、`lib/resolveApplicationProposalPdf.ts`

### 效能（Phase 2 已上線）

- 決算／委員列表減少重複 DB、Drive 查詢
- Drive 索引 `unstable_cache` 10 分鐘
- 委員 PDF API：`Cache-Control: private, max-age=300`
- 關鍵檔：`lib/cachedAuth.ts`、`lib/cachedDriveIndexes.ts`

## 議程資料

- `lib/data/reviewMeetingAgenda.json`（6/22 共 12 案、7/1 共 14 案）

## 環境變數（不在 Git，換機需手動複製）

- `.env`、`.env.local`（DB、Google OAuth、Drive 服務帳號、`NEXTAUTH_SECRET` 等）
- 換機後：`npm install`，還原 env，必要時 `npx vercel login`

## 常用測試 URL

| 角色 | 路徑 |
|------|------|
| PO 案件總表 | `/admin/dashboard` |
| PO 決算清表 | `/admin/settlement` |
| 委員場次 | `/committee/dashboard` |
| 委員總表 | `/committee/summary` |
| 委員案件 | `/committee/application/[id]?meeting=0622` |

## 新對話開場建議

```
請先讀 AGENTS.md 與 git log -5，我們繼續基隆 SBIR 後台／委員端。
本次要做：（填你的任務）
```
