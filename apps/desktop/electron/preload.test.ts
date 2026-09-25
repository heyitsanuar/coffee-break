import { describe, expect, it, vi } from 'vitest';

const expose = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: expose },
  ipcRenderer: { on: vi.fn(), removeListener: vi.fn(), invoke: vi.fn() },
}));

describe('exposed preload surface', () => {
  it('exports only the purpose-specific agent-state watch capability', async () => {
    await import('./preload.js');
    expect(expose).toHaveBeenCalledOnce();
    expect(expose.mock.calls[0][0]).toBe('coffeeBreak');
    const api = expose.mock.calls[0][1];
    expect(Object.keys(api)).toEqual(['agentState']);
    expect(Object.keys(api.agentState)).toEqual(['watch']);
    expect(JSON.stringify(api)).not.toMatch(/ipcRenderer|token|port|process|filesystem/);
  });
});
