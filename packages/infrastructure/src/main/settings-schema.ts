import {
  ANSI_COLOR_NAMES,
  FONT_SIZE_RANGE,
  type AnsiColorName,
  type PartialSettings,
  type Settings,
} from '@glaceon/domain';
import { z } from 'zod';

const keybinding = z.object({
  key: z.string(),
  command: z.string().min(1),
  when: z.string().optional(),
  args: z.union([z.string(), z.number()]).optional(),
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a #rrggbb color');

const theme = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  colors: z.object({
    background: hex,
    foreground: hex,
    cursor: hex,
    cursorAccent: hex,
    selection: hex,
    accent: hex,
    ansi: z.object(
      Object.fromEntries(ANSI_COLOR_NAMES.map((name) => [name, hex])) as Record<
        AnsiColorName,
        typeof hex
      >,
    ),
  }),
});

/** Validation for config.json. Every field is optional; unknown fields are ignored. */
export const settingsSchema = z
  .object({
    fontFamily: z.string().min(1),
    fontSize: z.number().min(FONT_SIZE_RANGE.min).max(FONT_SIZE_RANGE.max),
    lineHeight: z.number().min(1).max(3),
    letterSpacing: z.number().min(-5).max(20),
    theme: z.string().min(1),
    backgroundOpacity: z.number().min(0).max(1),
    cursorStyle: z.enum(['block', 'bar', 'underline']),
    cursorBlink: z.boolean(),
    scrollback: z.number().int().min(0).max(1_000_000),
    macOptionIsMeta: z.boolean(),
    copyOnSelect: z.boolean(),
    confirmCloseRunningProcess: z.boolean(),
    closeOnExit: z.enum(['always', 'clean', 'never']),
    editorCommand: z.string().min(1),
    quakeEnabled: z.boolean(),
    quakeShortcut: z.string(),
    quakeHeight: z.number().min(0.2).max(1),
    keybindings: z.array(keybinding),
    customThemes: z.array(theme),
  })
  .partial();

type Parsed = z.infer<typeof settingsSchema>;
type SameKeys<A, B> = [keyof A] extends [keyof B]
  ? [keyof B] extends [keyof A]
    ? true
    : false
  : false;
type Assert<T extends true> = T;
/** Compile-time proof that the schema covers exactly the fields of the domain type. */
export type SchemaMatchesDomain = Assert<SameKeys<Required<Parsed>, Settings>>;

export function describeIssues(error: z.ZodError): string {
  return error.issues
    .map(
      (issue) => `${issue.path.length === 0 ? '(root)' : issue.path.join('.')}: ${issue.message}`,
    )
    .join('; ');
}

export function toPartialSettings(parsed: Parsed): PartialSettings {
  return parsed as PartialSettings;
}

/** Validates one value before it is written to the file. */
export function validateSetting(key: string, value: unknown): string | undefined {
  if (!Object.hasOwn(settingsSchema.shape, key)) return `Unknown setting "${key}"`;
  if (value === undefined) return `Missing value for "${key}"`;
  const field = settingsSchema.shape[key as keyof typeof settingsSchema.shape];
  const parsed = field.safeParse(value);
  return parsed.success ? undefined : `${key}: ${describeIssues(parsed.error)}`;
}
