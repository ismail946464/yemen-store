import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function blendPixel(buf, width, height, x, y, r, g, b, alpha) {
  if (x < 0 || y < 0 || x >= width || y >= height || alpha <= 0) return;
  const idx = (y * width + x) * 4;
  const a = Math.min(1, Math.max(0, alpha));
  const inv = 1 - a;
  buf[idx] = Math.round(r * a + buf[idx] * inv);
  buf[idx + 1] = Math.round(g * a + buf[idx + 1] * inv);
  buf[idx + 2] = Math.round(b * a + buf[idx + 2] * inv);
  buf[idx + 3] = 255;
}

function drawCapsule(buf, size, x1, y1, x2, y2, radius, color) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius - 2));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + radius + 2));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius - 2));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + radius + 2));

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let t = 0;
      if (lenSq > 0) {
        t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const dist = Math.hypot(x - px, y - py);
      if (dist <= radius + 1) {
        const cov = Math.max(0, Math.min(1, radius + 0.5 - dist));
        blendPixel(buf, size, size, x, y, color[0], color[1], color[2], cov);
      }
    }
  }
}

function drawCircle(buf, size, cx, cy, radius, color) {
  const minX = Math.max(0, Math.floor(cx - radius - 2));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius + 2));
  const minY = Math.max(0, Math.floor(cy - radius - 2));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius + 2));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= radius + 1) {
        const cov = Math.max(0, Math.min(1, radius + 0.5 - dist));
        blendPixel(buf, size, size, x, y, color[0], color[1], color[2], cov);
      }
    }
  }
}

function drawIcon(size, maskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = [17, 18, 20]; // #111214
  const fg = [244, 244, 242]; // #F4F4F2
  const accent = [16, 185, 129]; // #10B981
  const border = [44, 49, 60]; // #2C313C

  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = bg[0];
    buf[i * 4 + 1] = bg[1];
    buf[i * 4 + 2] = bg[2];
    buf[i * 4 + 3] = 255;
  }

  // Subtle architectural inner border frame for non-maskable icons
  const scale = maskable ? 0.68 : 0.88;
  const offset = (size * (1 - scale)) / 2;
  const s = (v) => offset + (v / 512) * size * scale;
  const stroke = Math.max(2, (13 / 512) * size * scale);

  if (!maskable) {
    const pad = Math.round(size * 0.06);
    const bStroke = Math.max(1.5, size * 0.012);
    drawCapsule(buf, size, pad, pad, size - pad, pad, bStroke, border);
    drawCapsule(buf, size, size - pad, pad, size - pad, size - pad, bStroke, border);
    drawCapsule(buf, size, size - pad, size - pad, pad, size - pad, bStroke, border);
    drawCapsule(buf, size, pad, size - pad, pad, pad, bStroke, border);
  }

  // Handle arc (emerald #10B981)
  const arcCx = s(256);
  const arcCy = s(172);
  const arcR = (54 / 512) * size * scale;
  const steps = 48;
  for (let i = 0; i < steps; i++) {
    const a1 = Math.PI + (Math.PI * i) / steps;
    const a2 = Math.PI + (Math.PI * (i + 1)) / steps;
    drawCapsule(
      buf,
      size,
      arcCx + Math.cos(a1) * arcR,
      arcCy + Math.sin(a1) * arcR,
      arcCx + Math.cos(a2) * arcR,
      arcCy + Math.sin(a2) * arcR,
      stroke,
      accent
    );
  }
  drawCapsule(buf, size, arcCx - arcR, arcCy, arcCx - arcR, s(198), stroke, accent);
  drawCapsule(buf, size, arcCx + arcR, arcCy, arcCx + arcR, s(198), stroke, accent);

  // Shopping bag trapezoid (off-white #F4F4F2)
  drawCapsule(buf, size, s(150), s(198), s(362), s(198), stroke, fg);
  drawCapsule(buf, size, s(362), s(198), s(344), s(386), stroke, fg);
  drawCapsule(buf, size, s(344), s(386), s(168), s(386), stroke, fg);
  drawCapsule(buf, size, s(168), s(386), s(150), s(198), stroke, fg);

  // Center emblem dot
  drawCircle(buf, size, s(256), s(292), (20 / 512) * size * scale, accent);

  return encodePNG(size, size, buf);
}

const outDir = path.join(process.cwd(), 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), drawIcon(192, false));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), drawIcon(512, false));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), drawIcon(512, true));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), drawIcon(180, false));
console.log('Generated PWA PNG icons in public/.');
