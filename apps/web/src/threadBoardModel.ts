import type { ThreadPullRequestLink } from "@t3tools/contracts";
import type {
  ThreadBoardColumn,
  ThreadBoardInput,
} from "@t3tools/client-runtime/state/thread-board";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

export const THREAD_BOARD_COLUMN_LABELS: Record<ThreadBoardColumn, string> = {
  pending: "Pending Work",
  iterating: "Iterating",
  review: "In Review",
  ready: "Ready to merge",
  archive: "Archive",
};

/**
 * The change request a card speaks for. A thread can carry several links —
 * a stack, or a reopened attempt — and the open one is the work in flight.
 * With none open the newest link still says how the work ended.
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

export function threadBoardInput(thread: EnvironmentThreadShell): ThreadBoardInput {
  const link = pickBoardPullRequestLink(thread.pullRequests);
  const snapshot = link?.snapshot ?? null;
  return {
    archivedAt: thread.archivedAt,
    settledAt: thread.settledAt,
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
