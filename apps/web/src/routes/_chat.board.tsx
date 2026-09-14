import { createFileRoute } from "@tanstack/react-router";

import { ThreadBoardView } from "~/components/board/ThreadBoardView";

export const Route = createFileRoute("/_chat/board")({
  component: ThreadBoardView,
});
