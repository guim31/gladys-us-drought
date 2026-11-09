// -----------------------------------------------------------------------------
// The widget picture: the county as one strip, cut in the share of each USDM
// category, in the official colours of the map legend (D4 on the left, then
// D3, D2, D1, D0, and the area without drought in grey). A small PNG encoder
// (RGB, no filter, zlib from Node): no image dependency in a 256 MB sandbox.
// -----------------------------------------------------------------------------

import { deflateSync } from 'node:zlib';

export const WIDTH = 480;
export const HEIGHT = 270; // the 16:9 frame of the widget image

// Colours of the USDM legend; "none" is grey so it shows on a white card.
export const COLORS = {
  d4: [0x73, 0x00, 0x00],
  d3: [0xe6, 0x00, 0x00],
  d2: [0xff, 0xaa, 0x00],
  d1: [0xfc, 0xd3, 0x7f],
  d0: [0xff, 0xff, 0x00],
  none: [0xdc, 0xdc, 0xdc],
};

/** Share (percent) of the county in each category alone, worst first. */
export function exclusiveShares(map) {
  const clamp = (value) => Math.max(0, value);
  return [
    ['d4', clamp(map.d4)],
    ['d3', clamp(map.d3 - map.d4)],
    ['d2', clamp(map.d2 - map.d3)],
    ['d1', clamp(map.d1 - map.d2)],
    ['d0', clamp(map.d0 - map.d1)],
    ['none', clamp(100 - map.d0)],
  ];
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** PNG of a map's shares (see usdm.js parseCounty for the map). */
export function drawShares(map) {
  // Column colours: each category gets its share of the width, rounded so the
  // columns always add up to WIDTH.
  const columns = [];
  let total = 0;
  let edge = 0;
  for (const [key, share] of exclusiveShares(map)) {
    total += share;
    const next = Math.round((Math.min(total, 100) / 100) * WIDTH);
    for (let x = edge; x < next; x += 1) {
      columns.push(COLORS[key]);
    }
    edge = Math.max(edge, next);
  }
  while (columns.length < WIDTH) {
    columns.push(COLORS.none);
  }
  const row = Buffer.alloc(1 + WIDTH * 3); // filter byte 0, then RGB
  columns.forEach(([r, g, b], x) => {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  });
  const raw = Buffer.concat(Array.from({ length: HEIGHT }, () => row));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
