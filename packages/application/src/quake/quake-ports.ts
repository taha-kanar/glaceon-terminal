import type { Rect } from '@glaceon/domain';

/** Screen rectangles in pixels. */
export type ScreenRect = Rect;

/** The drop-down window. It is created ahead of time so showing it is instant. */
export interface QuakePanel {
  readonly visible: boolean;
  readonly focused: boolean;
  show(bounds: ScreenRect): void;
  hide(): void;
}

export interface ScreenPort {
  /** Usable area (without menu bar and Dock) of the display the pointer is on. */
  workAreaAtPointer(): ScreenRect;
}

export interface GlobalShortcutPort {
  /** Returns false when the system or another app already owns the shortcut. */
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
}

export interface AppActivationPort {
  /** One of the app's windows has focus (the app is frontmost). */
  isActive(): boolean;
  /** Gives focus back to the app that was frontmost before. */
  yieldFocus(): void;
}
