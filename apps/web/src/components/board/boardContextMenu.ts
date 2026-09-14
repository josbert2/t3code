import type { ContextMenuItem } from "@t3tools/contracts";
import type {
  BoardAppearance,
  BoardAppearanceColor,
  BoardAppearanceIcon,
} from "@t3tools/contracts/settings";
import {
  THREAD_BOARD_COLUMNS,
  type ThreadBoardColumn,
} from "@t3tools/client-runtime/state/thread-board";

import { THREAD_BOARD_COLUMN_LABELS } from "../../threadBoardModel";
import { BOARD_APPEARANCE_COLORS, BOARD_APPEARANCE_ICON_NAMES } from "./boardAppearance";

/**
 * Menu ids, parsed back into intent rather than compared as loose strings.
 * The native menu hands back only an id, so this is the whole vocabulary the
 * board and its menu agree on.
 */
export type BoardMenuId =
  | "open"
  | "rename"
  | "delete"
  | "unsettle"
  | "status:toggle"
  | `pin:${ThreadBoardColumn}`
  | "pin:clear"
  | `color:${BoardAppearanceColor}`
  | "color:clear"
  | `icon:${BoardAppearanceIcon}`
  | "icon:clear";

export type BoardMenuAction =
  | { readonly kind: "open" }
  | { readonly kind: "rename" }
  | { readonly kind: "delete" }
  | { readonly kind: "unsettle" }
  | { readonly kind: "toggle-status" }
  | { readonly kind: "pin"; readonly column: ThreadBoardColumn | null }
  | { readonly kind: "color"; readonly color: BoardAppearanceColor | null }
  | { readonly kind: "icon"; readonly icon: BoardAppearanceIcon | null };

const COLOR_LABELS: Record<BoardAppearanceColor, string> = {
  sky: "Sky",
  orange: "Orange",
  amber: "Amber",
  emerald: "Emerald",
  rose: "Rose",
  violet: "Violet",
  slate: "Slate",
};

const ICON_LABELS: Record<BoardAppearanceIcon, string> = {
  circle: "Circle",
  star: "Star",
  flag: "Flag",
  bug: "Bug",
  rocket: "Rocket",
  flame: "Flame",
  leaf: "Leaf",
  bookmark: "Bookmark",
};

/** A tick in the label: native menus here carry no checkmark of their own. */
const mark = (selected: boolean, label: string) => (selected ? `✓ ${label}` : label);

function appearanceItems(
  appearance: BoardAppearance | null,
): ReadonlyArray<ContextMenuItem<string>> {
  return [
    {
      id: "color",
      label: "Color",
      separatorBefore: true,
      children: [
        { id: "color:clear", label: mark(appearance?.color == null, "None") },
        ...BOARD_APPEARANCE_COLORS.map((color) => ({
          id: `color:${color}`,
          label: mark(appearance?.color === color, COLOR_LABELS[color]),
          ...(color === BOARD_APPEARANCE_COLORS[0] ? { separatorBefore: true } : {}),
        })),
      ],
    },
    {
      id: "icon",
      label: "Icon",
      children: [
        { id: "icon:clear", label: mark(appearance?.icon == null, "None") },
        ...BOARD_APPEARANCE_ICON_NAMES.map((icon) => ({
          id: `icon:${icon}`,
          label: mark(appearance?.icon === icon, ICON_LABELS[icon]),
          ...(icon === BOARD_APPEARANCE_ICON_NAMES[0] ? { separatorBefore: true } : {}),
        })),
      ],
    },
  ];
}

export function buildBoardCardMenuItems(input: {
  readonly pinnedColumn: ThreadBoardColumn | null;
  readonly appearance: BoardAppearance | null;
  readonly showsStatus: boolean;
  readonly isSettled: boolean;
}): ReadonlyArray<ContextMenuItem<string>> {
  return [
    { id: "open", label: "Open thread" },
    // Settling is what drops a card into Archive, so the board owes it a way
    // back out rather than making a person go find the thread in the sidebar.
    ...(input.isSettled
      ? [{ id: "unsettle", label: "Remove from settled" } satisfies ContextMenuItem<string>]
      : []),
    {
      id: "pin",
      label: "Pin to column",
      separatorBefore: true,
      children: [
        ...THREAD_BOARD_COLUMNS.map((column) => ({
          id: `pin:${column}`,
          label: mark(input.pinnedColumn === column, THREAD_BOARD_COLUMN_LABELS[column]),
        })),
        {
          id: "pin:clear",
          label: "Let it follow its own state",
          separatorBefore: true,
          disabled: input.pinnedColumn === null,
        },
      ],
    },
    ...appearanceItems(input.appearance),
    {
      id: "status:toggle",
      label: input.showsStatus ? "✓ Show status on cards" : "Show status on cards",
      separatorBefore: true,
    },
  ];
}

export function buildBoardColumnMenuItems(input: {
  readonly appearance: BoardAppearance | null;
}): ReadonlyArray<ContextMenuItem<string>> {
  // The first group's separator would draw a rule above the very first item.
  return appearanceItems(input.appearance).map((item, index) =>
    index === 0 ? { ...item, separatorBefore: false } : item,
  );
}

/**
 * A project run carries a name of its own, so its menu leads with renaming and
 * then offers the same marks a column or a card can wear.
 */
export function buildProjectGroupMenuItems(input: {
  readonly appearance: BoardAppearance | null;
}): ReadonlyArray<ContextMenuItem<string>> {
  return [
    { id: "rename", label: "Rename project" },
    ...appearanceItems(input.appearance),
    { id: "delete", label: "Delete project", destructive: true, separatorBefore: true },
  ];
}

export function parseBoardMenuId(id: string): BoardMenuAction | null {
  if (id === "open") return { kind: "open" };
  if (id === "rename") return { kind: "rename" };
  if (id === "delete") return { kind: "delete" };
  if (id === "unsettle") return { kind: "unsettle" };
  if (id === "status:toggle") return { kind: "toggle-status" };
  if (id === "pin:clear") return { kind: "pin", column: null };
  if (id === "color:clear") return { kind: "color", color: null };
  if (id === "icon:clear") return { kind: "icon", icon: null };

  const pinned = THREAD_BOARD_COLUMNS.find((column) => id === `pin:${column}`);
  if (pinned !== undefined) return { kind: "pin", column: pinned };

  const colored = BOARD_APPEARANCE_COLORS.find((color) => id === `color:${color}`);
  if (colored !== undefined) return { kind: "color", color: colored };

  const iconed = BOARD_APPEARANCE_ICON_NAMES.find((icon) => id === `icon:${icon}`);
  if (iconed !== undefined) return { kind: "icon", icon: iconed };

  // Submenu parents ("color", "icon", "pin") come back when a menu closes on
  // them; they carry no action of their own.
  return null;
}
