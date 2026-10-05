import { DisposableStore, Emitter, toDisposable, type Disposable } from '@glaceon/domain';
import type { Command, CommandArgs, CommandContribution } from './command';

export interface CommandRunError {
  readonly commandId: string;
  readonly error: unknown;
}

/** The single place commands are registered and executed. */
export class CommandRegistry {
  readonly #commands = new Map<string, Command>();
  readonly #changed = new Emitter<undefined>();
  readonly #failed = new Emitter<CommandRunError>();

  register(command: Command): Disposable {
    if (this.#commands.has(command.id)) {
      throw new Error(`Command ${command.id} is already registered`);
    }
    this.#commands.set(command.id, command);
    this.#changed.emit(undefined);
    return toDisposable(() => {
      if (this.#commands.get(command.id) === command) {
        this.#commands.delete(command.id);
        this.#changed.emit(undefined);
      }
    });
  }

  registerContribution(contribution: CommandContribution): Disposable {
    const store = new DisposableStore();
    for (const command of contribution.commands()) store.add(this.register(command));
    return store;
  }

  has(id: string): boolean {
    return this.#commands.has(id);
  }

  get(id: string): Command | undefined {
    return this.#commands.get(id);
  }

  list(): readonly Command[] {
    return [...this.#commands.values()];
  }

  /** Runs a command. Returns false when no such command exists. Failures are reported, not thrown. */
  execute(id: string, args?: CommandArgs): boolean {
    const command = this.#commands.get(id);
    if (command === undefined) return false;
    try {
      const result = command.run(args);
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          this.#failed.emit({ commandId: id, error });
        });
      }
    } catch (error) {
      this.#failed.emit({ commandId: id, error });
    }
    return true;
  }

  onDidChange(listener: () => void): Disposable {
    return this.#changed.on(listener);
  }

  onDidFail(listener: (failure: CommandRunError) => void): Disposable {
    return this.#failed.on(listener);
  }
}
