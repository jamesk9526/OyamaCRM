export type DraftSaveState = "idle" | "pending" | "saving" | "saved" | "error";

/** One writer per mounted editor. Failed writes retain the latest snapshot for retry. */
export class EventDraftSaveQueue<T> {
  private tail: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;
  private savedRevision = 0;
  private value!: T;
  constructor(private save: (value: T) => Promise<unknown>, private state: (value: DraftSaveState) => void) {}

  get dirty() { return this.revision !== this.savedRevision; }

  schedule(value: T) {
    this.value = value;
    this.revision++;
    this.state("pending");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 650);
  }

  private enqueue<R>(operation: () => Promise<R>): Promise<R> {
    const result = this.tail.catch(() => {}).then(operation);
    this.tail = result;
    return result;
  }

  private async drain() {
    while (this.dirty) {
      const revision = this.revision;
      const value = this.value;
      this.state("saving");
      try { await this.save(value); this.savedRevision = revision; }
      catch (error) { this.state("error"); throw error; }
    }
    this.state("saved");
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    return this.enqueue(() => this.drain());
  }

  run<R>(operation: () => Promise<R>): Promise<R> {
    clearTimeout(this.timer);
    return this.enqueue(async () => {
      await this.drain();
      this.state("saving");
      try { const result = await operation(); this.state(this.dirty ? "pending" : "saved"); return result; }
      catch (error) { this.state("error"); throw error; }
    });
  }

  dispose() { clearTimeout(this.timer); }
}
