import type {
  PullRequestChecksState,
  PullRequestReviewDecision,
  PullRequestState,
  ThreadBoardColumn,
  ThreadPullRequestLink,
} from "@t3tools/contracts";

/**
 * Every column a thread can hold, including the one the board does not draw.
 * The names are the contract's; this list only fixes their order, and a column
 * added to one and not the other stops compiling.
 */
export const THREAD_BOARD_COLUMNS = [
  "building",
  "validating",
  "needs_review",
  "ready",
  "archive",
] as const satisfies ReadonlyArray<ThreadBoardColumn>;

/**
 * The lanes a board draws, in delivery order. Archive is deliberately absent:
 * finished work leaves the board rather than parking in a column nobody reads,
 * and the sidebar's settled shelf is where it goes to be found again.
 */
export const THREAD_BOARD_LANES = [
  "building",
  "validating",
  "needs_review",
  "ready",
] as const satisfies ReadonlyArray<ThreadBoardColumn>;

/** What a change request contributes to a thread's column. */
export interface ThreadBoardPullRequest {
  readonly state: PullRequestState;
  readonly isDraft?: boolean;
  readonly reviewDecision?: PullRequestReviewDecision | null;
  readonly checksState?: PullRequestChecksState | null;
}

/** The durable facts a column is derived from. */
export interface ThreadBoardFacts {
  readonly archivedAt?: string | null;
  readonly settledAt?: string | null;
  readonly pullRequest?: ThreadBoardPullRequest | null;
  /** The agent is mid-turn, or still running work behind one. */
  readonly isWorking?: boolean;
  /** The turn stopped on something only a person can answer. */
  readonly awaitsPerson?: boolean;
  /** The agent finished at least one turn, so there is something to look at. */
  readonly hasFinishedWork?: boolean;
}

/**
 * The column a thread's own state puts it in.
 *
 * The server owns this call and stores what it returns, so every client draws
 * the same board without each re-deriving it. Clients keep the function for
 * threads that arrive without a stored column, which is what a server older
 * than this field sends.
 *
 * A change request outranks the thread's own quiet: a settled thread whose
 * pull request is waiting on review belongs with the reviews, not the archive.
 */
export function deriveThreadBoardColumn(facts: ThreadBoardFacts): ThreadBoardColumn {
  if (facts.archivedAt != null) {
    return "archive";
  }

  const pullRequest = facts.pullRequest ?? null;
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
      return "validating";
    }
    // Approval is only worth acting on once the pipeline agrees, so a green
    // review over pending checks stays in review rather than promising a merge
    // the host would refuse.
    if (pullRequest.reviewDecision === "approved" && pullRequest.checksState !== "pending") {
      return "ready";
    }
    return "needs_review";
  }

  // Without a change request the thread's own turn is the only evidence there
  // is, and a board that waited for a pull request would strand every thread in
  // the first lane no matter how far its work had actually got.
  if (facts.isWorking === true) {
    return "building";
  }
  if (facts.awaitsPerson === true) {
    return "needs_review";
  }
  if (facts.settledAt != null) {
    return "ready";
  }
  // Stopped, asking for nothing, with a finished turn behind it: there is work
  // sitting there to be looked at, which is where a draft pull request lands
  // too. A thread that never ran has produced nothing and stays at the start.
  return facts.hasFinishedWork === true ? "validating" : "building";
}

/**
 * The change request a thread's column speaks for. A thread can carry several
 * links — a stack, or a reopened attempt — and the open one is the work in
 * flight. With none open the newest link still says how the work ended.
 */
export function pickBoardPullRequestLink(
  links: ReadonlyArray<ThreadPullRequestLink>,
): ThreadPullRequestLink | null {
  let newest: ThreadPullRequestLink | null = null;
  for (const link of links) {
    if (link.snapshot?.state === "open") {
      if (newest?.snapshot?.state === "open" && newest.linkedAt >= link.linkedAt) continue;
      newest = link;
      continue;
    }
    if (newest?.snapshot?.state === "open") continue;
    if (newest === null || link.linkedAt > newest.linkedAt) {
      newest = link;
    }
  }
  return newest;
}

/** The facts a thread contributes, read the same way on server and client. */
export function threadBoardFacts(thread: {
  readonly archivedAt?: string | null;
  readonly settledAt?: string | null;
  readonly pullRequests: ReadonlyArray<ThreadPullRequestLink>;
  readonly session?: { readonly status?: string | undefined } | null | undefined;
  readonly backgroundLiveness?: string | null | undefined;
  readonly hasPendingApprovals?: boolean | undefined;
  readonly hasPendingUserInput?: boolean | undefined;
  readonly latestTurn?: { readonly completedAt?: string | null | undefined } | null | undefined;
}): ThreadBoardFacts {
  const link = pickBoardPullRequestLink(thread.pullRequests);
  const snapshot = link?.snapshot ?? null;
  const sessionStatus = thread.session?.status ?? null;
  return {
    archivedAt: thread.archivedAt ?? null,
    settledAt: thread.settledAt ?? null,
    isWorking:
      sessionStatus === "running" ||
      sessionStatus === "starting" ||
      thread.backgroundLiveness === "working",
    awaitsPerson: thread.hasPendingApprovals === true || thread.hasPendingUserInput === true,
    hasFinishedWork: thread.latestTurn?.completedAt != null,
    pullRequest:
      link === null
        ? null
        : snapshot === null
          ? // Linked but never synced: it exists, so the work is out for review
            // rather than still on the bench.
            { state: "open" }
          : {
              state: snapshot.state,
              isDraft: snapshot.isDraft,
              reviewDecision: snapshot.reviewDecision ?? null,
              checksState: snapshot.checksState ?? null,
            },
  };
}
