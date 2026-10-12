export function restoredOfficeScroll(saved: number, scrollHeight: number, clientHeight: number): number {
  return Math.min(Math.max(saved, 0), Math.max(0, scrollHeight - clientHeight));
}
