import { findLinks, type TerminalLink } from '@glaceon/domain';
import type { IBufferCellPosition, ILink, ILinkProvider, Terminal } from '@xterm/xterm';

interface CellRef {
  /** 0-based buffer row. */
  readonly row: number;
  /** 0-based column. */
  readonly x: number;
  readonly width: number;
}

/** A soft-wrapped logical line as text plus, for every UTF-16 unit, the cell it came from. */
interface LogicalLine {
  readonly text: string;
  readonly cells: readonly CellRef[];
}

/** Collects the logical line containing `row`, mapping text offsets back to cells (wide chars included). */
export function readLogicalLine(terminal: Terminal, row: number): LogicalLine | undefined {
  const buffer = terminal.buffer.active;
  let first = row;
  while (first > 0 && buffer.getLine(first)?.isWrapped === true) first--;
  let last = row;
  while (buffer.getLine(last + 1)?.isWrapped === true) last++;

  let text = '';
  const cells: CellRef[] = [];
  const cell = buffer.getNullCell();
  for (let r = first; r <= last; r++) {
    const line = buffer.getLine(r);
    if (line === undefined) return undefined;
    for (let x = 0; x < line.length; x++) {
      line.getCell(x, cell);
      const width = cell.getWidth();
      if (width === 0) continue; // second half of a wide character
      const chars = cell.getChars() === '' ? ' ' : cell.getChars();
      // One entry per UTF-16 unit, matching the offsets findLinks reports.
      cells.push(...new Array<CellRef>(chars.length).fill({ row: r, x, width }));
      text += chars;
    }
  }
  return { text, cells };
}

function position(cell: CellRef, edge: 'start' | 'end'): IBufferCellPosition {
  // xterm ranges are 1-based and inclusive.
  return { x: edge === 'start' ? cell.x + 1 : cell.x + cell.width, y: cell.row + 1 };
}

export type LinkActivation = (link: TerminalLink, event: MouseEvent) => void;

/** Detects links with the domain link finder and reports clicks on them. */
export class TerminalLinkProvider implements ILinkProvider {
  readonly #terminal: Terminal;
  readonly #activate: LinkActivation;

  constructor(terminal: Terminal, activate: LinkActivation) {
    this.#terminal = terminal;
    this.#activate = activate;
  }

  provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
    const row = bufferLineNumber - 1;
    const logical = readLogicalLine(this.#terminal, row);
    if (logical === undefined) {
      callback(undefined);
      return;
    }
    const links: ILink[] = [];
    for (const link of findLinks(logical.text)) {
      const start = logical.cells[link.start];
      const end = logical.cells[link.end - 1];
      if (start === undefined || end === undefined || start.row > row || end.row < row) continue;
      links.push({
        range: { start: position(start, 'start'), end: position(end, 'end') },
        text: logical.text.slice(link.start, link.end),
        decorations: { underline: true, pointerCursor: true },
        activate: (event) => {
          this.#activate(link, event);
        },
      });
    }
    callback(links.length === 0 ? undefined : links);
  }
}
