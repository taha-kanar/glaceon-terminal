declare const brand: unique symbol;

/** Nominal typing for primitives: a `SessionId` cannot be passed where a `PaneId` is expected. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };
