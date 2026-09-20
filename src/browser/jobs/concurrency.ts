export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Concurrency must be at least one.');
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.waiting.shift();
    if (next) next();
  }
}

export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limiter = new ConcurrencyLimiter(concurrency);
  return Promise.all(values.map((value, index) => limiter.run(() => operation(value, index))));
}
