import { err, ok, type Result } from '../shared/result';

/** A parsed `when` condition such as `terminalFocus && !searchOpen`. */
export type WhenExpr =
  | { readonly kind: 'context'; readonly key: string }
  | { readonly kind: 'not'; readonly operand: WhenExpr }
  | { readonly kind: 'and' | 'or'; readonly left: WhenExpr; readonly right: WhenExpr };

export type ContextLookup = (key: string) => boolean;

const TOKEN_PATTERN = /\s*(&&|\|\||!|\(|\)|[A-Za-z_][\w.]*)/y;

function tokenize(source: string): Result<string[], string> {
  const tokens: string[] = [];
  TOKEN_PATTERN.lastIndex = 0;
  while (TOKEN_PATTERN.lastIndex < source.length) {
    if (source.slice(TOKEN_PATTERN.lastIndex).trim() === '') break;
    const at = TOKEN_PATTERN.lastIndex;
    const match = TOKEN_PATTERN.exec(source);
    if (match?.[1] === undefined) return err(`Unexpected character at ${String(at)}`);
    tokens.push(match[1]);
  }
  return ok(tokens);
}

/** Recursive descent: or := and ('||' and)* ; and := unary ('&&' unary)* ; unary := '!' unary | '(' or ')' | id */
class WhenParser {
  readonly #tokens: readonly string[];
  #index = 0;

  constructor(tokens: readonly string[]) {
    this.#tokens = tokens;
  }

  parse(): WhenExpr {
    const expr = this.#or();
    if (this.#index < this.#tokens.length) throw new Error(`Unexpected "${this.#peek() ?? ''}"`);
    return expr;
  }

  #peek(): string | undefined {
    return this.#tokens[this.#index];
  }

  #or(): WhenExpr {
    let left = this.#and();
    while (this.#peek() === '||') {
      this.#index++;
      left = { kind: 'or', left, right: this.#and() };
    }
    return left;
  }

  #and(): WhenExpr {
    let left = this.#unary();
    while (this.#peek() === '&&') {
      this.#index++;
      left = { kind: 'and', left, right: this.#unary() };
    }
    return left;
  }

  #unary(): WhenExpr {
    const token = this.#peek();
    this.#index++;
    if (token === '!') return { kind: 'not', operand: this.#unary() };
    if (token === '(') {
      const inner = this.#or();
      if (this.#peek() !== ')') throw new Error('Missing ")"');
      this.#index++;
      return inner;
    }
    if (token === undefined || !/^[A-Za-z_]/.test(token)) {
      throw new Error(`Expected a context key, got "${token ?? 'end of input'}"`);
    }
    return { kind: 'context', key: token };
  }
}

export function parseWhen(source: string): Result<WhenExpr, string> {
  const tokens = tokenize(source);
  if (!tokens.ok) return tokens;
  try {
    return ok(new WhenParser(tokens.value).parse());
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

export function evaluateWhen(expr: WhenExpr, lookup: ContextLookup): boolean {
  switch (expr.kind) {
    case 'context':
      return lookup(expr.key);
    case 'not':
      return !evaluateWhen(expr.operand, lookup);
    case 'and':
      return evaluateWhen(expr.left, lookup) && evaluateWhen(expr.right, lookup);
    case 'or':
      return evaluateWhen(expr.left, lookup) || evaluateWhen(expr.right, lookup);
  }
}
