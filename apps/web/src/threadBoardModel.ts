import type { ThreadBoardColumn } from "@t3tools/contracts";
import type { ThreadBoardInput } from "@t3tools/client-runtime/state/thread-board";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { threadBoardFacts } from "@t3tools/shared/threadBoardColumn";

export { pickBoardPullRequestLink } from "@t3tools/shared/threadBoardColumn";

export const THREAD_BOARD_COLUMN_LABELS: Record<ThreadBoardColumn, string> = {
  building: "Building",
  validating: "Validating",
  needs_review: "Needs review",
  ready: "Ready",
  archive: "Archive",
};

/**
 * What a card knows about its own placement: the column the server settled on,
 * and the facts behind it so a server too old to send one still lands the card
 * in the right lane.
 */
export function threadBoardInput(thread: EnvironmentThreadShell): ThreadBoardInput {
  return {
    ...threadBoardFacts(thread),
    boardColumn: thread.boardColumn ?? null,
  };
}
