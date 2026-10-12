// US-034 decoded border check, extended only to exclude the recorded focus overlay.
const {nativeImage}=require('electron');
const assert=require('node:assert/strict');
function verifyImage(png, geometry) {
  const image = nativeImage.createFromBuffer(png), size = image.getSize(), bytes = image.toBitmap();
  assert.equal(image.isEmpty(), false); assert.deepEqual([size.width, size.height], geometry.viewport.map(v => v * geometry.dpr));
  const matches = (x, y, rgb, tolerance = 10) => {
    const k = (y * size.width + x) * 4;
    return bytes[k + 3] === 255 && ([rgb, [...rgb].reverse()].some(channels => channels.every((v, i) => Math.abs(v - bytes[k + i]) <= tolerance)));
  };
  const masks = geometry.masks ?? [];
  const masked = (x, y) => masks.some(r => x >= r.x * geometry.dpr && x < (r.x + r.width) * geometry.dpr && y >= r.y * geometry.dpr && y < (r.y + r.height) * geometry.dpr);
  const checks = [];
  for (const [name, item] of Object.entries(geometry.borders)) {
    if (!item.visible) continue;
    const { x, y, width, height } = item.bounds, rgb = item.rgb, scale = geometry.dpr;
    const left = Math.ceil((x + 10) * scale), right = Math.floor((x + width - 10) * scale);
    if (left < 0 || right >= size.width || right <= left) continue;
    for (const [edge, expected] of [['top', y * scale], ['bottom', (y + height - 1) * scale]]) {
      if (expected < 2 || expected >= size.height - 2) continue;
      let best = { fraction: 0, row: null };
      for (let row = Math.max(0, Math.floor(expected) - 2); row <= Math.min(size.height - 1, Math.ceil(expected) + 2); row++) {
        let count = 0, eligible = 0; for (let col = left; col < right; col++) { if (masked(col, row)) continue; eligible++; if (matches(col, row, rgb)) count++; }
        const fraction = eligible >= 10 ? count / eligible : 0; if (fraction > best.fraction) best = { fraction, row };
      }
      assert.ok(best.fraction >= 0.9, name + ' ' + edge + ': image/layout mismatch ' + JSON.stringify({ expected, best }));
      checks.push({ name, edge, expected, observed: best.row, fraction: best.fraction, tolerancePhysicalPx: 2, channelTolerance: 10 });
    }
    // A tall open panel can fill the viewport with both horizontal edges offscreen.
    const top = Math.max(0, Math.ceil((y + 10) * scale)), bottom = Math.min(size.height, Math.floor((y + height - 10) * scale));
    if (bottom <= top) continue;
    for (const [edge, expected] of [['left', x * scale], ['right', (x + width - 1) * scale]]) {
      if (expected < 2 || expected >= size.width - 2) continue;
      let best = { fraction: 0, column: null };
      for (let col = Math.floor(expected) - 2; col <= Math.ceil(expected) + 2; col++) {
        let count = 0, eligible = 0; for (let row = top; row < bottom; row++) { if (masked(col, row)) continue; eligible++; if (matches(col, row, rgb)) count++; }
        const fraction = eligible >= 10 ? count / eligible : 0; if (fraction > best.fraction) best = { fraction, column: col };
      }
      assert.ok(best.fraction >= 0.9, name + ' ' + edge + ': image/layout mismatch ' + JSON.stringify({ expected, best }));
      checks.push({ name, edge, expected, observed: best.column, fraction: best.fraction, tolerancePhysicalPx: 2, channelTolerance: 10 });
    }
  }
  assert.ok(checks.length > 0, 'No visible borders to verify image/layout correspondence');
  return checks;
}
module.exports={verifyImage};
