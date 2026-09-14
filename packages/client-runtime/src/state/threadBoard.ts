import type {
  PullRequestChecksState,
  PullRequestReviewDecision,
  PullRequestState,
} from "@t3tools/contracts";

/**
 * Board columns, left to right. The order is the order work moves in, so a
 * card only ever travels forward unless the work itself goes backwards.
 */
export const THREAD_BOARD_COLUMNS = ["pending", "iterating", "review", "ready", "archive"] as const;
export type ThreadBoardColumn = (typeof THREAD_BOARD_COLUMNS)[number];

/** What a change request contributes to a card's column. */
export interface ThreadBoardPullRequest {
  readonly state: PullRequestState;
  readonly isDraft?: boolean;
  readonly reviewDecision?: PullRequestReviewDecision | null;
  readonly checksState?: PullRequestChecksState | null;
}

export interface ThreadBoardInput {
  readonly archivedAt?: string | null;
  readonly settledAt?: string | null;
  readonly pullRequest?: ThreadBoardPullRequest | null;
}

/**
 * Where a thread sits on the board, derived from what is actually true of it
 * rather than from anything a person filed. Nothing here is stored: a card
 * moves when the agent finishes, a review lands, or a pipeline turns green.
 *
 * A change request outranks the thread's own quiet: a settled thread whose
 * pull request is waiting on review belongs with the reviews, not in the
 * archive.
 */
export function resolveThreadBoardColumn(input: ThreadBoardInput): ThreadBoardColumn {
  if (input.archivedAt != null) {
    return "archive";
  }

  const pullRequest = input.pullRequest ?? null;
  if (pullRequest !== null) {
    if (pullRequest.state !== "open") {
      // Merged or closed: the work left the board through the front door.
      return "archive";
    }
    if (
      pullRequest.isDraft === true ||
      pullRequest.reviewDecision === "changes-requested" ||
      pullRequest.checksState === "failing"
    ) {
      return "iterating";
    }
    // Approval is only worth acting on once the pipeline agrees, so a green
    // review over pending checks stays in review rather than promising a merge
    // the host would refuse.
    if (pullRequest.reviewDecision === "approved" && pullRequest.checksState !== "pending") {
      return "ready";
    }
    return "review";
  }

  return input.settledAt != null ? "archive" : "pending";
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
    pending: [],
    iterating: [],
    review: [],
    ready: [],
    archive: [],
  };
  for (const thread of input.threads) {
    board[resolveThreadBoardColumn(input.resolveInput(thread))].push(thread);
  }
  return board;
}
