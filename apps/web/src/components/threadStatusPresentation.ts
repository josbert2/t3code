import {
  AlarmClockIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  EyeIcon,
  MessageCircleQuestionIcon,
  ShieldQuestionIcon,
  type LucideIcon,
} from "lucide-react";

import type { SidebarThreadStatus } from "./Sidebar.logic";

/**
 * How a thread's status reads wherever it surfaces. The sidebar owned this
 * shape alone until the board grew cards for the same threads; a card that
 * invented its own vocabulary would make one thread look like two.
 */
export type ThreadStatusIcon =
  | "working"
  | "monitoring"
  | "approval"
  | "input"
  | "failed"
  | "woke"
  | "done";

export interface ThreadStatusPresentation {
  readonly label: string;
  readonly icon: ThreadStatusIcon;
  readonly className: string;
}

export const THREAD_STATUS_ICONS: Record<ThreadStatusIcon, LucideIcon> = {
  working: CircleDashedIcon,
  monitoring: EyeIcon,
  approval: ShieldQuestionIcon,
  input: MessageCircleQuestionIcon,
  failed: CircleAlertIcon,
  woke: AlarmClockIcon,
  done: CircleCheckIcon,
};

/**
 * The one status worth showing, or nothing when the thread is simply at rest.
 *
 * Status hues follow the system-wide convention set by sidebar v1 and the
 * mobile Live Activity/widgets (amber approval, indigo input, sky working)
 * so a thread reads the same color everywhere it surfaces.
 */
export function resolveThreadStatusPresentation(input: {
  readonly status: SidebarThreadStatus;
  readonly isUnread: boolean;
  readonly isWoke: boolean;
}): ThreadStatusPresentation | null {
  if (input.status === "working") {
    return {
      label: "Working",
      icon: "working",
      // No shimmer: a label that animates forever is noise in a sidebar
      // full of them (and repaints every vsync on high-refresh displays).
      className: "text-sky-600 dark:text-sky-400",
    };
  }
  if (input.status === "monitoring") {
    return {
      // Monitoring is calm background presence, not active progress
      // (monitoring-pill D6), so it keeps the label at full strength.
      label: "Monitoring",
      icon: "monitoring",
      className: "text-foreground dark:text-white",
    };
  }
  if (input.status === "approval") {
    return {
      label: "Approval",
      icon: "approval",
      className: "text-amber-700 dark:text-amber-300",
    };
  }
  if (input.status === "input") {
    return {
      label: "Input",
      icon: "input",
      className: "text-indigo-600 dark:text-indigo-300",
    };
  }
  if (input.status === "failed") {
    return {
      label: "Failed",
      icon: "failed",
      className: "text-red-700 dark:text-red-300",
    };
  }
  if (input.isWoke) {
    return {
      label: "Woke",
      icon: "woke",
      className: "text-amber-700 dark:text-amber-300",
    };
  }
  if (input.isUnread) {
    return {
      label: "Done",
      icon: "done",
      className: "text-emerald-700 dark:text-emerald-300",
    };
  }
  return null;
}
