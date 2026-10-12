import type { DividerRect } from '@glaceon/domain';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '../testing/render';
import { Divider } from './Divider';

const divider: DividerRect = {
  path: [],
  axis: 'row',
  region: { x: 0, y: 0, width: 1, height: 1 },
  position: 0.5,
};

function setup() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(nextFrame, callback);
    return nextFrame++;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  const container = { current: document.createElement('div') };
  vi.spyOn(container.current, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 }),
  );
  const onRatio = vi.fn();
  const view = render(<Divider divider={divider} container={container} onRatio={onRatio} />);
  const pointer = (type: string, x: number): void => {
    act(() => {
      const target = type === 'pointerdown' ? view.container.firstElementChild : document;
      target?.dispatchEvent(
        new PointerEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 10 }),
      );
    });
  };
  const nextAnimationFrame = (): void => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(0);
  };
  return { view, onRatio, pointer, nextAnimationFrame, frames };
}

describe('Divider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends at most one ratio per frame while dragging, and the final one on release', () => {
    const { view, onRatio, pointer, nextAnimationFrame, frames } = setup();
    pointer('pointerdown', 500);
    pointer('pointermove', 100);
    pointer('pointermove', 200);
    pointer('pointermove', 300);
    expect(onRatio).not.toHaveBeenCalled();
    nextAnimationFrame();
    expect(onRatio.mock.calls).toEqual([[0.3]]);

    pointer('pointermove', 400);
    pointer('pointerup', 600);
    expect(onRatio.mock.calls).toEqual([[0.3], [0.6]]);
    expect(frames.size).toBe(0);
    view.unmount();
  });

  it('drops the pending ratio when the drag is cancelled', () => {
    const { view, onRatio, pointer, frames } = setup();
    pointer('pointerdown', 500);
    pointer('pointermove', 100);
    pointer('pointercancel', 100);
    expect(frames.size).toBe(0);
    expect(onRatio).not.toHaveBeenCalled();
    view.unmount();
  });
});
