import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
function createWindow(): void {
 const win = new BrowserWindow({width:1100,height:760,minWidth:760,minHeight:540,webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
 else void win.loadFile(join(__dirname,'../dist/index.html'));
}
void app.whenReady().then(()=>{createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0) createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin') app.quit();});
