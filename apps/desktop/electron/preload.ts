import { contextBridge, ipcRenderer } from 'electron';
import { createAgentStateApi } from './agentStatePreload.js';

contextBridge.exposeInMainWorld('coffeeBreak', {
  agentState: createAgentStateApi(ipcRenderer),
});
