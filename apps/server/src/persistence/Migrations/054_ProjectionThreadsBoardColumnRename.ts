import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/**
 * The board lanes took their delivery-order names. Rewrite the columns already
 * stored so a thread someone placed by hand keeps the lane they chose instead
 * of failing to decode and losing its placement.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;
  if (!columns.some((column) => column.name === "board_column_override")) {
    return;
  }
  for (const [before, after] of [
    ["pending", "building"],
    ["iterating", "validating"],
    ["review", "needs_review"],
  ] as const) {
    yield* sql`
      UPDATE projection_threads
      SET board_column_override = ${after}
      WHERE board_column_override = ${before}
    `;
  }
});
