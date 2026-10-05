import type { KeybindingService } from '@glaceon/application';

/**
 * Routes key presses to the keybinding service before xterm or any input sees them
 * (capture phase on the window). Handled keys are swallowed.
 */
export function installKeyboardHandler(target: Window, keybindings: KeybindingService): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing) return;
    if (keybindings.handleKey(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  target.addEventListener('keydown', onKeyDown, { capture: true });
  return () => {
    target.removeEventListener('keydown', onKeyDown, { capture: true });
  };
}
