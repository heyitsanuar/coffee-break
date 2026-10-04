// Direct capture of the development-only US-024 fixture. This is not a native accessibility test.
const { app, BrowserWindow } = require('electron');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');

const output = resolve(__dirname, '../../../docs/verification/assets/us-024');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected loopback development URL.');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  mkdirSync(output, { recursive: true });
  const win = new BrowserWindow({ width: 1100, height: 760, useContentSize: true, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, sandbox: true, nodeIntegration: false } });
  const errors = [];
  const record = { provenance: 'Direct unedited offscreen Electron captures of synthetic accepted US-024 fixture inputs through production store, runtime, React host and Phaser scene',
    capturedAt: new Date().toISOString(), electron: process.versions.electron, platform: process.platform,
    arch: process.arch, captures: [], observations: {} };
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => win.webContents.executeJavaScript(code);
  const waitCanvas = async (connected = true) => {
    for (let i = 0; i < 80; i++) {
      if (await js(`document.querySelectorAll('canvas').length === 1${connected ? " && document.body.innerText.includes('Connected')" : ''}`)) { await wait(350); return; }
      await wait(100);
    }
    throw new Error(`Fixture did not render one connected canvas: ${JSON.stringify(errors)}`);
  };
  let entry;
  const invoke = code => js(`import(${JSON.stringify(entry)}).then(async ({fixture}) => { ${code} }).catch(error=>{console.error('fixture invocation failed',error);throw error})`);
  const name = id => ({'mock-agent-ari':'Ari','mock-agent-mina':'Mina','mock-agent-sol':'Sol'})[id];
  const selected = id => js(`document.querySelector('[aria-label="Select ${name(id)}"]').getAttribute('aria-pressed')`);
  const select = async id => { await js(`document.querySelector('[aria-label="Select ${name(id)}"]').click()`); await wait(80); };
  const text = () => js('document.body.innerText');
  const inspection = () => js(`Object.fromEntries(Array.from(document.querySelectorAll('.agent-inspection dl>div')).map(row=>[row.querySelector('dt').textContent.toLowerCase(),row.querySelector('dd').textContent]))`);
  const layout = () => js(`(() => {const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,canvases:document.querySelectorAll('canvas').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,documentHeight:document.documentElement.scrollHeight,canvas:rect('canvas'),inspector:rect('.agent-inspection'),selector:rect('.agent-selector'),summary:getComputedStyle(document.querySelector('.selected-agent-summary')).display,columns:getComputedStyle(document.querySelector('.office-composition')).gridTemplateColumns}})()`);
  const capture = async (name, office = false) => {
    const rect = office ? await js("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:640,height:360}})()") : undefined;
    const image = await win.webContents.capturePage(rect);
    const png = image.toPNG();
    writeFileSync(`${output}/${name}.png`, png);
    const pngSha256 = createHash('sha256').update(png).digest('hex');
    record.captures.push({ name, viewport: await js('[innerWidth,innerHeight]'), scrollY: await js('scrollY'), rect: rect ?? null,
      size: image.getSize(), pngSha256 });
    return pngSha256;
  };
  const frameHash = async () => {
    const rect = await js("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:640,height:360}})()");
    return createHash('sha256').update((await win.webContents.capturePage(rect)).toPNG()).digest('hex');
  };
  const lifecycle = async (state, activity, reason) => {
    await invoke(`fixture.update('mock-agent-ari',${JSON.stringify(state)},${JSON.stringify(activity)}${reason ? `,${JSON.stringify(reason)}` : ''})`);
    await wait(100);
    const fields = await inspection();
    assert.equal(fields['current state'], state[0].toUpperCase()+state.slice(1), `${state} inspector state is exact`);
    assert.equal(fields.activity, activity, `${state} activity is exact`);
    if (reason) assert.equal(fields.reason, 'Approval required');
  };
  try {
    await win.loadURL(`${base}/verification/us-024.html`); await waitCanvas();
    entry = await js("Array.from(document.scripts).find(s=>new URL(s.src).pathname==='/verification/us-024.tsx').src");
    await select('mock-agent-ari');
    await lifecycle('idle', 'Ready for a new task'); await capture('journey-idle', true);
    await lifecycle('working', 'Implementing the change'); await capture('journey-working', true);
    await lifecycle('waiting', 'Waiting for approval', 'approval_required'); await capture('journey-waiting', true);
    await lifecycle('completed', 'Implementation complete'); await capture('journey-completed', true);
    const completedFrame = record.captures.at(-1).pngSha256;
    await wait(650);
    const rect = await js("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:640,height:360}})()");
    const settledFrame = createHash('sha256').update((await win.webContents.capturePage(rect)).toPNG()).digest('hex');
    assert.notEqual(settledFrame, completedFrame, 'bounded completed acknowledgement settles to a different captured Phaser frame');
    await capture('journey-completed-settled', true);
    await lifecycle('error', 'Validation failed'); await capture('journey-error', true);
    await wait(500); await capture('journey-error-settled', true);
    record.observations.lifecycleJourney = ['idle','working','waiting','completed','error'].map(state => ({state, exactInspector:true}));
    record.observations.completedAcknowledgementSettled = true;

    // Canonical contextual case and a text-similar but non-canonical agent.
    await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')"); await wait(100);
    assert.ok((await js("document.querySelector('.office-scene-host').getAttribute('aria-label')")).includes('Sol Coffee break'));
    await select('mock-agent-sol');
    assert.equal((await inspection())['current state'],'Waiting');
    assert.equal((await inspection()).activity,'Taking a coffee break in the simulated office');
    await capture('normal-coffee');
    await invoke("fixture.update('mock-agent-mina','waiting','Taking a coffee break in the simulated office')"); await wait(100);
    assert.equal(await js("document.querySelector('.office-scene-host').getAttribute('aria-label').includes('Mina Coffee break')"), false);
    await invoke("fixture.update('mock-agent-sol','waiting','Waiting for approval')"); await wait(100);
    assert.ok((await js("document.querySelector('.office-scene-host').getAttribute('aria-label')")).includes('Sol Waiting'));
    await select('mock-agent-mina');
    assert.equal((await inspection())['current state'],'Waiting');
    assert.equal((await inspection()).activity,'Taking a coffee break in the simulated office');
    await capture('coffee-negative');
    record.observations.exactCoffeeOnlySol = true; record.observations.genericSolWaitingRemainsNeutral = true;
    await invoke("fixture.update('mock-agent-mina','working','Reviewing the requested changes')"); await wait(100);

    await win.setContentSize(1100,760); await wait(100); await select('mock-agent-mina');
    record.observations.desktop = await layout();
    assert.equal(record.observations.desktop.canvases,1); assert.equal(record.observations.desktop.horizontalOverflow,false);
    assert.equal(record.observations.desktop.canvas.width,640); assert.equal(record.observations.desktop.canvas.height,360);
    assert.equal(record.observations.desktop.summary,'none'); assert.ok(record.observations.desktop.inspector.x>record.observations.desktop.canvas.x+640);
    await capture('desktop-1100x760');
    await invoke("fixture.update('mock-agent-mina','working',''+('Reviewing implementation details and preserving exact trusted wording. '.repeat(5))+'X'.repeat(64))");
    await wait(100); assert.equal((await layout()).horizontalOverflow,false); await capture('desktop-long');

    // The Phaser hit area and React selector must target the same identity.
    await select('mock-agent-ari');
    const point = await js("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:Math.round(r.x+520),y:Math.round(r.y+224)}})()");
    win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});
    win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point}); await wait(100);
    assert.equal(await selected('mock-agent-sol'),'true'); assert.equal((await inspection()).name,'Sol');
    await select('mock-agent-ari');
    // Programmatic focus alone cannot stand in for actual keyboard input; that is separately checked in the native app.
    await js("document.querySelector('[aria-label=\"Select Mina\"]').focus()"); await wait(40);
    assert.equal(await selected('mock-agent-ari'),'true');
    assert.equal(await js('document.activeElement.getAttribute("aria-label")'),'Select Mina');
    assert.equal(await js('document.activeElement.getAttribute("aria-pressed")'),'false');
    await js("document.querySelector('[aria-label=\"Select Mina\"]').click()"); await wait(80);
    assert.equal(await selected('mock-agent-mina'),'true');
    await lifecycle('working', 'Reviewing implementation details and preserving exact trusted wording. '.repeat(5)+'X'.repeat(64));
    assert.equal(await js('document.activeElement.getAttribute("aria-label")'),'Select Mina');
    record.observations.focusAndSelection = {programmaticFocusDoesNotSelect:true,selectorActivationSelects:true,updatePreservesFocus:true,nativeKeyboardCheck:'pending user observation'};
    record.observations.clearSelectionFocus = 'not assessed by programmatic focus; native keyboard check requested';
    await js("document.querySelector('.clear-selection-button').click()"); await wait(80);
    assert.equal(await selected('mock-agent-mina'),'false'); await capture('desktop-clear-selection'); record.observations.clearSelection=true;

    await select('mock-agent-mina');
    await invoke("fixture.connection('disconnected')"); await wait(100);
    assert.ok((await text()).includes('Disconnected · Showing last known agent state'));
    assert.ok((await text()).includes('Last known'));
    assert.ok((await text()).includes('Reviewing implementation details'));
    await capture('desktop-retained');
    console.log('verified retained');
    await invoke("fixture.connection('synchronizing')"); await wait(100);
    assert.ok((await text()).includes('Synchronizing · Showing last known agent state'));
    await capture('desktop-synchronizing');
    console.log('verified synchronizing');
    await invoke("fixture.connection('ready')"); await wait(100);
    assert.ok((await text()).includes('Connected')); assert.ok((await text()).includes('Reviewing implementation details'));
    await capture('desktop-return-live');
    record.observations.interruptionJourney = ['connected','disconnected-retained','synchronizing-retained','ready-snapshot-restored'];
    console.log('verified restored ready');

    await invoke("await fixture.reset('connecting')"); await waitCanvas(false); await select('mock-agent-mina');
    assert.ok((await text()).includes('Connecting to local simulation…')); await capture('desktop-connecting');
    console.log('verified connecting');
    await invoke("await fixture.reset('unavailable')"); await waitCanvas(false); await select('mock-agent-mina');
    assert.ok((await text()).includes('No trusted agent state available yet.')); await capture('desktop-unavailable');
    assert.ok(!(await text()).includes('Reviewing implementation details'));
    await invoke("await fixture.reset('live')"); await waitCanvas(); await select('mock-agent-mina');
    assert.ok((await text()).includes('Connected')); assert.equal((await inspection())['current state'],'Waiting');
    await capture('desktop-unavailable-return-live');
    record.observations.unavailableToLive = ['disconnected-unavailable','complete-ready-snapshot-restored'];

    await invoke("await fixture.reset('live')"); await waitCanvas(); await win.setContentSize(760,540); await wait(120); await select('mock-agent-mina');
    record.observations.minimum = await layout();
    assert.equal(record.observations.minimum.horizontalOverflow,false); assert.equal(record.observations.minimum.canvas.width,640);
    assert.equal(record.observations.minimum.canvas.height,360); assert.equal(record.observations.minimum.summary,'block');
    assert.ok(record.observations.minimum.documentHeight>540); assert.ok(record.observations.minimum.inspector.y>=record.observations.minimum.canvas.bottom);
    await capture('minimum-760x540');
    await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})"); await wait(80);
    assert.ok(await js('scrollY>0')); await capture('minimum-inspector'); record.observations.inspectorReachableByVerticalScroll=true;

    // Renderer media emulation is automated evidence, not native OS preference verification.
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await invoke("await fixture.reset('live')"); await waitCanvas(); await select('mock-agent-ari');
    await lifecycle('working','Implementing under reduced motion');
    const stateBefore = await frameHash(); await wait(1300);
    assert.equal(await frameHash(),stateBefore,'working character and monitor are static under reduced motion');
    await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')"); await wait(100);
    const coffeeBefore = await frameHash(); await wait(1700);
    assert.equal(await frameHash(),coffeeBefore,'coffee steam is static under reduced motion');
    await capture('minimum-reduced-motion');
    console.log('verified reduced-motion still frame');
    assert.equal(await js("matchMedia('(prefers-reduced-motion: reduce)').matches"),true);
    record.observations.reducedMotion = 'Chromium/Electron renderer media emulation; working character/monitor and coffee canvas stayed pixel-identical over samples; native macOS preference not claimed';
    await invoke("fixture.connection('disconnected')"); await wait(100);
    console.log('verified reduced retained connection');
    assert.ok((await text()).includes('Last known'));
    record.observations.reducedMotionRetained=true;

    // Existing presentation-runtime tests cover acknowledgement eligibility/replay and timer cancellation.
    // Here a same-host React tree/game remount verifies the integrated current selection is forwarded.
    await invoke("await fixture.reset('live')"); await waitCanvas(); console.log('reset live after reduced motion'); await select('mock-agent-sol');
    await invoke("await fixture.reset('live')"); await waitCanvas(); console.log('remounted live tree');
    assert.equal(await selected('mock-agent-sol'),'true'); console.log('selection persisted across game remount');
    const reloaded = new Promise(resolve => win.webContents.once('did-finish-load',resolve));
    win.webContents.reload(); await reloaded; console.log('page reload finished'); await waitCanvas(); console.log('reloaded canvas checked');
    assert.equal(await js("document.querySelectorAll('canvas').length"),1); record.observations.reloadOneCanvas=true;
    console.log('renderer errors',JSON.stringify(errors));
    assert.deepEqual(errors,[]); record.observations.rendererConsoleErrors=errors;
    writeFileSync(`${output}/capture-record.json`,`${JSON.stringify(record,null,2)}\n`);
    console.log('PASS',JSON.stringify(record.observations));
  } finally { win.destroy(); app.quit(); }
}).catch(error=>{console.error(error);app.exit(1);});
