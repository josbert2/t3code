import { describe, expect, it } from "vite-plus/test";

import {
  buildThreadBoard,
  resolveThreadBoardColumn,
  type ThreadBoardInput,
} from "./threadBoard.ts";

describe("resolveThreadBoardColumn", () => {
  it("keeps a working thread building until it settles or opens a change request", () => {
    expect(resolveThreadBoardColumn({})).toBe("building");
    expect(resolveThreadBoardColumn({ settledAt: "2026-09-13T00:00:00.000Z" })).toBe("archive");
  });

  it("sends drafts, requested changes and failing checks back to validating", () => {
    expect(resolveThreadBoardColumn({ pullRequest: { state: "open", isDraft: true } })).toBe(
      "validating",
    );
    expect(
      resolveThreadBoardColumn({
        pullRequest: { state: "open", reviewDecision: "changes-requested" },
      }),
    ).toBe("validating");
    expect(
      resolveThreadBoardColumn({
        pullRequest: { state: "open", reviewDecision: "approved", checksState: "failing" },
      }),
    ).toBe("validating");
  });

  it("promotes to ready only once approval and checks agree", () => {
    expect(
      resolveThreadBoardColumn({
        pullRequest: { state: "open", reviewDecision: "approved", checksState: "passing" },
      }),
    ).toBe("ready");
    // No pipeline at all is not a red pipeline.
    expect(
      resolveThreadBoardColumn({ pullRequest: { state: "open", reviewDecision: "approved" } }),
    ).toBe("ready");
    // Still running: promising a merge the host would refuse is worse than waiting.
    expect(
      resolveThreadBoardColumn({
        pullRequest: { state: "open", reviewDecision: "approved", checksState: "pending" },
      }),
    ).toBe("needs_review");
    expect(
      resolveThreadBoardColumn({
        pullRequest: { state: "open", reviewDecision: "review-required" },
      }),
    ).toBe("needs_review");
  });

  it("archives a thread once its change request lands or is dropped", () => {
    expect(resolveThreadBoardColumn({ pullRequest: { state: "merged" } })).toBe("archive");
    expect(resolveThreadBoardColumn({ pullRequest: { state: "closed" } })).toBe("archive");
    expect(resolveThreadBoardColumn({ archivedAt: "2026-09-13T00:00:00.000Z" })).toBe("archive");
  });

  it("lets a change request outrank the thread's own quiet", () => {
    expect(
      resolveThreadBoardColumn({
        settledAt: "2026-09-13T00:00:00.000Z",
        pullRequest: { state: "open", reviewDecision: "review-required" },
      }),
    ).toBe("needs_review");
  });
});

describe("buildThreadBoard", () => {
  it("groups threads into columns and keeps the order they arrived in", () => {
    const threads: ReadonlyArray<{ id: string; board: ThreadBoardInput }> = [
      { id: "a", board: {} },
      { id: "b", board: { pullRequest: { state: "open", reviewDecision: "review-required" } } },
      { id: "c", board: {} },
      { id: "d", board: { pullRequest: { state: "merged" } } },
    ];

    const board = buildThreadBoard({ threads, resolveInput: (thread) => thread.board });

    expect(board.building.map((thread) => thread.id)).toEqual(["a", "c"]);
    expect(board.needs_review.map((thread) => thread.id)).toEqual(["b"]);
    expect(board.archive.map((thread) => thread.id)).toEqual(["d"]);
    expect(board.validating).toEqual([]);
    expect(board.ready).toEqual([]);
  });
});
