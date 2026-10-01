/** Máquina de estados mínima y declarativa. Las transiciones inválidas lanzan error. */
export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export class InvalidTransitionError extends Error {
  constructor(
    readonly entity: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(`Transición inválida de ${entity}: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function createStateMachine<S extends string>(entity: string, transitions: TransitionMap<S>) {
  return {
    entity,
    transitions,
    can(from: S, to: S): boolean {
      return from === to ? false : transitions[from]?.includes(to) ?? false;
    },
    assert(from: S, to: S): void {
      if (!this.can(from, to)) throw new InvalidTransitionError(entity, from, to);
    },
    next(from: S): readonly S[] {
      return transitions[from] ?? [];
    },
    isTerminal(state: S): boolean {
      return (transitions[state] ?? []).length === 0;
    },
  };
}
