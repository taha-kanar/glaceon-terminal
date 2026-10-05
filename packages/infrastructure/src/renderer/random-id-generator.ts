import type { IdGenerator } from '@glaceon/application';

export class RandomIdGenerator implements IdGenerator {
  next(): string {
    return crypto.randomUUID();
  }
}
