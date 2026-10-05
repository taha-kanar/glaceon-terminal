import type { TabTransferRequest } from '@glaceon/contracts';
import { TAB_COLORS } from '@glaceon/domain';
import { z } from 'zod';

const id = z.string().min(1).max(200);

interface NodeShape {
  kind: 'leaf' | 'split';
}

const paneNode: z.ZodType<NodeShape> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal('leaf'), id }),
    z.object({
      kind: z.literal('split'),
      axis: z.enum(['row', 'column']),
      ratio: z.number().gt(0).lt(1),
      first: paneNode,
      second: paneNode,
    }),
  ]),
);

const paneTransfer = z.object({
  sessionId: id,
  pid: z.number().int().positive(),
  shell: z.string().max(200),
  process: z.string().max(200).optional(),
  busy: z.boolean().optional(),
  // Serialized scrollback; generous, but bounded.
  snapshot: z
    .string()
    .max(64 * 1024 * 1024)
    .optional(),
});

const schema = z.object({
  payload: z.object({
    title: z.string().max(500).optional(),
    color: z.enum(TAB_COLORS).optional(),
    locked: z.boolean(),
    root: paneNode,
    activePane: id,
    zoomed: z.boolean(),
    panes: z
      .array(z.object({ pane: id, transfer: paneTransfer.optional() }))
      .min(1)
      .max(256),
  }),
  target: z.union([
    z.object({ kind: z.literal('window'), windowId: z.number().int() }),
    z.object({ kind: z.literal('newWindow') }),
    z.object({ kind: z.literal('point'), x: z.number(), y: z.number() }),
  ]),
});

/** Validates a renderer's tab transfer request before main forwards it to another window. */
export function decodeTabTransferRequest(value: unknown): TabTransferRequest | undefined {
  const result = schema.safeParse(value);
  // The schema mirrors TabTransferRequest; ids are branded strings on the TypeScript side only.
  return result.success ? (result.data as unknown as TabTransferRequest) : undefined;
}
