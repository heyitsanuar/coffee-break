import type { CoffeeBreakApi } from '../../shared/agentState';

declare global {
  interface Window {
    coffeeBreak: CoffeeBreakApi;
  }
}

export {};
