import sharp from "sharp";

import { loadPdfjsForNode } from "@/lib/pdfjsNode";

const ID_ASPECT = 8.57 / 5.4;

async function rasterizeToPng(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === "application/pdf" || buffer.slice(0, 4).toString() === "%PDF") {
    const pdfjs = await loadPdfjsForNode();
    const { createCanvas } = await import("@napi-rs/canvas");
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    await page
      .render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      })
      .promise;
    return canvas.toBuffer("image/png");
  }
  return sharp(buffer).png().toBuffer();
}

async function orientIdCard(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w <= 0 || h <= 0) return buf;
  const aspect = w / h;
  let pipeline = sharp(buf);
  if (aspect < 1) {
    pipeline = pipeline.rotate(90);
  }
  return pipeline.toBuffer();
}

async function resizeToIdCard(buf: Buffer): Promise<Buffer> {
  const oriented = await orientIdCard(buf);
  return sharp(oriented)
    .resize({
      width: 857,
      height: 540,
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();
}

async function splitTwoSides(png: Buffer): Promise<[Buffer, Buffer]> {
  const meta = await sharp(png).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 40 || h < 40) {
    const single = await resizeToIdCard(png);
    return [single, single];
  }

  const landscape = w >= h;
  if (landscape) {
    const half = Math.floor(w / 2);
    const left = await sharp(png).extract({ left: 0, top: 0, width: half, height: h }).toBuffer();
    const right = await sharp(png)
      .extract({ left: half, top: 0, width: w - half, height: h })
      .toBuffer();
    return [await resizeToIdCard(left), await resizeToIdCard(right)];
  }

  const half = Math.floor(h / 2);
  const top = await sharp(png).extract({ left: 0, top: 0, width: w, height: half }).toBuffer();
  const bottom = await sharp(png)
    .extract({ left: 0, top: half, width: w, height: h - half })
    .toBuffer();
  return [await resizeToIdCard(top), await resizeToIdCard(bottom)];
}

/** 從 PDF／圖片擷取正反面身分證影本（各 8.57×5.4 cm 比例） */
export async function extractIdCardPair(
  buffer: Buffer,
  mimeType: string,
): Promise<{ front: Buffer; back: Buffer } | null> {
  try {
    const png = await rasterizeToPng(buffer, mimeType);
    const [front, back] = await splitTwoSides(png);
    return { front, back };
  } catch (error) {
    console.error("[youthId] extractIdCardPair failed:", error);
    return null;
  }
}

export function idCardAspectOk(width: number, height: number): boolean {
  if (!width || !height) return false;
  const ratio = width / height;
  return Math.abs(ratio - ID_ASPECT) < 0.35 || Math.abs(ratio - 1 / ID_ASPECT) < 0.35;
}
