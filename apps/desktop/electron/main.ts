import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerAgentStateIpc } from './agentStateIpc.js';
import { LocalIngress } from './ingress/localIngress.js';
import { simulationEnabled, SimulatorController } from './simulatorController.js';

const simulated = simulationEnabled(process.env.COFFEE_BREAK_LOCAL_SIMULATION, process.env.ELECTRON_RENDERER_URL, app.isPackaged);
const controller = simulated ? new SimulatorController() : null;
const ingress = controller?.ingress ?? new LocalIngress({ onLaunchCredentials: () => {
  throw new Error('connector_activation_not_configured');
} });
let agentStateIpc: ReturnType<typeof registerAgentStateIpc>;
let quitting = false;

function createWindow(): void {
 const win = new BrowserWindow({width:1100,height:760,minWidth:760,minHeight:540,webPreferences:{preload:join(__dirname,'../preload/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 const rendererFile = join(__dirname,'../renderer/index.html');
 const rendererUrl = process.env.ELECTRON_RENDERER_URL;
 agentStateIpc.attachWindow(win, rendererUrl ? new URL(rendererUrl).href : pathToFileURL(rendererFile).href);
 if (rendererUrl) void win.loadURL(rendererUrl);
 else void win.loadFile(rendererFile);
}
void app.whenReady().then(async ()=>{
 agentStateIpc = registerAgentStateIpc(ingress);
 createWindow();
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0) createWindow();});
 if (controller && !quitting) {
   try { await controller.start(); } catch { process.stderr.write('simulator:startup_failed\n'); }
 }
});
app.on('before-quit', (event) => {
 if (quitting) return;
 quitting = true;
 event.preventDefault();
 agentStateIpc?.dispose();
 void (async () => {
   try { if (controller) await controller.stop(); else await ingress.stop(); }
   finally { app.quit(); }
 })();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin') app.quit();});
