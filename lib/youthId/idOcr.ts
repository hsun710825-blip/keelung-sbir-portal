import { createWorker } from "tesseract.js";

import { downloadDriveFile } from "@/lib/youthId/driveFiles";
import { extractIdCardPair } from "@/lib/youthId/idImageExtract";

export type IdOcrResult = {
  rocBirthYear: number | null;
  age: number | null;
  registeredCity: string | null;
  qualifies: boolean | null;
  readError: string | null;
};

const ROC_BIRTH_YEAR_MIN = 70;
const ROC_BIRTH_YEAR_MAX = 97;

function currentRocYear(): number {
  return new Date().getFullYear() - 1911;
}

function ageFromRocYear(rocYear: number): number {
  return currentRocYear() - rocYear;
}

function isYouthRocYear(rocYear: number): boolean {
  return rocYear >= ROC_BIRTH_YEAR_MIN && rocYear <= ROC_BIRTH_YEAR_MAX;
}

function parseRocBirthYearFromText(text: string): number | null {
  const normalized = text.replace(/\s+/g, "");

  const patterns = [
    /民國(\d{2,3})年/,
    /出生年月日[^\d]*(\d{3})(\d{2})(\d{2})/,
    /(\d{3})年(\d{1,2})月(\d{1,2})日/,
  ];

  for (const re of patterns) {
    const m = normalized.match(re);
    if (!m) continue;
    const y = parseInt(m[1], 10);
    if (y >= ROC_BIRTH_YEAR_MIN && y <= ROC_BIRTH_YEAR_MAX) return y;
  }

  const compactMatches = normalized.match(/(?:^|[^\d])(7\d|8\d|9[0-7])\d{4}(?:[^\d]|$)/g);
  if (compactMatches) {
    for (const token of compactMatches) {
      const digits = token.replace(/\D/g, "");
      if (digits.length >= 7) {
        const y = parseInt(digits.slice(0, 3), 10);
        if (y >= ROC_BIRTH_YEAR_MIN && y <= ROC_BIRTH_YEAR_MAX) return y;
      }
    }
  }

  return null;
}

function parseRegisteredCityFromText(text: string): string | null {
  if (/基隆市/.test(text)) return "基隆市";
  const m = text.match(
    /(基隆市|台北市|新北市|桃園市|台中市|台南市|高雄市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|澎湖縣|金門縣|連江縣)/,
  );
  return m ? m[1] : null;
}

async function ocrImageBuffer(image: Buffer): Promise<string> {
  const worker = await createWorker("chi_tra");
  try {
    const { data } = await worker.recognize(image);
    return data.text || "";
  } finally {
    await worker.terminate();
  }
}

function buildResult(rocYear: number | null, city: string | null): IdOcrResult {
  const age = rocYear != null ? ageFromRocYear(rocYear) : null;
  const ageOk = rocYear != null ? isYouthRocYear(rocYear) : null;
  const cityOk = city != null ? city.includes("基隆") : null;

  let qualifies: boolean | null = null;
  if (ageOk != null && cityOk != null) {
    qualifies = ageOk && cityOk;
  } else if (ageOk === false || cityOk === false) {
    qualifies = false;
  }

  return {
    rocBirthYear: rocYear,
    age,
    registeredCity: city,
    qualifies,
    readError: rocYear == null && city == null ? "無法從證件判讀" : null,
  };
}

export async function ocrIdCardFromDriveFile(
  driveFileId: string,
  mimeTypeHint?: string,
): Promise<IdOcrResult> {
  try {
    const { buffer, mimeType } = await downloadDriveFile(driveFileId);
    const pair = await extractIdCardPair(buffer, mimeTypeHint || mimeType);
    if (!pair) {
      return {
        rocBirthYear: null,
        age: null,
        registeredCity: null,
        qualifies: null,
        readError: "無法解析證件影像",
      };
    }

    const [frontText, backText] = await Promise.all([
      ocrImageBuffer(pair.front),
      ocrImageBuffer(pair.back),
    ]);

    const rocYear = parseRocBirthYearFromText(frontText);
    const city = parseRegisteredCityFromText(backText) || parseRegisteredCityFromText(frontText);
    return buildResult(rocYear, city);
  } catch (error) {
    console.error("[youthId ocr]", error);
    return {
      rocBirthYear: null,
      age: null,
      registeredCity: null,
      qualifies: null,
      readError: "證件判讀失敗",
    };
  }
}
