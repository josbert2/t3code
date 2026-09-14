import type {
  BoardAppearance,
  BoardAppearanceColor,
  BoardAppearanceIcon,
} from "@t3tools/contracts/settings";
import {
  BookmarkIcon,
  BugIcon,
  CircleIcon,
  FlagIcon,
  FlameIcon,
  LeafIcon,
  RocketIcon,
  StarIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Every class is written out in full. Tailwind reads these files as text, so a
 * class built by joining a color name to a prefix would never be generated.
 */
export const BOARD_APPEARANCE_DOT_CLASS: Record<BoardAppearanceColor, string> = {
  sky: "bg-sky-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  slate: "bg-slate-500",
};

export const BOARD_APPEARANCE_TEXT_CLASS: Record<BoardAppearanceColor, string> = {
  sky: "text-sky-600 dark:text-sky-400",
  orange: "text-orange-600 dark:text-orange-400",
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
  violet: "text-violet-600 dark:text-violet-400",
  slate: "text-slate-600 dark:text-slate-400",
};

export const BOARD_APPEARANCE_ICONS: Record<BoardAppearanceIcon, LucideIcon> = {
  circle: CircleIcon,
  star: StarIcon,
  flag: FlagIcon,
  bug: BugIcon,
  rocket: RocketIcon,
  flame: FlameIcon,
  leaf: LeafIcon,
  bookmark: BookmarkIcon,
};

/** Ordered for pickers, so the menu never depends on object key order. */
export const BOARD_APPEARANCE_COLORS: ReadonlyArray<BoardAppearanceColor> = [
  "sky",
  "orange",
  "amber",
  "emerald",
  "rose",
  "violet",
  "slate",
];

export const BOARD_APPEARANCE_ICON_NAMES: ReadonlyArray<BoardAppearanceIcon> = [
  "circle",
  "star",
  "flag",
  "bug",
  "rocket",
  "flame",
  "leaf",
  "bookmark",
];

/**
 * What a card ends up wearing. A mark put on one thread speaks for that thread
 * alone, so it wins over the one its project carries; each half resolves on its
 * own, letting a card borrow its project's color while keeping its own icon.
 */
export function resolveCardAppearance(input: {
  readonly thread: BoardAppearance | undefined;
  readonly project: BoardAppearance | undefined;
}): BoardAppearance | null {
  const color = input.thread?.color ?? input.project?.color ?? null;
  const icon = input.thread?.icon ?? input.project?.icon ?? null;
  return color === null && icon === null ? null : { color, icon };
}
