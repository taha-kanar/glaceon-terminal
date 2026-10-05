import { describe, expect, it } from 'vitest';
import { ConfirmationService } from './confirmation-service';

const request = (title: string) => ({ title, message: 'm', confirmLabel: 'OK' });

describe('ConfirmationService', () => {
  it('shows requests one at a time and resolves them in order', async () => {
    const service = new ConfirmationService();
    const first = service.confirm(request('one'));
    const second = service.confirm(request('two'));
    expect(service.current.get()?.title).toBe('one');
    service.answer(true);
    expect(service.current.get()?.title).toBe('two');
    service.answer(false);
    expect(service.current.get()).toBeUndefined();
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
    service.answer(true);
  });
});
