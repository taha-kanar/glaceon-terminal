import type { IdGenerator } from '../ports/id-generator';

export class SequentialIdGenerator implements IdGenerator {
  #next = 1;

  constructor(private readonly prefix = 'id') {}

  next(): string {
    return `${this.prefix}-${String(this.#next++)}`;
  }
}
