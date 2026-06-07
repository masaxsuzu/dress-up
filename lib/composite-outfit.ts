"use client";

import type { ClothingCategory, ClothingItem } from "@/schema/clothing";

const W = 720;
const H = 1100;
const CX = W / 2;

type Slot = { x: number; y: number; w: number; h: number };

const LAYER_ORDER: ClothingCategory[] = [
  "outerwear",
  "dress",
  "tops",
  "bottoms",
  "shoes",
  "bag",
  "accessory",
  "other",
];

const SLOTS: Partial<Record<ClothingCategory, Slot>> = {
  outerwear: { x: CX - 210, y: 170, w: 420, h: 440 },
  dress: { x: CX - 140, y: 210, w: 280, h: 520 },
  tops: { x: CX - 140, y: 210, w: 280, h: 270 },
  bottoms: { x: CX - 130, y: 460, w: 260, h: 320 },
  shoes: { x: CX - 120, y: 780, w: 240, h: 150 },
  bag: { x: CX + 110, y: 400, w: 180, h: 200 },
  accessory: { x: CX - 80, y: 100, w: 160, h: 110 },
  other: { x: CX - 80, y: 100, w: 160, h: 110 },
};

function drawBodyShadow(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = "rgba(20, 20, 20, 0.06)";
  ctx.filter = "blur(3px)";
  // head
  ctx.beginPath();
  ctx.ellipse(CX, 140, 52, 58, 0, 0, Math.PI * 2);
  ctx.fill();
  // torso
  ctx.beginPath();
  ctx.moveTo(CX - 125, 200);
  ctx.lineTo(CX + 125, 200);
  ctx.lineTo(CX + 100, 470);
  ctx.lineTo(CX - 100, 470);
  ctx.closePath();
  ctx.fill();
  // legs
  ctx.beginPath();
  ctx.moveTo(CX - 100, 470);
  ctx.lineTo(CX - 18, 470);
  ctx.lineTo(CX - 50, 790);
  ctx.lineTo(CX - 95, 790);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(CX + 18, 470);
  ctx.lineTo(CX + 100, 470);
  ctx.lineTo(CX + 95, 790);
  ctx.lineTo(CX + 50, 790);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export type CompositeProgress = {
  current: number;
  total: number;
  label: string;
};

export async function compositeOutfit(
  items: ClothingItem[],
  onProgress?: (p: CompositeProgress) => void,
): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unsupported");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  drawBodyShadow(ctx);

  const placeable = items
    .filter((i) => SLOTS[i.category])
    .sort(
      (a, b) =>
        LAYER_ORDER.indexOf(a.category) - LAYER_ORDER.indexOf(b.category),
    );

  const total = placeable.length;
  for (let i = 0; i < total; i++) {
    const item = placeable[i];
    onProgress?.({
      current: i,
      total,
      label: item.subcategory ?? item.category,
    });

    const cutoutBlob = await removeBackground(`/api/images/${item.imageKey}`);
    const bmp = await createImageBitmap(cutoutBlob);

    const slot = SLOTS[item.category]!;
    const scale = Math.min(slot.w / bmp.width, slot.h / bmp.height);
    const dw = bmp.width * scale;
    const dh = bmp.height * scale;
    const dx = slot.x + (slot.w - dw) / 2;
    const dy = slot.y + (slot.h - dh) / 2;
    ctx.drawImage(bmp, dx, dy, dw, dh);
    bmp.close();
  }

  onProgress?.({ current: total, total, label: "完成" });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      "image/png",
    );
  });
}
