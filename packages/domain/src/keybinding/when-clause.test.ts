import { describe, expect, it } from 'vitest';
import { evaluateWhen, parseWhen } from './when-clause';

function check(source: string, context: Record<string, boolean>): boolean {
  const parsed = parseWhen(source);
  if (!parsed.ok) throw new Error(parsed.error);
  return evaluateWhen(parsed.value, (key) => context[key] ?? false);
}

describe('when clauses', () => {
  it('evaluates keys, negation, conjunction, disjunction and grouping', () => {
    expect(check('terminalFocus', { terminalFocus: true })).toBe(true);
    expect(check('!terminalFocus', { terminalFocus: true })).toBe(false);
    expect(check('a && b', { a: true })).toBe(false);
    expect(check('a || b', { b: true })).toBe(true);
    expect(check('a && (b || c)', { a: true, c: true })).toBe(true);
    expect(check('!a && !b || c', { c: true, a: true })).toBe(true);
    expect(check('  overlay.open  ', { 'overlay.open': true })).toBe(true);
  });

  it('binds && tighter than ||', () => {
    expect(check('a || b && c', { a: true })).toBe(true);
    expect(check('a || b && c', { b: true })).toBe(false);
  });

  it('reports syntax errors', () => {
    for (const bad of ['', 'a &&', '(a', 'a b', 'a & b', '&& a', ')']) {
      expect(parseWhen(bad).ok, bad).toBe(false);
    }
  });
});
