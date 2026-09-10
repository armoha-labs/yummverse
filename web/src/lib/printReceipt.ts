const PAGE_STYLE_ID = "receipt-page-size";
const RECEIPT_WIDTH_MM = 88;
// Padding/rounding slack so the last line never gets clipped by an under-measured page.
const HEIGHT_SLACK_MM = 8;
const MIN_HEIGHT_MM = 40;
const IMAGE_LOAD_TIMEOUT_MS = 2000;

function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true }); // a broken logo shouldn't block printing
    setTimeout(done, IMAGE_LOAD_TIMEOUT_MS);
  });
}

/** Prints the #receipt-print-area element, sizing the printed page's height to its actual
 * rendered content instead of a fixed guess (index.css's @media print block handles which
 * element gets printed at all — this only controls the physical page dimensions). A real
 * 88mm thermal printer would otherwise feed a wastefully long blank receipt for a short
 * order, or clip a long one. Width stays fixed at 88mm to match real thermal paper.
 *
 * Waits for any images inside (the café's logo) to finish loading first — printing before a
 * slow-loading logo resolves would either print a blank box or measure the page too short. */
export async function printReceipt(): Promise<void> {
  const el = document.getElementById("receipt-print-area");
  if (el) {
    const images = Array.from(el.querySelectorAll("img"));
    await Promise.all(images.map(waitForImage));
  }

  const heightPx = el?.scrollHeight ?? 0;
  // 96 CSS px per inch, 25.4mm per inch.
  const heightMm = Math.max(MIN_HEIGHT_MM, Math.ceil((heightPx / 96) * 25.4) + HEIGHT_SLACK_MM);

  let style = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = PAGE_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${RECEIPT_WIDTH_MM}mm ${heightMm}mm; margin: 0; }`;

  window.print();
}
