export class RecentEventIds {
  private readonly seen = new Map<string, true>();

  constructor(private readonly capacity = 4_096) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity');
  }

  get size(): number {
    return this.seen.size;
  }

  accept(instanceId: string, eventId: string): boolean {
    const key = JSON.stringify([instanceId, eventId]);
    if (this.seen.has(key)) return false;
    this.seen.set(key, true);
    if (this.seen.size > this.capacity) {
      this.seen.delete(this.seen.keys().next().value!);
    }
    return true;
  }

  clear(): void {
    this.seen.clear();
  }
}
