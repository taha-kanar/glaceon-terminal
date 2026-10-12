import { addTab, asPaneId, asTabId, createTab, EMPTY_WORKSPACE, splitPane } from '@glaceon/domain';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from '../tabs/TabBar';
import { fakeActions, fakeArrange } from '../testing/fake-actions';
import { render } from '../testing/render';
import { PaneArea } from './PaneArea';

const workspace = splitPane(
  addTab(EMPTY_WORKSPACE, createTab(asTabId('tab'), asPaneId('a'))),
  asPaneId('a'),
  { newPane: asPaneId('b'), axis: 'row' },
);

describe.each(['divider', 'pane-grip', 'tab'])('%s drag cleanup', (kind) => {
  it.each(['unmount', 'pointercancel', 'blur', 'restart', 'pointerup'])(
    'removes document listeners on %s',
    (end) => {
      const actions = fakeActions();
      const arrange = fakeArrange();
      const view = render(
        kind === 'tab' ? (
          <TabBar
            workspace={workspace}
            sessions={new Map()}
            actions={actions}
            arrange={arrange}
            renaming={undefined}
            windows={[]}
            newTabLabel={undefined}
          />
        ) : (
          <PaneArea
            workspace={workspace}
            sessions={new Map()}
            actions={actions}
            arrange={arrange}
            bindSlot={() => () => undefined}
          />
        ),
      );
      const target = view.container.querySelector(`[data-testid="${kind}"]`)!;
      const added = vi.spyOn(document, 'addEventListener');
      const removed = vi.spyOn(document, 'removeEventListener');
      const start = (): void => {
        act(() => {
          target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
        });
      };
      let mounted = true;
      try {
        start();
        const listeners = added.mock.calls.filter(([name]) => name.startsWith('pointer'));
        expect(listeners.map(([name]) => name)).toContain('pointermove');
        expect(listeners.map(([name]) => name)).toContain('pointerup');
        if (end === 'unmount') {
          view.unmount();
          mounted = false;
        } else if (end === 'restart') start();
        else
          act(() => {
            if (end === 'blur') window.dispatchEvent(new Event('blur'));
            else document.dispatchEvent(new PointerEvent(end, { bubbles: true }));
          });
        for (const [name, listener] of listeners) {
          expect(removed).toHaveBeenCalledWith(name, listener);
        }
        if (end !== 'restart') {
          expect(document.body.classList.contains('dragging-row')).toBe(false);
          expect(view.container.querySelector('.workspace--dragging')).toBeNull();
        }
        expect(arrange.movePane).not.toHaveBeenCalled();
        expect(arrange.moveTab).not.toHaveBeenCalled();
      } finally {
        act(() => {
          document.dispatchEvent(new PointerEvent('pointerup'));
        });
        if (mounted) view.unmount();
        vi.restoreAllMocks();
      }
    },
  );
});
