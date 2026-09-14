import type { ThreadBoardColumn } from "@t3tools/contracts";
import { deriveThreadBoardColumn, type ThreadBoardFacts } from "@t3tools/shared/threadBoardColumn";

export {
  deriveThreadBoardColumn,
  THREAD_BOARD_COLUMNS,
  THREAD_BOARD_LANES,
  type ThreadBoardFacts,
  type ThreadBoardPullRequest,
} from "@t3tools/shared/threadBoardColumn";
export type { ThreadBoardColumn };

export interface ThreadBoardInput extends ThreadBoardFacts {
  /**
   * The column the server decided and stored. Absent from a server older than
   * the field, which is the only reason the facts still travel alongside it.
   */
  readonly boardColumn?: ThreadBoardColumn | null;
}

/**
 * Where a card sits. The stored column wins: the server derives it from the
 * same facts and a person can place a card by hand, and neither decision
 * should be re-litigated on every render.
 */
export function resolveThreadBoardColumn(input: ThreadBoardInput): ThreadBoardColumn {
  return input.boardColumn ?? deriveThreadBoardColumn(input);
}

/**
 * Groups threads into their columns, preserving the order they were given so
 * each column follows whatever ordering the list already had.
 */
export function buildThreadBoard<TThread>(input: {
  readonly threads: ReadonlyArray<TThread>;
  readonly resolveInput: (thread: TThread) => ThreadBoardInput;
}): Record<ThreadBoardColumn, ReadonlyArray<TThread>> {
  const board: Record<ThreadBoardColumn, TThread[]> = {
    building: [],
    validating: [],
    needs_review: [],
    ready: [],
    archive: [],
  };
  for (const thread of input.threads) {
    board[resolveThreadBoardColumn(input.resolveInput(thread))].push(thread);
  }
  return board;
}
