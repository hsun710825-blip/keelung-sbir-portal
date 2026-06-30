/** Google 表單回覆試算表（身分證件彙整） */
export const YOUTH_ID_SPREADSHEET_ID =
  process.env.YOUTH_ID_SPREADSHEET_ID?.trim() ||
  "1UY8scW90GN_BKUWGY2bov-cK3tdIYvV9Qyk-aleEVuE";

/** Drive 上傳資料夾（表單 File responses） */
export const YOUTH_ID_DRIVE_FOLDER_ID =
  process.env.YOUTH_ID_DRIVE_FOLDER_ID?.trim() ||
  "13no59YUWdbm0aj208iwZdGKSDk8zRl7Bv8MbGKSYTYD6G_J9MaGFYxtAq22QsaEsoWg1EMLP";

export const YOUTH_ID_WORD_TITLE = "115年基隆市地方型SBIR提案業者身分證件彙整表";

/** Word 內身分證顯示尺寸（公分） */
export const ID_CARD_WIDTH_CM = 8.57;
export const ID_CARD_HEIGHT_CM = 5.4;

/** 一般提案每頁案數；聯合提案一案一頁 */
export const YOUTH_ID_WORD_CASES_PER_PAGE = 3;
