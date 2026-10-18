/**
 * npm run icons
 * Renders the hand-written SVG logos in public/brand/ into the raster icons browsers need:
 *   src/app/favicon.ico      16, 32 and 48 px
 *   src/app/icon.svg         vector favicon
 *   src/app/apple-icon.png   180 px
 *   src/app/opengraph-image.png  1200 x 630 social card
 *   public/brand/apple-touch-icon.png, public/brand/favicon.ico (copies for direct linking)
 * With `--preview <dir>` it also writes PNG previews at 16, 32 and 256 px for visual checks.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const brand = (name: string) => path.join(root, "public", "brand", name);
const app = (name: string) => path.join(root, "src", "app", name);

const png = (svgFile: string, size: number) => sharp(fs.readFileSync(svgFile), { density: 384 }).resize(size, size).png().toBuffer();

/** Packs PNG images into a single .ico file (PNG-compressed entries). */
function toIco(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  const favicon = brand("favicon.svg");
  const ico = toIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(favicon, size) }))));
  fs.writeFileSync(app("favicon.ico"), ico);
  fs.writeFileSync(brand("favicon.ico"), ico);
  fs.copyFileSync(favicon, app("icon.svg"));

  const apple = await png(brand("logo-mark.svg"), 180);
  fs.writeFileSync(app("apple-icon.png"), apple);
  fs.writeFileSync(brand("apple-touch-icon.png"), apple);

  // Social card: dark background, VKY mark, wordmark and tagline.
  const mark = (await png(brand("logo-vky-dark.svg"), 220)).toString("base64");
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <radialGradient id="a1" cx="0.75" cy="0.1" r="0.6"><stop offset="0" stop-color="#7c3aed" stop-opacity="0.55"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></radialGradient>
      <radialGradient id="a2" cx="0.05" cy="0.85" r="0.55"><stop offset="0" stop-color="#0d9488" stop-opacity="0.45"/><stop offset="1" stop-color="#0d9488" stop-opacity="0"/></radialGradient>
      <linearGradient id="two" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#7dd3fc"/></linearGradient>
    </defs>
    <rect width="1200" height="630" fill="#07070d"/>
    <rect width="1200" height="630" fill="url(#a1)"/>
    <rect width="1200" height="630" fill="url(#a2)"/>
    <image href="data:image/png;base64,${mark}" x="90" y="110" width="220" height="220"/>
    <text x="90" y="430" font-family="'Segoe UI', Arial, sans-serif" font-size="84" font-weight="700" fill="#ffffff">Culture<tspan fill="url(#two)">2</tspan>Commerce</text>
    <text x="92" y="492" font-family="'Segoe UI', Arial, sans-serif" font-size="34" fill="#d9d7ea">Turn cultural signals into business opportunities.</text>
    <text x="92" y="560" font-family="'Segoe UI', Arial, sans-serif" font-size="26" fill="#a9a7c0">Team VKY · Built on Qloo’s taste graph</text>
  </svg>`;
  const og = await sharp(Buffer.from(card)).png().toBuffer();
  fs.writeFileSync(app("opengraph-image.png"), og);
  fs.writeFileSync(brand("social-card.png"), og);

  console.log("Wrote favicon.ico, icon.svg, apple-icon.png, opengraph-image.png and brand copies.");

  const previewAt = process.argv.indexOf("--preview");
  const previewDir = previewAt >= 0 ? process.argv[previewAt + 1] : undefined;
  if (previewDir) {
    fs.mkdirSync(previewDir, { recursive: true });
    for (const name of ["favicon", "logo-mark", "logo-mark-dark", "logo-vky", "logo-vky-dark"]) {
      for (const size of [16, 32, 256]) fs.writeFileSync(path.join(previewDir, `${name}-${size}.png`), await png(brand(`${name}.svg`), size));
    }
    for (const [name, bg] of [["logo-full", "#ffffff"], ["logo-full-dark", "#07070d"]] as const) {
      const buf = await sharp(fs.readFileSync(brand(`${name}.svg`)), { density: 288 }).flatten({ background: bg }).png().toBuffer();
      fs.writeFileSync(path.join(previewDir, `${name}.png`), buf);
    }
    // One contact sheet so all sizes can be checked at a glance (small icons are shown at true size and 8x).
    const tiles: { input: Buffer; left: number; top: number }[] = [];
    let x = 20;
    for (const name of ["favicon", "logo-mark", "logo-vky", "logo-vky-dark", "logo-mark-dark"]) {
      tiles.push({ input: await png(brand(`${name}.svg`), 256), left: x, top: 20 });
      tiles.push({ input: await png(brand(`${name}.svg`), 32), left: x, top: 296 });
      tiles.push({ input: await png(brand(`${name}.svg`), 16), left: x + 48, top: 296 });
      tiles.push({ input: await sharp(await png(brand(`${name}.svg`), 16)).resize(128, 128, { kernel: "nearest" }).png().toBuffer(), left: x + 80, top: 296 });
      x += 276;
    }
    tiles.push({ input: fs.readFileSync(path.join(previewDir, "logo-full.png")), left: 20, top: 450 });
    tiles.push({ input: fs.readFileSync(path.join(previewDir, "logo-full-dark.png")), left: 720, top: 450 });
    await sharp({ create: { width: 1420, height: 620, channels: 4, background: "#b9b6c9" } }).composite(tiles).png().toFile(path.join(previewDir, "contact-sheet.png"));
    console.log(`Previews written to ${previewDir}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
