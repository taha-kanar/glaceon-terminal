export interface PtyExit {
  readonly exitCode: number;
  readonly signal?: number;
}
