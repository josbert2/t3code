import {
  buildThreadBoard,
  resolveThreadBoardColumn,
  THREAD_BOARD_LANES,
  type ThreadBoardColumn,
} from "@t3tools/client-runtime/state/thread-board";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useNavigate } from "@tanstack/react-router";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  PinIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { pullRequestEnvironment } from "../../state/pullRequests";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { toastManager } from "../ui/toast";
import { useProjects, useThreadShells } from "../../state/entities";
import {
  buildSidebarProjectSnapshots,
  buildSidebarSpaceSections,
  resolveScopedProjectKeys,
} from "../../sidebarProjectGrouping";
import { selectProjectGroupingSettings } from "../../logicalProject";
import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";
import { usePrimaryEnvironmentId } from "../../state/environments";
import {
  pickBoardPullRequestLink,
  threadBoardInput,
  THREAD_BOARD_COLUMN_LABELS,
} from "../../threadBoardModel";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { useUiStateStore } from "../../uiStateStore";
import {
  hasUnseenCompletion,
  moreUrgentSidebarStatus,
  resolveSidebarThreadStatus,
} from "../Sidebar.logic";
import { resolveThreadStatusPresentation, THREAD_STATUS_ICONS } from "../threadStatusPresentation";
import { useFlipCards } from "./useFlipCards";
import { playAppSound } from "../../sounds";
import { useSyncSounds, useThreadStatusSounds } from "../../hooks/useSounds";
import type { SoundEvent } from "@t3tools/contracts/settings";
import {
  BOARD_APPEARANCE_DOT_CLASS,
  BOARD_APPEARANCE_ICONS,
  BOARD_APPEARANCE_TEXT_CLASS,
  resolveCardAppearance,
} from "./boardAppearance";
import type { BoardAppearance } from "@t3tools/contracts/settings";
import type { BoardAppearanceColor, BoardAppearanceIcon } from "@t3tools/contracts/settings";
import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import { readLocalApi } from "../../localApi";
import {
  buildBoardCardMenuItems,
  buildBoardColumnMenuItems,
  parseBoardMenuId,
} from "./boardContextMenu";

/** The select needs a value for "no filter"; the store keeps null. */
const ALL_PROJECTS_VALUE = "__all__";

const COLUMN_DOT_CLASS: Record<ThreadBoardColumn, string> = {
  building: "bg-sky-500",
  validating: "bg-orange-500",
  needs_review: "bg-amber-500",
  ready: "bg-emerald-500",
  archive: "bg-muted-foreground",
};

function ThreadBoardCard({
  thread,
  canMerge,
  appearance,
  showStatus,
  onContextMenu,
  onUnpin,
}: {
  thread: EnvironmentThreadShell;
  canMerge: boolean;
  appearance: BoardAppearance | null;
  showStatus: boolean;
  onContextMenu: (thread: EnvironmentThreadShell, position: { x: number; y: number }) => void;
  onUnpin: (thread: EnvironmentThreadShell) => void;
}) {
  const navigate = useNavigate();
  const link = pickBoardPullRequestLink(thread.pullRequests);
  const snapshot = link?.snapshot ?? null;
  const updatedLabel = formatRelativeTimeLabel(thread.updatedAt);
  const threadKey = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
  const lastVisitedAt = useUiStateStore((state) => state.threadLastVisitedAtById[threadKey]);
  // The same status the sidebar shows, so one thread never reads as two.
  // Woke is the exception: it answers a snooze the board cannot set, so it
  // stays a sidebar signal rather than a pill with no way to clear it here.
  const statusPresentation = resolveThreadStatusPresentation({
    status: resolveSidebarThreadStatus(thread),
    isUnread: hasUnseenCompletion({ ...thread, lastVisitedAt }),
    isWoke: false,
  });
  const StatusIcon =
    statusPresentation === null ? null : THREAD_STATUS_ICONS[statusPresentation.icon];
  const runAction = useAtomCommand(pullRequestEnvironment.runAction, { reportFailure: false });
  const [merging, setMerging] = useState(false);
  const isPinned = thread.boardColumn != null;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: threadKey,
    data: { thread },
  });

  const merge = async () => {
    if (link === null || merging) return;
    setMerging(true);
    const result = await runAction({
      environmentId: thread.environmentId,
      input: {
        projectId: thread.projectId,
        host: link.host,
        repository: link.repository,
        number: link.number,
        action: "merge",
      },
    });
    setMerging(false);
    if (result._tag === "Failure") {
      // The host refuses a merge for reasons the board cannot see — a branch
      // policy, a protected base — and only its own sentence explains which.
      toastManager.add({
        type: "error",
        title: `Could not merge #${link.number}`,
        description: "Open the pull request to see what the host said.",
      });
      return;
    }
    toastManager.add({ type: "success", title: `Merged #${link.number}` });
  };

  const open = () => {
    void navigate({
      to: "/$environmentId/$threadId",
      params: { environmentId: thread.environmentId, threadId: thread.id },
    });
  };

  // A div rather than a button: the Ready column puts a Merge button inside the
  // card, and interactive content cannot nest inside a button.
  return (
    <div
      ref={setNodeRef}
      // Spread first: the drag attributes carry their own role/tabIndex, and
      // the card's explicit pair has to win.
      {...attributes}
      role="button"
      tabIndex={0}
      data-flip-key={threadKey}
      className={cn(
        "w-full cursor-pointer rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // The card keeps its slot while the overlay-free drag runs, so the
        // column does not reflow under the pointer.
        isDragging && "opacity-40",
        isPinned && "border-dashed",
      )}
      {...listeners}
      onContextMenu={(event) => {
        event.preventDefault();
        // Without this the desktop shell answers with its own Cut/Copy/Paste.
        event.stopPropagation();
        onContextMenu(thread, { x: event.clientX, y: event.clientY });
      }}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
      }}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        {appearance === null ? null : <CardAppearanceMark appearance={appearance} />}
        <span className="line-clamp-2 min-w-0 flex-1 font-medium text-sm">{thread.title}</span>
      </span>
      {showStatus && statusPresentation !== null && StatusIcon !== null ? (
        <span
          className={cn(
            "mt-2 flex min-w-0 items-center gap-1.5 font-medium text-xs",
            statusPresentation.className,
          )}
        >
          <StatusIcon
            aria-hidden
            className={cn(
              "size-3.5 shrink-0",
              // The sidebar keeps this still on purpose: a column of forever
              // animating rows is noise, and it repaints every vsync. A board
              // holds few enough cards that the spin reads as progress.
              statusPresentation.icon === "working" && "animate-spin",
            )}
          />
          <span className="truncate">{statusPresentation.label}</span>
        </span>
      ) : null}
      {thread.branch ? (
        <span className="mt-2 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
          <GitBranchIcon className="size-3.5 shrink-0" />
          <span className="truncate font-mono">{thread.branch}</span>
        </span>
      ) : null}
      {link ? (
        <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
          <GitPullRequestIcon className="size-3.5 shrink-0" />
          <span className="truncate">
            #{link.number}
            {snapshot ? ` ${snapshot.reviewDecision ?? snapshot.state}` : ""}
          </span>
        </span>
      ) : null}
      <span className="mt-2 flex items-center justify-between gap-2 text-muted-foreground text-xs">
        <span className="flex min-w-0 items-center gap-1.5">
          {snapshot?.checksState === "passing" ? (
            <CircleCheckIcon className="size-3.5 shrink-0 text-emerald-500" />
          ) : (
            <CircleDashedIcon className="size-3.5 shrink-0" />
          )}
          <span className="truncate">
            {snapshot?.checksState === "passing"
              ? "Checks passed"
              : snapshot?.checksState === "failing"
                ? "Checks failing"
                : snapshot?.checksState === "pending"
                  ? "Checks running"
                  : "No checks"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {isPinned ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    // The drag listeners live on the card, so this button has to
                    // keep the pointer to itself or unpinning would start a drag.
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onUnpin(thread);
                    }}
                    className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Unpin from this column"
                  />
                }
              >
                <PinIcon className="size-3.5 shrink-0" />
              </TooltipTrigger>
              <TooltipPopup side="top">
                Pinned to this column. Click to let it follow its own state again.
              </TooltipPopup>
            </Tooltip>
          ) : null}
          {updatedLabel ? <span>{updatedLabel}</span> : null}
        </span>
      </span>
      {canMerge && link !== null ? (
        <Button
          size="sm"
          variant="outline"
          type="button"
          disabled={merging}
          className="mt-3 w-full"
          // The card navigates; the button does one job and must not also leave
          // the board while the merge is in flight.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            void merge();
          }}
        >
          {merging ? "Merging…" : "Merge PR"}
        </Button>
      ) : null}
    </div>
  );
}

function CardAppearanceMark({ appearance }: { appearance: BoardAppearance }) {
  const Icon = appearance.icon == null ? null : BOARD_APPEARANCE_ICONS[appearance.icon];
  const colorClass =
    appearance.color == null
      ? "text-muted-foreground"
      : BOARD_APPEARANCE_TEXT_CLASS[appearance.color];
  if (Icon !== null) {
    return <Icon aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", colorClass)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        "mt-1.5 size-2 shrink-0 rounded-full",
        appearance.color == null
          ? "bg-muted-foreground"
          : BOARD_APPEARANCE_DOT_CLASS[appearance.color],
      )}
    />
  );
}

function ColumnAppearanceIcon({
  icon,
  color,
}: {
  icon: NonNullable<BoardAppearance["icon"]>;
  color: BoardAppearance["color"];
}) {
  const Icon = BOARD_APPEARANCE_ICONS[icon];
  return (
    <Icon
      aria-hidden
      className={cn(
        "size-3.5 shrink-0",
        color == null ? "text-muted-foreground" : BOARD_APPEARANCE_TEXT_CLASS[color],
      )}
    />
  );
}

function ThreadBoardColumnSection({
  column,
  threads,
  appearance,
  cardAppearanceFor,
  showStatus,
  onCardContextMenu,
  onColumnContextMenu,
  onUnpin,
}: {
  column: ThreadBoardColumn;
  threads: ReadonlyArray<EnvironmentThreadShell>;
  appearance: BoardAppearance | undefined;
  cardAppearanceFor: (thread: EnvironmentThreadShell) => BoardAppearance | null;
  showStatus: boolean;
  onCardContextMenu: (thread: EnvironmentThreadShell, position: { x: number; y: number }) => void;
  onColumnContextMenu: (column: ThreadBoardColumn, position: { x: number; y: number }) => void;
  onUnpin: (thread: EnvironmentThreadShell) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const lastVisitedById = useUiStateStore((state) => state.threadLastVisitedAtById);
  // The column reports the most urgent thing in it, the same way a project
  // header does in the sidebar, so a long column says something without
  // being read card by card.
  const columnStatus = useMemo(() => {
    let status: ReturnType<typeof resolveSidebarThreadStatus> | null = null;
    let unread = false;
    for (const thread of threads) {
      status = moreUrgentSidebarStatus(status, resolveSidebarThreadStatus(thread));
      unread =
        unread ||
        hasUnseenCompletion({
          ...thread,
          lastVisitedAt:
            lastVisitedById[scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))],
        });
    }
    if (status === null && !unread) return null;
    return resolveThreadStatusPresentation({
      status: status ?? "ready",
      isUnread: unread,
      isWoke: false,
    });
  }, [lastVisitedById, threads]);
  const ColumnStatusIcon = columnStatus === null ? null : THREAD_STATUS_ICONS[columnStatus.icon];

  return (
    <section
      ref={setNodeRef}
      aria-label={THREAD_BOARD_COLUMN_LABELS[column]}
      className={cn(
        "flex min-h-0 w-72 shrink-0 flex-col rounded-lg transition-colors",
        isOver && "bg-muted/50 ring-1 ring-ring",
      )}
    >
      <header
        className="flex items-center gap-2 px-1 pb-2"
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onColumnContextMenu(column, { x: event.clientX, y: event.clientY });
        }}
      >
        {appearance?.icon != null ? (
          <ColumnAppearanceIcon icon={appearance.icon} color={appearance.color ?? null} />
        ) : (
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              appearance?.color == null
                ? COLUMN_DOT_CLASS[column]
                : BOARD_APPEARANCE_DOT_CLASS[appearance.color],
            )}
          />
        )}
        <h2 className="min-w-0 flex-1 truncate font-medium text-sm">
          {THREAD_BOARD_COLUMN_LABELS[column]}
        </h2>
        {columnStatus !== null && ColumnStatusIcon !== null ? (
          <ColumnStatusIcon
            aria-hidden
            className={cn(
              "size-3.5 shrink-0",
              columnStatus.className,
              columnStatus.icon === "working" && "animate-spin",
            )}
          />
        ) : null}
        <span className="text-muted-foreground text-xs tabular-nums">{threads.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2">
        {threads.map((thread) => (
          <ThreadBoardCard
            key={scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))}
            thread={thread}
            canMerge={column === "ready"}
            appearance={cardAppearanceFor(thread)}
            showStatus={showStatus}
            onContextMenu={onCardContextMenu}
            onUnpin={onUnpin}
          />
        ))}
      </div>
    </section>
  );
}

export function ThreadBoardView() {
  const projects = useProjects();
  const threads = useThreadShells();
  const groupingSettings = useClientSettings(selectProjectGroupingSettings);
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const projectScopeKey = useUiStateStore((store) => store.sidebarProjectScopeKey);
  const setProjectScopeKey = useUiStateStore((store) => store.setSidebarProjectScopeKey);
  const navigate = useNavigate();
  useSyncSounds();
  const showThreadStatus = useClientSettings((settings) => settings.boardShowThreadStatus);
  const updateClientSettings = useUpdateClientSettings();
  const columnAppearance = useClientSettings((settings) => settings.boardColumnAppearance);
  const projectAppearance = useClientSettings((settings) => settings.boardProjectAppearance);
  const threadAppearance = useClientSettings((settings) => settings.boardThreadAppearance);

  // A card asks for its own mark first and its project's second; the lookup is
  // rebuilt only when one of those settings changes, not on every render.
  const cardAppearanceFor = useCallback(
    (thread: EnvironmentThreadShell) =>
      resolveCardAppearance({
        thread: threadAppearance[scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))],
        project: projectAppearance[`${thread.environmentId}:${thread.projectId}`],
      }),
    [projectAppearance, threadAppearance],
  );

  const projectGroups = useMemo(
    () =>
      buildSidebarProjectSnapshots({
        projects,
        settings: groupingSettings,
        primaryEnvironmentId,
        resolveEnvironmentLabel: () => null,
      }),
    [groupingSettings, primaryEnvironmentId, projects],
  );
  const spaceSections = useMemo(() => buildSidebarSpaceSections(projectGroups), [projectGroups]);
  const scopedProjectKeys = useMemo(
    () =>
      resolveScopedProjectKeys({
        scopeKey: projectScopeKey,
        groups: projectGroups,
        spaceSections,
      }),
    [projectGroups, projectScopeKey, spaceSections],
  );

  // Spaces first, then the projects themselves: picking a space narrows to
  // everything under it, which is the coarser cut a person reaches for first.
  const scopeOptions = useMemo(() => {
    const named = spaceSections.filter((section) => section.name !== null);
    return [
      ...named.map((section) => ({ key: section.key, label: section.name ?? "" })),
      ...projectGroups.map((group) => ({ key: group.projectKey, label: group.displayName })),
    ];
  }, [projectGroups, spaceSections]);
  const scopeLabel =
    projectScopeKey === null
      ? "All projects"
      : (scopeOptions.find((option) => option.key === projectScopeKey)?.label ?? "All projects");

  const scopedThreads = useMemo(
    () =>
      scopedProjectKeys === null
        ? threads
        : threads.filter((thread) =>
            scopedProjectKeys.has(`${thread.environmentId}:${thread.projectId}`),
          ),
    [scopedProjectKeys, threads],
  );

  const board = useMemo(
    () => buildThreadBoard({ threads: scopedThreads, resolveInput: threadBoardInput }),
    [scopedThreads],
  );

  // What each visible thread would announce if it reached that state now. The
  // hook compares this against the last one it saw, so nothing sounds until
  // something actually changes.
  const soundableStatuses = useMemo(() => {
    const map = new Map<string, SoundEvent | null>();
    for (const thread of scopedThreads) {
      const status = resolveSidebarThreadStatus(thread);
      map.set(
        scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
        status === "failed"
          ? "thread-failed"
          : status === "approval" || status === "input"
            ? "thread-attention"
            : status === "ready"
              ? "thread-done"
              : null,
      );
    }
    return map;
  }, [scopedThreads]);
  useThreadStatusSounds(soundableStatuses);

  // Every card's column, in order: the one thing whose change means a card has
  // to travel. Re-running the slide on any thread edit would animate typing.
  const layoutKey = useMemo(
    () =>
      THREAD_BOARD_LANES.flatMap((column) =>
        board[column].map((thread) => `${column}:${thread.environmentId}:${thread.id}`),
      ).join(" "),
    [board],
  );
  const containerRef = useFlipCards(layoutKey);

  const updateThreadMetadata = useAtomCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const unsettleThread = useAtomCommand(threadEnvironment.unsettle, { reportFailure: false });
  // A drag has to travel before it counts, or every click on a card would
  // register as a one-pixel drop onto its own column.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const setBoardColumn = useCallback(
    (thread: EnvironmentThreadShell, column: ThreadBoardColumn | null, cue?: SoundEvent) => {
      // One gesture, one cue: the caller names it so a drop does not also
      // announce itself as a pin.
      playAppSound(cue ?? (column === null ? "card-unpinned" : "card-pinned"));
      void updateThreadMetadata({
        environmentId: thread.environmentId,
        input: { threadId: thread.id, boardColumn: column },
      });
    },
    [updateThreadMetadata],
  );

  const handleUnpin = useCallback(
    (thread: EnvironmentThreadShell) => {
      setBoardColumn(thread, null);
    },
    [setBoardColumn],
  );

  const applyAppearance = useCallback(
    (
      scope: "boardColumnAppearance" | "boardThreadAppearance",
      current: Record<string, BoardAppearance>,
      key: string,
      patch: { color?: BoardAppearanceColor | null } | { icon?: BoardAppearanceIcon | null },
    ) => {
      const next = { ...current[key], ...patch };
      // An entry with nothing left in it is noise in a settings file that
      // syncs, so it goes rather than sitting there as an empty object.
      const cleaned =
        next.color == null && next.icon == null
          ? Object.fromEntries(Object.entries(current).filter(([entry]) => entry !== key))
          : { ...current, [key]: next };
      updateClientSettings({ [scope]: cleaned });
    },
    [updateClientSettings],
  );

  const handleCardContextMenu = useCallback(
    (thread: EnvironmentThreadShell, position: { x: number; y: number }) => {
      void (async () => {
        const api = readLocalApi();
        if (!api) return;
        const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
        const clicked = await settlePromise(() =>
          api.contextMenu.show(
            buildBoardCardMenuItems({
              pinnedColumn: thread.boardColumn ?? null,
              appearance: threadAppearance[key] ?? null,
              showsStatus: showThreadStatus,
              isSettled: thread.settledAt != null || thread.settledOverride === "settled",
            }),
            position,
          ),
        );
        if (clicked._tag === "Failure" || clicked.value == null) return;
        const action = parseBoardMenuId(clicked.value);
        if (action === null) return;
        switch (action.kind) {
          case "open":
            void navigate({
              to: "/$environmentId/$threadId",
              params: { environmentId: thread.environmentId, threadId: thread.id },
            });
            return;
          case "toggle-status":
            updateClientSettings({ boardShowThreadStatus: !showThreadStatus });
            return;
          case "unsettle":
            void unsettleThread({
              environmentId: thread.environmentId,
              // Only "user" is forgeable from a client; activity un-settles are
              // the server's to decide.
              input: { threadId: thread.id, reason: "user" },
            });
            return;
          case "pin":
            setBoardColumn(thread, action.column);
            return;
          case "color":
            applyAppearance("boardThreadAppearance", threadAppearance, key, {
              color: action.color,
            });
            return;
          case "icon":
            applyAppearance("boardThreadAppearance", threadAppearance, key, { icon: action.icon });
            return;
          // Renaming and deleting belong to a project, not to one of its cards.
          case "rename":
          case "delete":
            return;
        }
      })();
    },
    [
      applyAppearance,
      navigate,
      setBoardColumn,
      showThreadStatus,
      threadAppearance,
      unsettleThread,
      updateClientSettings,
    ],
  );

  const handleColumnContextMenu = useCallback(
    (column: ThreadBoardColumn, position: { x: number; y: number }) => {
      void (async () => {
        const api = readLocalApi();
        if (!api) return;
        const clicked = await settlePromise(() =>
          api.contextMenu.show(
            buildBoardColumnMenuItems({ appearance: columnAppearance[column] ?? null }),
            position,
          ),
        );
        if (clicked._tag === "Failure" || clicked.value == null) return;
        const action = parseBoardMenuId(clicked.value);
        if (action === null) return;
        if (action.kind === "color") {
          applyAppearance("boardColumnAppearance", columnAppearance, column, {
            color: action.color,
          });
          return;
        }
        if (action.kind === "icon") {
          applyAppearance("boardColumnAppearance", columnAppearance, column, { icon: action.icon });
        }
      })();
    },
    [applyAppearance, columnAppearance],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const thread = event.active.data.current?.thread as EnvironmentThreadShell | undefined;
      const over = event.over?.id;
      if (thread === undefined || typeof over !== "string") return;
      const target = THREAD_BOARD_LANES.find((column) => column === over);
      if (target === undefined) return;
      // Dropping a card back where its own state would have put it reads as
      // letting go, not as pinning it there: the override clears and the card
      // goes back to moving on its own.
      const derived = resolveThreadBoardColumn({
        ...threadBoardInput(thread),
        boardColumn: null,
      });
      const next = derived === target ? null : target;
      if ((thread.boardColumn ?? null) === next) return;
      setBoardColumn(thread, next, "card-moved");
    },
    [setBoardColumn],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3">
        <Select
          value={projectScopeKey ?? ALL_PROJECTS_VALUE}
          onValueChange={(value) => {
            if (value === null) return;
            setProjectScopeKey(value === ALL_PROJECTS_VALUE ? null : value);
          }}
        >
          <SelectTrigger size="sm" className="w-56" aria-label="Projects shown on the board">
            <SelectValue>{scopeLabel}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="start" alignItemWithTrigger={false}>
            <SelectItem hideIndicator value={ALL_PROJECTS_VALUE}>
              All projects
            </SelectItem>
            {scopeOptions.map((option) => (
              <SelectItem hideIndicator key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>
      <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
        <div ref={containerRef} className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
          {THREAD_BOARD_LANES.map((column) => (
            <ThreadBoardColumnSection
              key={column}
              column={column}
              threads={board[column]}
              appearance={columnAppearance[column]}
              cardAppearanceFor={cardAppearanceFor}
              showStatus={showThreadStatus}
              onCardContextMenu={handleCardContextMenu}
              onColumnContextMenu={handleColumnContextMenu}
              onUnpin={handleUnpin}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
