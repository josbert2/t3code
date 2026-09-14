import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/**
 * The column stopped being a manual override and became the one the server
 * derives and every client draws, so the stored name says that now. Renaming
 * keeps whatever placements already existed instead of starting empty.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;
  if (columns.some((column) => column.name === "board_column")) {
    return;
  }
  if (columns.some((column) => column.name === "board_column_override")) {
    yield* sql`
      ALTER TABLE projection_threads
      RENAME COLUMN board_column_override TO board_column
    `;
    return;
  }
  yield* sql`
    ALTER TABLE projection_threads
    ADD COLUMN board_column TEXT
  `;
});
