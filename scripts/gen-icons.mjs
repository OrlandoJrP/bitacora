// Genera los iconos PNG (favicon, apple-touch, PWA) desde el isotipo de brújula.
// Ejecutar: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0A2540"/>
  <g transform="translate(106,106) scale(4.7)">
    <circle cx="32" cy="32" r="30" stroke="#D4A574" stroke-width="2.5" fill="none"/>
    <circle cx="32" cy="32" r="23" stroke="#D4A574" stroke-width="1" opacity="0.35" fill="none"/>
    <path d="M32 9 L38 32 L32 30 Z" fill="#D4A574"/>
    <path d="M32 55 L26 32 L32 34 Z" fill="#FAF7F2"/>
    <path d="M9 32 L32 26 L30 32 Z" fill="#FAF7F2" opacity="0.85"/>
    <path d="M55 32 L32 38 L34 32 Z" fill="#D4A574" opacity="0.85"/>
    <circle cx="32" cy="32" r="3.4" fill="#D4A574"/>
  </g>
</svg>`;

const buf = Buffer.from(svg);
mkdirSync("public", { recursive: true });

const targets = [
  { file: "app/icon.png", size: 256 },
  { file: "app/apple-icon.png", size: 180 },
  { file: "public/icon-192.png", size: 192 },
  { file: "public/icon-512.png", size: 512 },
];

for (const { file, size } of targets) {
  await sharp(buf, { density: 300 }).resize(size, size).png().toFile(file);
  console.log(`✓ ${file} (${size}x${size})`);
}
console.log("Iconos generados.");
