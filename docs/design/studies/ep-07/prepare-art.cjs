// Design-study derivation only. Reads generated art; writes new files in this folder.
const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = __dirname;
app.setPath('userData', path.join(root, '.render-cache'));
const load = name => {
  const image = nativeImage.createFromPath(path.join(root, 'art', name));
  assert.ok(!image.isEmpty(), name);
  return { name, ...image.getSize(), bytes: image.toBitmap() };
};
const alpha = (im, x, y) => im.bytes[(y * im.width + x) * 4 + 3];
function groups(im, axis) {
  const length = axis === 'x' ? im.width : im.height;
  const cross = axis === 'x' ? im.height : im.width;
  const occupied = [];
  for (let p = 0; p < length; p++) {
    let count = 0;
    for (let q = 0; q < cross; q++) if (alpha(im, axis === 'x' ? p : q, axis === 'x' ? q : p) > 128) count++;
    if (count > 8) occupied.push(p);
  }
  const spans = [];
  for (const p of occupied) {
    if (!spans.length || p - spans.at(-1)[1] > 12) spans.push([p, p]);
    else spans.at(-1)[1] = p;
  }
  return spans;
}
function bounds(im, xr, yr) {
  let left = im.width, top = im.height, right = 0, bottom = 0;
  for (let y = yr[0]; y <= yr[1]; y++) for (let x = xr[0]; x <= xr[1]; x++) {
    if (alpha(im, x, y) > 128) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  assert.ok(right > left && bottom > top);
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
const derived = [];
function save(im, crop, w, h, name, fit = true) {
  const out = Buffer.alloc(w * h * 4);
  const scale = fit ? Math.min((w - 2) / crop.width, (h - 2) / crop.height) : 1;
  const dw = fit ? Math.max(1, Math.round(crop.width * scale)) : w;
  const dh = fit ? Math.max(1, Math.round(crop.height * scale)) : h;
  const ox = Math.floor((w - dw) / 2), oy = fit ? h - dh - 1 : 0;
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const sx = crop.x + Math.min(crop.width - 1, Math.floor((x + 0.5) * crop.width / dw));
    const sy = crop.y + Math.min(crop.height - 1, Math.floor((y + 0.5) * crop.height / dh));
    const s = (sy * im.width + sx) * 4, d = ((y + oy) * w + x + ox) * 4;
    if (im.bytes[s + 3] <= 128) continue;
    im.bytes.copy(out, d, s, s + 4); out[d + 3] = 255;
  }
  const filename = path.join(root, 'art', name);
  assert.ok(!fs.existsSync(filename), 'Never overwrite a prior artifact: ' + name);
  fs.writeFileSync(filename, nativeImage.createFromBitmap(out, { width: w, height: h }).toPNG());
  derived.push({ path: 'art/' + name, source: 'art/' + im.name, sourceDimensions: [im.width, im.height], sourceCrop: crop, outputDimensions: [w, h], operation: 'Nearest-neighbour centre sampling into an exact study cell; alpha threshold 128; transparent padding; no interpolation or dithering. Not production sprite approval.' });
}
app.whenReady().then(() => {
  for (const [size, w, h] of [[20, 20, 24], [24, 24, 32]]) {
    const im = load('characters-' + size + '-generated.png'), xs = groups(im, 'x'), ys = groups(im, 'y');
    assert.equal(xs.length, 3, JSON.stringify(xs)); assert.equal(ys.length, 3, JSON.stringify(ys));
    for (const [r, agent] of ['ari', 'mina', 'sol'].entries()) for (const [c, pose] of ['standing', 'working', 'walking'].entries()) save(im, bounds(im, xs[c], ys[r]), w, h, `${agent}-${size}-${pose}.png`);
  }
  const portraits = load('portraits-generated.png'), px = groups(portraits, 'x'); assert.equal(px.length, 3);
  for (const [i, agent] of ['ari', 'mina', 'sol'].entries()) for (const size of [24, 32]) save(portraits, bounds(portraits, px[i], [0, portraits.height - 1]), size, size, `${agent}-portrait-${size}.png`);
  const coffee = load('sol-coffee-generated.png'), cx = groups(coffee, 'x'); assert.equal(cx.length, 3);
  for (const [i, pose] of ['coffee', 'coffee-walking', 'coffee-static'].entries()) save(coffee, bounds(coffee, cx[i], [0, coffee.height - 1]), 24, 32, `sol-24-${pose}.png`);
  const room = load('environment-generated.png'); save(room, { x: 0, y: 0, width: room.width, height: room.height }, 320, 180, 'environment-320.png', false);
  fs.writeFileSync(path.join(root, 'art-derivations.json'), JSON.stringify({ status: 'DESIGN STUDY ONLY', note: 'Two independently generated character alternatives are quantized separately to exact cells. This processing makes a real dimension comparison; it does not establish final hand-cleaned sprite quality, runtime anchors, foreground masks or a production-ready pixel grid.', derived }, null, 2) + '\n', { flag: 'wx' });
  console.log('Prepared ' + derived.length + ' exact-size study assets.'); app.quit();
}).catch(error => { console.error(error); app.exit(1); });
