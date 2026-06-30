import { unstable_cache } from "next/cache";

import { loadYouthIdSheetRows } from "@/lib/youthId/sheetSync";

const YOUTH_SHEET_CACHE_KEY = "youth-id-sheet-rows-v1";
const YOUTH_SHEET_REVALIDATE_SECONDS = 600;

export const getCachedYouthIdSheetRows = unstable_cache(
  async () => loadYouthIdSheetRows(),
  [YOUTH_SHEET_CACHE_KEY],
  { revalidate: YOUTH_SHEET_REVALIDATE_SECONDS, tags: [YOUTH_SHEET_CACHE_KEY] },
);
