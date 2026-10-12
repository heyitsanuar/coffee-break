import { expect, it } from 'vitest';
import { restoredOfficeScroll } from './officeExpansion';

it('preserves reachable nonzero scroll and clamps only unreachable positions', () => {
  expect(restoredOfficeScroll(300, 1200, 512)).toBe(300);
  expect(restoredOfficeScroll(900, 1200, 732)).toBe(468);
  expect(restoredOfficeScroll(-10, 1200, 512)).toBe(0);
  expect(restoredOfficeScroll(100, 400, 512)).toBe(0);
});
