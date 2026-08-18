type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

type CanvasGlobals = {
  DOMMatrix?: unknown;
  ImageData?: unknown;
  Path2D?: unknown;
};

let polyfilled = false;

function unavailable(): never {
  throw new Error("@napi-rs/canvas unavailable: PDF rendering is not supported here");
}

/**
 * pdfjs 在 Node 端靠 require("@napi-rs/canvas") 補 DOMMatrix/ImageData/Path2D，
 * 但 pdfjs 被 Next 打包後那個 require 追蹤不到、佈署上 Vercel 就解析失敗，
 * 載入 pdfjs 時會 throw `DOMMatrix is not defined`。改由這裡先補齊全域。
 */
async function ensureCanvasGlobals(): Promise<void> {
  if (polyfilled) return;
  polyfilled = true;
  const g = globalThis as unknown as CanvasGlobals;
  if (g.DOMMatrix && g.ImageData && g.Path2D) return;

  try {
    const canvas = await import("@napi-rs/canvas");
    g.DOMMatrix ??= canvas.DOMMatrix;
    g.ImageData ??= canvas.ImageData;
    g.Path2D ??= canvas.Path2D;
  } catch (err) {
    console.warn(
      "[pdfjsNode] cannot load @napi-rs/canvas:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 取純文字用不到真正的繪圖能力，補最小替身讓 pdfjs 至少能載入；
  // 若有人真的走到渲染路徑，這些替身會明確報錯而不是畫出錯誤結果。
  g.DOMMatrix ??= class {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    multiplySelf = unavailable;
    preMultiplySelf = unavailable;
    invertSelf = unavailable;
    translate = unavailable;
    scale = unavailable;
  };
  g.ImageData ??= class {
    constructor(
      public width: number,
      public height: number,
    ) {}
  };
  g.Path2D ??= class {
    addPath = unavailable;
  };
}

export async function loadPdfjsForNode(): Promise<PdfjsModule> {
  await ensureCanvasGlobals();
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}
