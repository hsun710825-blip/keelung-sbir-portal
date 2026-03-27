# 專案總表（Google Sheets）整合說明

## 功能摘要

| 動作 | 觸發時機 | 行為 |
|------|----------|------|
| A | 使用者進入撰寫頁 → `POST /api/registry/ensure` | 以 **OAuth** 建立／取得 Drive 資料夾；以 **Service Account** **每次「登入工作階段」新增一列**（A、B＝本次登入時間、J、K、L）。同一帳號可有多列。前端以 `sessionStorage` 避免同一分頁 **F5 重複**寫入；**登出**後再登入會再新增一列。 |
| B | 自動暫存或手動儲存 → `POST /api/draft` | 成功寫入草稿後，以 email 找 **最底下一列**，更新 **C～I、K（草稿）、L** |
| C | 確認送出 → `POST /api/submit`（JSON 含 `formData`） | Drive 上傳成功後，以 email 找 **最底下一列**，更新 **C～I、K＝已確認送出、L** |

## 試算表版面（請自行建立第一列標題）

| 欄位 | 內容 |
|------|------|
| A | 登入帳號 mail（唯一鍵） |
| B | 登入時間（**該次**進入撰寫頁／呼叫 ensure 的時間；同一帳號每次登入一列） |
| C | 統一編號 |
| D | 公司名稱 |
| E | 計畫名稱 |
| F | 負責人（封面欄位） |
| G | 計畫主持人（人力表 PI 姓名，無則負責人） |
| H | 聯絡人（團隊第一列姓名 → 公司代表人 → 負責人） |
| I | 聯絡電話（公司概況表單） |
| J | 專屬 Drive 資料夾連結 |
| K | 狀態：`草稿處理中` / `已確認送出` |
| L | 最後更新時間 |

**注意：** 程式預設**第 1 列為標題列**，資料從第 2 列開始寫入。若你的標題列在不同列，請設定 `GOOGLE_SHEETS_FIRST_DATA_ROW`。

## 環境變數（`.env.local` 與 Vercel 專案設定）

| 變數名稱 | 必填 | 說明 |
|----------|------|------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | 是* | 試算表 ID（網址 `.../d/<這裡>/edit`） |
| `GOOGLE_SHEET_ID` | 同上 | 與上一列擇一即可；舊版／Vercel 常用此名稱 |
| `GOOGLE_SHEETS_REGISTRY_SHEET_NAME` | 否 | 分頁名稱，預設 `專案總表` |
| `GOOGLE_SHEETS_FIRST_DATA_ROW` | 否 | 第一筆資料列號，預設 `2`（第 1 列為標題） |
| `GOOGLE_SHEETS_TIMEZONE` | 否 | 寫入 B／L 欄時間字串的時區，預設 `Asia/Taipei`（避免 Vercel UTC 與本地差 8 小時） |

\*未設定 `GOOGLE_SHEETS_SPREADSHEET_ID`（亦未設 `GOOGLE_SHEET_ID`）時，系統會**略過**所有 Sheets 寫入，其餘功能不受影響。

**Service Account JSON（與現有 Drive SA 相同）：**

| 方式 | 說明 |
|------|------|
| **`GOOGLE_SERVICE_ACCOUNT_JSON`** | 將整份 Service Account JSON 貼成環境變數（單行亦可）。`private_key` 換行用 `\n`。 |
| **`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`** | 與上一組擇一即可；常見於 Vercel 分開設定。私鑰須為完整 PEM（含 `-----BEGIN PRIVATE KEY-----` … `-----END PRIVATE KEY-----`）。可貼多行，或單行並以 `\n` 代表換行；程式會嘗試修正常見貼上錯誤。若仍出現 `DECODER routines::unsupported`，請改貼整份 `GOOGLE_SERVICE_ACCOUNT_JSON`。 |
| **`google-credentials.json`** | 僅本機：放在專案根目錄（勿提交 Git）。 |

## 試算表「打開是空白」排查

1. **分頁名稱**：檔名（例如「登入彙總表」）與**底部分頁標籤**不同。程式預設寫入名為 **`專案總表`** 的分頁。若只有「工作表1」，請把該分頁**重新命名**為 `專案總表`，或在 Vercel 設定 `GOOGLE_SHEETS_REGISTRY_SHEET_NAME=工作表1`（名稱須完全一致）。
2. **`GOOGLE_SHEETS_SPREADSHEET_ID`**：須為該試算表網址 `.../spreadsheets/d/<這段ID>/edit` 中的 ID。
3. **Vercel 金鑰**：已設定試算表 ID 但仍空白，多半是**未設定 `GOOGLE_SERVICE_ACCOUNT_JSON`**，伺服端無法用 Service Account 呼叫 Sheets API。
4. **第 1 列標題**：建議手動在第 1 列貼上欄位標題（A～L）；資料會從第 2 列起寫入。即使沒標題，程式仍會 append 資料列，但若分頁名稱錯誤則不會成功。

## Google Cloud Console 設定步驟（簡要）

1. **API 與服務 → 程式庫**：啟用 **Google Sheets API**（若僅用 SA 寫入試算表，Drive API 若已由其他用途啟用可略）。
2. **IAM 與管理 → 服務帳戶**：建立或沿用既有服務帳戶，產生 **JSON 金鑰**，下載為 `google-credentials.json`（勿提交至 Git）。
3. **試算表共用**：開啟目標試算表 →「共用」→ 將服務帳戶的 **client_email**（例如 `xxx@xxx.iam.gserviceaccount.com`）加入為**編輯者**。
4. 複製試算表 ID 到 `GOOGLE_SHEETS_SPREADSHEET_ID`。
5. 在試算表新增分頁，名稱與 `GOOGLE_SHEETS_REGISTRY_SHEET_NAME` 一致（預設請建立名為 `專案總表` 的分頁），並於第 1 列貼上欄位標題。

## OAuth 與 Service Account 分工

- **Drive 使用者資料夾**：仍使用既有 **Refresh Token（OAuth）** 流程，與草稿／上傳一致。
- **Sheets 專案總表**：僅使用 **Service Account**，不需使用者對 Sheets 額外授權。
