import { expect, it, vi } from 'vitest';
import { runCli } from '../src/cli.js';

it('help/version/invalid arguments never invoke diagnostics or any model task', async () => {
  const doctor = vi.fn();
  for (const [args, code] of [[['--help'], 0], [['--version'], 0], [[], 2], [['exec'], 2], [['doctor', '--exec', 'anything'], 2], [['doctor', '--probe-security', '--probe-security'], 2]] as const) {
    expect((await runCli([...args], doctor)).code).toBe(code);
  }
  expect(doctor).not.toHaveBeenCalled();
});
it('makes native probes explicit and serializes only the diagnostic contract', async () => {
  const report = { schemaVersion: 1, ready: false, blockers: ['native-not-run'], exitCode: 3 };
  const doctor = vi.fn(async () => report);
  const result = await runCli(['doctor', '--json'], doctor);
  expect(JSON.parse(result.stdout)).toEqual(report);
  expect(doctor).toHaveBeenLastCalledWith(false);
  await runCli(['doctor', '--probe-security'], doctor);
  expect(doctor).toHaveBeenLastCalledWith(true);
});
it('preserves the versioned JSON failure envelope without leaking exceptions', async () => {
  const result = await runCli(['doctor', '--json'], async () => { throw new Error('secret exception'); });
  expect(result.code).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({ schemaVersion: 1, ready: false, exitCode: 1 });
  expect(result.stdout + result.stderr).not.toContain('secret exception');
});
it('propagates failure precedence and the post-cleanup interrupt exit code', async () => {
  for (const exitCode of [0, 1, 3, 130]) {
    const result = await runCli(['doctor', '--json'], async () => ({ ready: exitCode === 0, blockers: exitCode ? ['blocked'] : [], exitCode }));
    expect(result.code).toBe(exitCode);
    expect(JSON.parse(result.stdout).exitCode).toBe(exitCode);
  }
});
it('routes only workflow controls without invoking doctor and preserves help/version exits', async () => {
  const doctor = vi.fn();
  const result = await runCli(['run', 'approve', 'anything'], doctor);
  expect(result.code).toBe(2); expect(doctor).not.toHaveBeenCalled();
  expect((await runCli(['--help'], doctor)).stdout).toContain('run create|status|pause|resume|cancel|recover');
  expect((await runCli(['--version'], doctor)).code).toBe(0);
});
