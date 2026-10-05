/** Operations on the window a renderer lives in, carried out by the main process. */
export interface WindowPort {
  newWindow(): void;
  close(): void;
  openSettingsFile(): void;
}
