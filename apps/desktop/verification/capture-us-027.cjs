// Actual production renderer with synthetic accepted inputs. Offscreen evidence, not native input verification.
const { app, BrowserWindow, nativeImage } = require('electron');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected loopback dev URL');
const output = resolve(__dirname, '../../../docs/verification/assets/us-027');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  mkdirSync(output, { recursive: true });
  const win = new BrowserWindow({ width: 1100, height: 760, useContentSize: true, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, sandbox: true, nodeIntegration: false } });
  const errors = [];
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const record = { baseline: 'd155d4099a4efa45e24564d4f74a8cc389de7d75', capturedAt: new Date().toISOString(),
    provenance: 'Direct unedited Electron capturePage of production Application/store/runtime/host/Phaser; development-only synthetic accepted inputs; labeled boards are derivatives, not direct captures. No native keyboard, OS preference, screen-reader, provider or transport claim.',
    electron: process.versions.electron, platform: process.platform, assets: {}, captures: [], observations: {} };
  const historical = readFileSync(`${output}/historical-before-ac11-working.png`);
  const historicalImage = nativeImage.createFromBuffer(historical); assert.equal(historicalImage.isEmpty(), false);
  record.captures.push({ name: 'historical-before-ac11-working', kind: 'historical-direct-runtime',
    provenance: 'Unchanged working-a capture from the initial Designer-reviewed implementation; BEFORE AC11 correction, not current implementation.',
    size: historicalImage.getSize(), pngSha256: hash(historical) });
  for (const name of ['agent-lifecycle', 'mock-agents', 'office-room-background', 'office-room-foreground']) {
    const path = resolve(__dirname, `../src/office/assets/${name}.png`);
    const image = nativeImage.createFromPath(path); assert.equal(image.isEmpty(), false);
    record.assets[name] = { size: image.getSize(), pngSha256: hash(readFileSync(path)) };
  }
  const js = code => win.webContents.executeJavaScript(code);
  let entry;
  const invoke = code => js(`import(${JSON.stringify(entry)}).then(async ({fixture})=>{${code}})`);
  const all = state => invoke(`for(const name of ['ari','mina','sol']) fixture.update('mock-agent-'+name,${JSON.stringify(state)},'Synthetic US-027 lifecycle verification')`);
  const ready = async () => {
    for (let i = 0; i < 100; i++) {
      if (await js("document.querySelectorAll('canvas').length===1 && document.body.innerText.includes('Connected')")) { await wait(150); return; }
      await wait(100);
    }
    throw new Error(`Renderer not ready: ${JSON.stringify(errors)}`);
  };
  const roomRect = () => js("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:640,height:360}})()");
  const images = {};
  const capture = async (name, room = true) => {
    const image = await win.webContents.capturePage(room ? await roomRect() : undefined);
    const png = image.toPNG(); writeFileSync(`${output}/${name}.png`, png); images[name] = image;
    record.captures.push({ name, kind: 'direct-runtime', sampledAt: new Date().toISOString(), viewport: await js('[innerWidth,innerHeight]'), dpr: await js('devicePixelRatio'), size: image.getSize(), pngSha256: hash(png) });
    return image;
  };
  const spritePixels = (name, x, y) => {
    const image = images[name], ratio = image.getSize().width / 640;
    return image.crop({ x: (x - 20) * ratio, y: (y - 48) * ratio, width: 40 * ratio, height: 48 * ratio }).toBitmap();
  };
  const compare = (a, b, x, y) => {
    const aa = spritePixels(a, x, y), bb = spritePixels(b, x, y); assert.equal(aa.length, bb.length);
    let changed = 0;
    for (let i = 0; i < aa.length; i += 4) if (!aa.subarray(i, i + 4).equals(bb.subarray(i, i + 4))) changed++;
    return changed;
  };
  const select = async name => { await js(`document.querySelector('[aria-label="Select ${name}"]').click()`); await wait(60); };
  const layout = () => js("({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,canvases:document.querySelectorAll('canvas').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,selected:document.querySelector('[aria-pressed=true]')?.getAttribute('aria-label')??null})");
  try {
    await win.loadURL(`${base}/verification/us-027.html`); await ready();
    entry = await js("Array.from(document.scripts).find(s=>new URL(s.src).pathname==='/verification/us-027.tsx').src");
    win.webContents.debugger.attach('1.3');
    const media = async value => { await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] }); await wait(60); };
    await media('no-preference');
    await capture('idle');
    await all('working'); await wait(70); await capture('working-a'); await wait(620); await capture('working-b');
    await all('waiting'); await wait(70); await capture('waiting');
    await all('completed'); await wait(70); await capture('completed-acknowledgement'); await wait(650); await capture('completed-settled');
    await all('error'); await wait(70); await capture('error-acknowledgement'); await wait(600); await capture('error-settled');
    record.observations.poseComparisons = {};
    for (const [name, x, y] of [['Ari',292,174],['Mina',480,174],['Sol',220,282]]) {
      const result = { working: compare('working-a','working-b',x,y), completed: compare('completed-acknowledgement','completed-settled',x,y), error: compare('error-acknowledgement','error-settled',x,y) };
      for (const value of Object.values(result)) assert.ok(value > 0, `${name}: runtime poses must differ`);
      record.observations.poseComparisons[name] = result;
    }
    await all('waiting'); await wait(70); await capture('sol-generic-waiting');
    await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')");
    await wait(70); await capture('coffee-a'); await wait(520); await capture('coffee-b');
    const coffeeChange = compare('coffee-a','coffee-b',220,282); assert.ok(coffeeChange > 0);
    record.observations.coffeeChangedDecodedPixels = coffeeChange;
    await all('working');
    await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')");
    await invoke("fixture.connection('disconnected')"); await wait(70); await capture('retained-a'); await wait(1700); await capture('retained-b');
    assert.equal(hash(images['retained-a'].toBitmap()),hash(images['retained-b'].toBitmap()));
    await invoke("fixture.connection('synchronizing');fixture.connection('ready')"); await media('reduce');
    await capture('reduced-working-coffee-a'); await wait(1700); await capture('reduced-working-coffee-b');
    assert.equal(hash(images['reduced-working-coffee-a'].toBitmap()),hash(images['reduced-working-coffee-b'].toBitmap()));
    await all('completed'); await wait(70); await capture('reduced-completed'); await all('error'); await wait(70); await capture('reduced-error');
    await media('no-preference'); await capture('motion-restored-error');
    assert.equal(hash(images['reduced-error'].toBitmap()), hash(images['motion-restored-error'].toBitmap()));
    record.observations.staticRetainedReducedAndNoReactionReplay = true;
    await all('working'); await invoke("fixture.update('mock-agent-mina','waiting','Waiting for approval','approval_required');fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')");
    for (const name of ['Ari','Mina','Sol']) { await select(name); await capture(`selected-${name.toLowerCase()}`, false); }
    const rect = await roomRect();
    for (const [name,x,y] of [['Ari',292,150],['Mina',480,150],['Sol',220,258]]) {
      const point = {x:rect.x+x,y:rect.y+y};
      win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});
      win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point}); await wait(60);
      assert.equal((await layout()).selected,`Select ${name}`);
    }
    record.observations.rendererPointerSelectionAllThree = true;
    await select('Mina'); await capture('desktop-1100x760',false); record.observations.desktop = await layout();
    win.setContentSize(760,540); await wait(100); await capture('compact-760x540',false); record.observations.compact = await layout();
    assert.equal(record.observations.desktop.horizontalOverflow,false); assert.equal(record.observations.compact.horizontalOverflow,false);
    await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})"); await wait(70); await capture('compact-inspector-scroll',false);
    assert.ok(await js('scrollY>0'));
    await js('scrollTo(0,0)'); win.setContentSize(1100,760); await wait(100); await select('Ari');
    // Explicit programmatic initial focus + Chromium keyboard-event emulation, not native testing.
    await js("document.querySelector('[aria-label=\"Select Ari\"]').focus()");
    const key = async (key,code,virtual) => {
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:virtual});
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual}); await wait(60);
    };
    await key('Tab','Tab',9);
    assert.equal(await js('document.activeElement.getAttribute("aria-label")'),'Select Mina');
    assert.equal(await js('document.activeElement.matches(":focus-visible")'),true);
    assert.equal((await layout()).selected,'Select Ari'); await capture('focus-mina-selected-ari',false);
    await key(' ','Space',32); assert.equal((await layout()).selected,'Select Mina');
    await all('waiting'); assert.equal(await js('document.activeElement.getAttribute("aria-label")'),'Select Mina');
    await js("document.querySelector('.clear-selection-button').click()"); assert.equal((await layout()).selected,null);
    const reload = new Promise(resolve=>win.webContents.once('did-finish-load',resolve)); win.webContents.reload(); await reload; await ready();
    assert.equal((await layout()).canvases,1);
    record.observations.keyboard = 'Programmatic initial focus then Chromium Tab/Space emulation: focus distinct from selection, activation selects Mina, state updates preserve focus. Clear used DOM click. Native keyboard/assistive technology unverified.';
    record.observations.reloadOneCanvas = true;

    // Labeled contact sheets display preserved direct captures; no reconstructed runtime poses.
    const board = new BrowserWindow({width:1200,height:600,useContentSize:true,show:false,webPreferences:{offscreen:true,contextIsolation:true,sandbox:true,nodeIntegration:false}});
    const uri = name => `data:image/png;base64,${readFileSync(`${output}/${name}.png`).toString('base64')}`;
    const derivative = async (name,html,width,height) => {
      board.setContentSize(width,height); await board.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
      await board.webContents.executeJavaScript('Promise.all(Array.from(document.images).map(image=>image.decode()))');
      const image = await board.webContents.capturePage(), png=image.toPNG(); writeFileSync(`${output}/${name}.png`,png);
      record.captures.push({name,kind:'labeled-derivative',size:image.getSize(),pngSha256:hash(png)});
    };
    const style = '<style>body{margin:0;padding:20px;background:#0c1820;color:#f5f1e9;font:15px Arial}h1{font-size:20px}img{image-rendering:pixelated}section{display:flex;gap:12px}.cell{width:128px}.crop{position:relative;overflow:hidden;width:128px;height:112px}.crop img{position:absolute;width:640px;height:360px}figure{margin:0}p{color:#b4c2c4}</style>';
    try {
      const order=['idle','working-a','working-b','waiting','completed-settled','completed-acknowledgement','error-settled','error-acknowledgement'];
      let html=style+'<h1>IMPLEMENTED RUNTIME · all identities / eight forms · actual integer 2×</h1><p>Labeled derivative of direct production office captures. No frames reconstructed or forced.</p>';
      for(const [name,x,y] of [['Ari',292,174],['Mina',480,174],['Sol',220,282]]) {
        html+=`<h2>${name}</h2><section>`;
        for(const frame of order) html+=`<figure class="cell"><div>${frame.replaceAll('-',' ')}</div><div class="crop"><img src="${uri(frame)}" style="left:${-(x-64)}px;top:${-(y-80)}px"></div></figure>`;
        html+='</section>';
      }
      await derivative('lifecycle-matrix',html,1200,850);
      for (const [name, x] of [['ari', 292], ['mina', 480]]) {
        const crop = (image, scale) => `<div style="position:relative;overflow:hidden;width:${160*scale}px;height:${130*scale}px"><img src="${uri(image)}" style="position:absolute;width:${640*scale}px;height:${360*scale}px;left:${-(x-60)*scale}px;top:${-90*scale}px"></div>`;
        await derivative(`${name}-workstation-comparison`, style+`<h1>${name.toUpperCase()} · AC11 workstation correction · unchanged furniture / anchor</h1><p>Labeled crops of actual renderer captures. Only lower-body art changed; Designer re-review: PASS.</p><section><figure><p>BEFORE · initial reviewed runtime · 2×</p>${crop('historical-before-ac11-working',1)}</figure><figure><p>AFTER · corrected runtime · 2×</p>${crop('working-a',1)}</figure></section><p>AFTER · nearest-neighbor 6× inspection (not intended runtime scale)</p>${crop('working-a',3)}`,800,820);
      }
      const design=readFileSync(resolve(__dirname,'../../../docs/design/references/us-027/desktop-1100x760.png')).toString('base64');
      await derivative('approved-vs-runtime',style+`<h1>DESIGN REFERENCE versus IMPLEMENTED RUNTIME</h1><p>Labeled derivative. Approved historical proposal captions remain unchanged; right: direct runtime capture.</p><section><figure><p>Approved US-027 design reference</p><img width="550" src="data:image/png;base64,${design}"></figure><figure><p>Implemented runtime</p><img width="550" src="${uri('desktop-1100x760')}"></figure></section>`,1160,600);
      const assets=resolve(__dirname,'../src/office/assets');
      const source=readFileSync(`${assets}/agent-lifecycle.png`).toString('base64');
      await derivative('source-grid-inspection',style+`<h1>PRODUCTION ASSET INSPECTION · not a runtime capture</h1><p>Independently authored 160×72 sheet, eight 20×24 cells per identity row. Native 1×, intended 2×, nearest-neighbor 6×.</p><p>1×</p><img width="160" src="data:image/png;base64,${source}"><p>2×</p><img width="320" src="data:image/png;base64,${source}"><p>6× inspection</p><img width="960" src="data:image/png;base64,${source}">`,1100,950);
    } finally {board.destroy();}
    assert.deepEqual(errors,[]);record.observations.rendererErrors=errors;
    writeFileSync(`${output}/capture-record.json`,JSON.stringify(record,null,2)+'\n');
    console.log('PASS',JSON.stringify(record.observations));
  } finally {win.destroy();app.quit();}
}).catch(error=>{console.error(error);app.exit(1);});
