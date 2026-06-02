// Swipe gesture configuration — single source of truth for labels, colors, threshold.
// To tune behavior, edit here only.

export const SWIPE_THRESHOLD = 72  // px: drag distance that commits the action

export interface SwipeActionConfig {
  label: string        // badge text shown during drag
  hintLeft: string     // static bottom-hint text for left direction
  hintRight: string    // static bottom-hint text for right direction
  // Before threshold — subtle preview
  bgClass: string
  textClass: string
  borderClass: string
  // At/past threshold — "commit" emphasis
  activeBgClass: string
  activeTextClass: string
  activeBorderClass: string
}

// Per-action configs keyed by semantic purpose
export const SWIPE_ACTIONS = {
  toBuyList: {
    label: "買い物リストへ",
    hintLeft: "← 買う",
    hintRight: "",
    bgClass: "bg-amber-50",
    textClass: "text-amber-400",
    borderClass: "border-amber-300",
    activeBgClass: "bg-amber-100",
    activeTextClass: "text-amber-700",
    activeBorderClass: "border-amber-600",
  },
  toStillOk: {
    label: "まだ大丈夫",
    hintLeft: "",
    hintRight: "まだある →",
    bgClass: "bg-teal-50",
    textClass: "text-teal-400",
    borderClass: "border-teal-300",
    activeBgClass: "bg-teal-100",
    activeTextClass: "text-teal-700",
    activeBorderClass: "border-teal-500",
  },
  // 段階3-B で items.pinned_to_home_at 列と一緒に実装済み。
  sorosoro: {
    label: "そろそろ…",
    hintLeft: "← そろそろ",
    hintRight: "",
    bgClass: "bg-amber-50",
    textClass: "text-amber-400",
    borderClass: "border-amber-300",
    activeBgClass: "bg-amber-100",
    activeTextClass: "text-amber-700",
    activeBorderClass: "border-amber-600",
  },
  bought: {
    label: "買った ✓",
    hintLeft: "← 買った",
    hintRight: "",
    bgClass: "bg-teal-50",
    textClass: "text-teal-500",
    borderClass: "border-teal-400",
    activeBgClass: "bg-teal-100",
    activeTextClass: "text-teal-700",
    activeBorderClass: "border-teal-600",
  },
  deleteItem: {
    label: "削除",
    hintLeft: "",
    hintRight: "削除 →",
    bgClass: "bg-rose-50",
    textClass: "text-rose-400",
    borderClass: "border-rose-300",
    activeBgClass: "bg-rose-100",
    activeTextClass: "text-rose-600",
    activeBorderClass: "border-rose-500",
  },
} satisfies Record<string, SwipeActionConfig>
