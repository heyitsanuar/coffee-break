import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// Decode actual RGBA pixels, rather than treating different PNG encodings as different poses.
function decode(name: string) {
  const png = readFileSync(new URL(`./assets/${name}.png`, import.meta.url));
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  expect([png[24], png[25], png[28]]).toEqual([8, 6, 0]);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * 4;
  expect(raw.length).toBe((stride + 1) * height);
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    expect(filter).toBeLessThanOrEqual(4);
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= 4 ? pixels[index - 4] : 0;
      const above = y ? pixels[index - stride] : 0;
      const corner = y && x >= 4 ? pixels[index - stride - 4] : 0;
      const p = left + above - corner;
      const distances = [Math.abs(p - left), Math.abs(p - above), Math.abs(p - corner)];
      const paeth = distances[0] <= distances[1] && distances[0] <= distances[2] ? left : distances[1] <= distances[2] ? above : corner;
      pixels[index] = (raw[y * (stride + 1) + 1 + x] + [0, left, above, Math.floor((left + above) / 2), paeth][filter]) & 255;
    }
  }
  const frame = (column: number, row = 0) => Buffer.concat(Array.from({ length: 24 }, (_, y) =>
    pixels.subarray(((row * 24 + y) * width + column * 20) * 4, ((row * 24 + y) * width + column * 20 + 20) * 4)));
  return { width, height, pixels, frame, png };
}

describe('US-027 authored character sheets', () => {
  it('decodes every 20×24 cell with meaningful content, safe alpha bounds and no partial-alpha edges', () => {
    for (const [name, width, height] of [['agent-lifecycle', 160, 72], ['mock-agents', 120, 24]] as const) {
      const sheet = decode(name);
      expect([sheet.width, sheet.height]).toEqual([width, height]);
      for (let row = 0; row < height / 24; row++) for (let column = 0; column < width / 20; column++) {
        const frame = sheet.frame(column, row);
        let opaque = 0;
        for (let y = 0; y < 24; y++) for (let x = 0; x < 20; x++) {
          const alpha = frame[(y * 20 + x) * 4 + 3];
          expect([0, 255]).toContain(alpha);
          if (alpha) { opaque++; expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(19); }
        }
        expect(opaque).toBeGreaterThan(100);
      }
    }
  });

  it('keeps three distinct identities and eight distinct pose forms per lifecycle row', () => {
    const sheet = decode('agent-lifecycle');
    const identities = new Set<string>();
    for (let row = 0; row < 3; row++) {
      const frames = Array.from({ length: 8 }, (_, column) => sheet.frame(column, row));
      expect(new Set(frames.map(frame => frame.toString('hex'))).size).toBe(8);
      identities.add(frames[0].toString('hex'));
      // Head/hair silhouette stays fixed during Working and bounded hand reactions.
      for (const column of [1, 5, 6]) expect(frames[column].subarray(0, 6 * 20 * 4)).toEqual(frames[0].subarray(0, 6 * 20 * 4));
    }
    expect(identities.size).toBe(3);
  });

  it('preserves Sol identity while coffee A/B change only the hand/cup region and generic Waiting stays different', () => {
    const lifecycle = decode('agent-lifecycle'), coffee = decode('mock-agents');
    const a = coffee.frame(4), b = coffee.frame(5);
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(lifecycle.frame(2, 2));
    expect(b).not.toEqual(lifecycle.frame(2, 2));
    expect(a.subarray(0, 12 * 20 * 4)).toEqual(lifecycle.frame(0, 2).subarray(0, 12 * 20 * 4));
    let changed = 0;
    for (let y = 0; y < 24; y++) for (let x = 0; x < 20; x++) {
      const offset = (y * 20 + x) * 4;
      if (!a.subarray(offset, offset + 4).equals(b.subarray(offset, offset + 4))) {
        changed++; expect(x).toBeGreaterThanOrEqual(14); expect(y).toBeGreaterThanOrEqual(12); expect(y).toBeLessThan(19);
      }
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('keeps faces and lifecycle differences visible through the translated workstation foreground', () => {
    const sheet = decode('agent-lifecycle'), foreground = decode('office-room-foreground');
    for (const [row, anchorX, anchorY] of [[0, 292, 174], [1, 360, 240]]) {
      const covered = (x: number, y: number) => foreground.pixels[((anchorY / 2 - 24 + y) * foreground.width + anchorX / 2 - 10 + x) * 4 + 3] !== 0;
      let lowerBodyOverlap = 0;
      for (let column = 0; column < 8; column++) {
        const frame = sheet.frame(column, row);
        for (let y = 0; y < 24; y++) for (let x = 0; x < 20; x++) {
          if (frame[(y * 20 + x) * 4 + 3] && covered(x, y)) {
            expect(y).toBeGreaterThanOrEqual(12);
            lowerBodyOverlap++;
          }
        }
      }
      expect(lowerBodyOverlap).toBeGreaterThan(0);
      for (const [a, b] of [[0, 1], [1, 2], [1, 5], [3, 6], [4, 7]]) {
        const first = sheet.frame(a, row), second = sheet.frame(b, row);
        let visibleDifferences = 0;
        for (let y = 0; y < 24; y++) for (let x = 0; x < 20; x++) {
          const offset = (y * 20 + x) * 4;
          if (!covered(x, y) && !first.subarray(offset, offset + 4).equals(second.subarray(offset, offset + 4))) visibleDifferences++;
        }
        expect(visibleDifferences).toBeGreaterThan(0);
      }
    }
  });

  it('keeps a connected workstation lap at the seat strip without separated legs below it', () => {
    const sheet = decode('agent-lifecycle');
    for (let row = 0; row < 2; row++) for (let column = 0; column < 8; column++) {
      const frame = sheet.frame(column, row);
      // The fixed strip covers logical rows 20/21; this checks geometry, not subjective seated readability.
      for (const y of [20, 21]) for (let x = 7; x <= 12; x++) expect(frame[(y * 20 + x) * 4 + 3]).toBe(255);
      for (const y of [22, 23]) for (let x = 0; x < 20; x++) expect(frame[(y * 20 + x) * 4 + 3]).toBe(0);
    }
  });

  it('does not use a promoted composite as a production texture', () => {
    const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
    for (const name of ['agent-lifecycle', 'mock-agents']) {
      for (const reference of ['agent-identity-lineup', 'lifecycle-matrix', 'sol-coffee-semantics']) {
        expect(hash(decode(name).png)).not.toBe(hash(readFileSync(new URL(`../../../../docs/design/references/us-027/${reference}.png`, import.meta.url))));
      }
    }
  });
});

describe('US-032 original room assets', () => {
  it('decodes native opaque background and exactly the two approved binary-alpha seat strips', () => {
    const background = decode('office-room-background'), foreground = decode('office-room-foreground');
    for (const image of [background, foreground]) expect([image.width, image.height]).toEqual([320, 180]);
    let opaque = 0;
    for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
      const offset = (y * 320 + x) * 4;
      expect(background.pixels[offset + 3]).toBe(255);
      const expected = (x >= 141 && x < 151 && y >= 83 && y < 85)
        || (x >= 175 && x < 185 && y >= 116 && y < 118);
      expect(foreground.pixels[offset + 3]).toBe(expected ? 255 : 0);
      if (expected) opaque++;
    }
    expect(opaque).toBe(40);
    // Actual authored fields must match the runtime overlay's uniform base, free of props.
    for (const [left, top] of [[158, 51], [192, 84]]) {
      for (let y = top; y < top + 8; y++) for (let x = left; x < left + 20; x++) {
        expect([...background.pixels.subarray((y * 320 + x) * 4, (y * 320 + x) * 4 + 4)]).toEqual([102, 131, 155, 255]);
      }
    }
  });
  it('reproduces both exact PNG buffers twice without writing production files', () => {
    const script = fileURLToPath(new URL('../../verification/author-us-026-room.py', import.meta.url));
    const generate = () => JSON.parse(execFileSync('python3', ['-c',
      'import runpy,json,sys; d=runpy.run_path(sys.argv[1]); print(json.dumps({n:d["png"](d[n]).hex() for n in ["background","foreground"]}))', script], { encoding: 'utf8' })) as Record<string, string>;
    const first = generate(), second = generate();
    expect(second).toEqual(first);
    for (const name of ['background', 'foreground']) expect(Buffer.from(first[name], 'hex')).toEqual(decode(`office-room-${name}`).png);
  });
});
