// アイテム一覧を写真付き PDF に書き出す (クライアント専用)。
// jsPDF の標準フォントは日本語グリフを持たないため、フォント埋め込みは
// せず 1 ページを canvas に丸ごとラスタライズして画像として埋め込む
// (ブラウザの canvas 2D テキスト描画は OS の日本語フォントを使える)。
import type { ClothingItem } from "@/schema/clothing";
import { itemLabel, SEASON_LABEL, PATTERN_LABEL, FORMALITY_LABEL } from "@/app/_lib/labels";

const PX_PER_MM = 4;
const PAGE_W = 210 * PX_PER_MM;
const PAGE_H = 297 * PX_PER_MM;
const MARGIN = 15 * PX_PER_MM;
const HEADER_H = 26 * PX_PER_MM;
const ROW_H = 25 * PX_PER_MM;
const THUMB = 21 * PX_PER_MM;
const CONTENT_W = PAGE_W - MARGIN * 2;

function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + "…";
}

async function loadBitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function drawThumbnail(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap | null,
  x: number,
  y: number,
) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, THUMB, THUMB);
  ctx.strokeRect(x, y, THUMB, THUMB);

  if (!bitmap) {
    ctx.fillStyle = "#999";
    ctx.font = `${3 * PX_PER_MM}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("画像なし", x + THUMB / 2, y + THUMB / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    return;
  }

  const scale = Math.min(THUMB / bitmap.width, THUMB / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, x + (THUMB - w) / 2, y + (THUMB - h) / 2, w, h);
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  item: ClothingItem,
  bitmap: ImageBitmap | null,
  rowTop: number,
) {
  drawThumbnail(ctx, bitmap, MARGIN, rowTop + (ROW_H - THUMB) / 2);

  const textX = MARGIN + THUMB + 4 * PX_PER_MM;
  const textW = MARGIN + CONTENT_W - textX;

  ctx.fillStyle = "#111";
  ctx.font = `bold ${3.6 * PX_PER_MM}px sans-serif`;
  let title = itemLabel(item.category, item.subcategory);
  if (item.brand) title += `　${item.brand}`;
  ctx.fillText(truncate(ctx, title, textW), textX, rowTop + 8 * PX_PER_MM);

  // 色スウォッチ
  let swatchX = textX;
  const swatchY = rowTop + 13 * PX_PER_MM;
  const r = 1.6 * PX_PER_MM;
  for (const c of item.colors) {
    ctx.fillStyle = c.hex;
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(swatchX + r, swatchY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    swatchX += r * 2 + 1.5 * PX_PER_MM;
  }

  ctx.fillStyle = "#666";
  ctx.font = `${3 * PX_PER_MM}px sans-serif`;
  const detailParts = [
    item.season.map((s) => SEASON_LABEL[s]).join("/"),
    item.pattern ? PATTERN_LABEL[item.pattern] : null,
    FORMALITY_LABEL[item.formality],
  ].filter((p): p is string => !!p);
  ctx.fillText(
    truncate(ctx, detailParts.join("・"), textW),
    textX,
    rowTop + 19 * PX_PER_MM,
  );

  // 区切り線
  ctx.strokeStyle = "#eee";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, rowTop + ROW_H);
  ctx.lineTo(MARGIN + CONTENT_W, rowTop + ROW_H);
  ctx.stroke();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  count: number,
  generatedAt: Date,
) {
  ctx.fillStyle = "#111";
  ctx.font = `bold ${5 * PX_PER_MM}px sans-serif`;
  ctx.fillText("dress-up ワードローブ一覧", MARGIN, MARGIN + 6 * PX_PER_MM);

  ctx.fillStyle = "#666";
  ctx.font = `${3 * PX_PER_MM}px sans-serif`;
  const dateStr = generatedAt.toLocaleDateString("ja-JP");
  ctx.fillText(
    `生成日: ${dateStr}　全 ${count} 件`,
    MARGIN,
    MARGIN + 12 * PX_PER_MM,
  );
}

function newPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context を取得できません");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  return { canvas, ctx };
}

export async function buildWardrobePdf(items: ClothingItem[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const now = new Date();

  const rowsPerPage = Math.floor(
    (PAGE_H - MARGIN - HEADER_H) / ROW_H,
  );

  let page = 0;
  let ctx: CanvasRenderingContext2D | null = null;
  let canvas: HTMLCanvasElement | null = null;

  for (let i = 0; i < items.length; i++) {
    const indexInPage = i % rowsPerPage;
    if (indexInPage === 0) {
      if (canvas) {
        if (page > 0) doc.addPage();
        doc.addImage(canvas.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, 210, 297);
        page++;
      }
      ({ canvas, ctx } = newPageCanvas());
      drawHeader(ctx, items.length, now);
    }

    const bitmap = await loadBitmap(
      `/api/images/${items[i].iconKey ?? items[i].imageKey}`,
    );
    const rowTop = MARGIN + HEADER_H + indexInPage * ROW_H;
    drawRow(ctx!, items[i], bitmap, rowTop);
  }

  if (canvas) {
    if (page > 0) doc.addPage();
    doc.addImage(canvas.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, 210, 297);
  } else {
    // アイテム 0 件でも空ページ 1 枚は返す
    const empty = newPageCanvas();
    drawHeader(empty.ctx, 0, now);
    doc.addImage(empty.canvas.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, 210, 297);
  }

  return doc.output("blob");
}
