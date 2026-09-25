import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerAgentStateIpc } from './agentStateIpc.js';
import { LocalIngress } from './ingress/localIngress.js';

// US-015 will activate ingress and replace this guarded launch boundary.
const ingress = new LocalIngress({ onLaunchCredentials: () => {
  throw new Error('connector_activation_not_configured');
} });
let agentStateIpc: ReturnType<typeof registerAgentStateIpc>;

function createWindow(): void {
 const win = new BrowserWindow({width:1100,height:760,minWidth:760,minHeight:540,webPreferences:{preload:join(__dirname,'../preload/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 const rendererFile = join(__dirname,'../renderer/index.html');
 const rendererUrl = process.env.ELECTRON_RENDERER_URL;
 agentStateIpc.attachWindow(win, rendererUrl ? new URL(rendererUrl).href : pathToFileURL(rendererFile).href);
 if (rendererUrl) void win.loadURL(rendererUrl);
 else void win.loadFile(rendererFile);
}
void app.whenReady().then(()=>{
 agentStateIpc = registerAgentStateIpc(ingress);
 createWindow();
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0) createWindow();});
});
app.on('before-quit', () => {
 agentStateIpc?.dispose();
 void ingress.stop();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin') app.quit();});
