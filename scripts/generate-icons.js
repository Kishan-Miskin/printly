const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const iconsDir = path.join(__dirname, "..", "public", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Generate crisp SVG Icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="104" fill="#09090b"/>
  <!-- Printer Top Paper -->
  <path d="M160 144V80C160 71.1634 167.163 64 176 64H336C344.837 64 352 71.1634 352 80V144" fill="#ffffff" fill-opacity="0.9"/>
  <!-- Printer Body -->
  <rect x="80" y="144" width="352" height="176" rx="36" fill="#18181b" stroke="#27272a" stroke-width="12"/>
  <!-- Printer Output Tray -->
  <rect x="136" y="272" width="240" height="160" rx="20" fill="#ffffff"/>
  <rect x="168" y="320" width="176" height="16" rx="8" fill="#e4e4e7"/>
  <rect x="168" y="356" width="128" height="16" rx="8" fill="#e4e4e7"/>
  <!-- Power Status LED (Emerald Green) -->
  <circle cx="384" cy="192" r="14" fill="#10b981"/>
</svg>`;

fs.writeFileSync(path.join(iconsDir, "icon.svg"), svgIcon);

// CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const chunkForCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(chunkForCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;

  // Raw RGBA scanlines with filter byte 0 at start of each line
  const rawBytes = Buffer.alloc(height * (1 + width * 4));
  let ptr = 0;

  for (let y = 0; y < height; y++) {
    rawBytes[ptr++] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;

      // Dark background #09090b
      let r = 9;
      let g = 9;
      let b = 11;
      let a = 255;

      // Printer Paper shape
      if (nx >= 0.32 && nx <= 0.68 && ny >= 0.14 && ny <= 0.30) {
        r = 250; g = 250; b = 250;
      }
      // Printer Machine Body
      else if (nx >= 0.18 && nx <= 0.82 && ny >= 0.28 && ny <= 0.62) {
        // Status light
        const dx = nx - 0.74;
        const dy = ny - 0.38;
        if (dx * dx + dy * dy <= 0.0012) {
          r = 16; g = 185; b = 129; // Green light
        } else {
          r = 28; g = 28; b = 34; // Printer body
        }
      }
      // Printed Document Output
      else if (nx >= 0.28 && nx <= 0.72 && ny >= 0.54 && ny <= 0.84) {
        r = 255; g = 255; b = 255;
        // Text lines on paper
        if ((ny >= 0.64 && ny <= 0.67 && nx <= 0.64) || (ny >= 0.72 && ny <= 0.75 && nx <= 0.56)) {
          r = 200; g = 200; b = 205;
        }
      }

      rawBytes[ptr++] = r;
      rawBytes[ptr++] = g;
      rawBytes[ptr++] = b;
      rawBytes[ptr++] = a;
    }
  }

  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const idatData = zlib.deflateSync(rawBytes);

  const png = Buffer.concat([
    header,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", idatData),
    createChunk("IEND", Buffer.alloc(0)),
  ]);

  return png;
}

// Write icons
const icon192 = generatePng(192);
const icon512 = generatePng(512);

fs.writeFileSync(path.join(iconsDir, "icon-192.png"), icon192);
fs.writeFileSync(path.join(iconsDir, "icon-512.png"), icon512);
fs.writeFileSync(path.join(iconsDir, "icon-maskable-192.png"), icon192);
fs.writeFileSync(path.join(iconsDir, "icon-maskable-512.png"), icon512);

console.log("Successfully generated PWA icons (192px, 512px, SVG, maskable) in public/icons/");
