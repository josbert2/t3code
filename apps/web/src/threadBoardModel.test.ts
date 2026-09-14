import { describe, expect, it } from "vite-plus/test";
import type { ThreadPullRequestLink } from "@t3tools/contracts";

import { pickBoardPullRequestLink } from "./threadBoardModel";

function makeLink(overrides: {
  number: number;
  linkedAt: string;
  state?: "open" | "closed" | "merged";
}): ThreadPullRequestLink {
  return {
    host: "github.com",
    repository: "t3tools/t3code",
    number: overrides.number,
    url: `https://github.com/t3tools/t3code/pull/${overrides.number}`,
    source: "agent",
    linkedAt: overrides.linkedAt,
    snapshot:
      overrides.state === undefined
        ? null
        : {
            state: overrides.state,
            title: "Change",
            headBranch: "feat/change",
            baseBranch: "main",
            isDraft: false,
            updatedAt: overrides.linkedAt,
            syncedAt: overrides.linkedAt,
          },
    stack: null,
  } as ThreadPullRequestLink;
}

describe("pickBoardPullRequestLink", () => {
  it("prefers the open change request over a newer closed one", () => {
    const link = pickBoardPullRequestLink([
      makeLink({ number: 1, linkedAt: "2026-09-01T00:00:00.000Z", state: "open" }),
      makeLink({ number: 2, linkedAt: "2026-09-05T00:00:00.000Z", state: "closed" }),
    ]);

    expect(link?.number).toBe(1);
  });

  it("falls back to the newest link when none is open", () => {
    const link = pickBoardPullRequestLink([
      makeLink({ number: 1, linkedAt: "2026-09-01T00:00:00.000Z", state: "merged" }),
      makeLink({ number: 2, linkedAt: "2026-09-05T00:00:00.000Z", state: "closed" }),
    ]);

    expect(link?.number).toBe(2);
  });

  it("keeps the newest of several open change requests", () => {
    const link = pickBoardPullRequestLink([
      makeLink({ number: 1, linkedAt: "2026-09-01T00:00:00.000Z", state: "open" }),
      makeLink({ number: 2, linkedAt: "2026-09-05T00:00:00.000Z", state: "open" }),
    ]);

    expect(link?.number).toBe(2);
  });

  it("has nothing to show for a thread with no links", () => {
    expect(pickBoardPullRequestLink([])).toBeNull();
  });
});
