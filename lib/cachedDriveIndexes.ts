import { unstable_cache } from "next/cache";

import { buildPresentationFolderIndex } from "@/lib/reviewPresentationPdf";
import { buildReviewFolderPdfIndex } from "@/lib/reviewCompleteProposalPdf";

const REVIEW_INDEX_KEY = "review-folder-pdf-index-v1";
const PRESENTATION_INDEX_KEY = "presentation-folder-index-v1";
const INDEX_REVALIDATE_SECONDS = 600;

export const getCachedReviewFolderPdfIndex = unstable_cache(
  async () => buildReviewFolderPdfIndex(true),
  [REVIEW_INDEX_KEY],
  { revalidate: INDEX_REVALIDATE_SECONDS, tags: [REVIEW_INDEX_KEY] },
);

export const getCachedPresentationFolderIndex = unstable_cache(
  async () => buildPresentationFolderIndex(true),
  [PRESENTATION_INDEX_KEY],
  { revalidate: INDEX_REVALIDATE_SECONDS, tags: [PRESENTATION_INDEX_KEY] },
);
