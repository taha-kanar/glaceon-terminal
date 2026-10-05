import { DEFAULT_SETTINGS, err, ok } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { FakeSettingsSource } from '../testing';
import { ObservableStore } from '../store/store';
import { FontZoom } from './font-zoom';
import { SettingsService } from './settings-service';

describe('SettingsService', () => {
  it('loads settings with defaults and reloads on change', async () => {
    const source = new FakeSettingsSource();
    source.next = ok({ fontSize: 16 });
    const service = new SettingsService(source);
    await service.start();
    expect(service.state.get()).toEqual({
      settings: { ...DEFAULT_SETTINGS, fontSize: 16 },
      problems: [],
    });

    source.change(ok({ theme: 'nord' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(service.state.get().settings.theme).toBe('nord');
    expect(service.state.get().settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });

  it('keeps the last good settings when the file becomes invalid', async () => {
    const source = new FakeSettingsSource();
    source.next = ok({ fontSize: 18 });
    const service = new SettingsService(source);
    await service.start();

    source.next = err('Unexpected token at line 3');
    await service.reload();
    expect(service.state.get()).toEqual({
      settings: { ...DEFAULT_SETTINGS, fontSize: 18 },
      problems: ['Unexpected token at line 3'],
    });

    source.next = ok({ fontSize: 12 });
    await service.reload();
    expect(service.state.get().problems).toEqual([]);
    service.dispose();
  });
});

describe('SettingsService.update', () => {
  it('writes through the source and reloads', async () => {
    const source = new FakeSettingsSource();
    const service = new SettingsService(source);
    await service.start();
    expect(await service.update('theme', 'nord')).toEqual({ ok: true, value: undefined });
    expect(service.state.get().settings.theme).toBe('nord');
    source.writeError = 'read-only file system';
    expect((await service.update('fontSize', 20)).ok).toBe(false);
    expect(service.state.get().settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });
});

describe('FontZoom', () => {
  it('adjusts the configured size within bounds and resets', () => {
    const base = new ObservableStore({ ...DEFAULT_SETTINGS, fontSize: 70 });
    const zoom = new FontZoom(base);
    zoom.increase();
    zoom.increase();
    zoom.increase();
    expect(zoom.effective.get().fontSize).toBe(72);
    zoom.decrease();
    expect(zoom.effective.get().fontSize).toBe(71);
    base.set({ ...DEFAULT_SETTINGS, fontSize: 10 });
    expect(zoom.effective.get().fontSize).toBe(11);
    zoom.reset();
    expect(zoom.effective.get()).toBe(base.get());
  });
});
