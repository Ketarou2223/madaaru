// Swipe gesture configuration — single source of truth for labels, colors, thresholds.
// To tune behavior, edit here only. SwipeCard reads these; tab components only read labels.

// Distance (px) at which a swipe commits and fires its callback.
// Below this threshold → snaps back on release.
// Tuned for a ~390px-wide screen; increase if accidental triggers occur.
export const SWIPE_COMMIT_PX = 220

// Haptic pulse duration (ms) fired once when drag first crosses SWIPE_COMMIT_PX.
// navigator.vibrate is optional-chained, so this silently no-ops on iOS / unsupported browsers.
export const SWIPE_HAPTIC_MS = 8

// --- Zone overlay strip constants ---

// Zone colors are direction-fixed (left strip = red, right strip = blue) regardless of action.
// Using CSS hex values to avoid Tailwind dynamic-class purge issues.
export const ZONE_LEFT_COLOR = "#ef4444"   // red-500
export const ZONE_RIGHT_COLOR = "#3b82f6"  // blue-500
export const ZONE_LABEL_COLOR = "#ffffff"  // white text in both zones

// Width (px) of each zone strip at rest (always visible as an affordance hint)
export const ZONE_RESTING_PX = 28

// Maximum zone width (px) when drag reaches SWIPE_COMMIT_PX
export const ZONE_MAX_PX = 120

// Zone strip opacity: resting → fully committed
export const ZONE_OPACITY_RESTING = 0.18
export const ZONE_OPACITY_ACTIVE  = 0.92

// Card body tint: max opacity of the color wash applied to the card as it's dragged
export const CARD_TINT_MAX_OPACITY = 0.48

export interface SwipeActionConfig {
  label: string        // zone large label (also used in static footer hints in tabs)
  hintLeft: string     // static bottom-hint text for left direction  (tab footers)
  hintRight: string    // static bottom-hint text for right direction (tab footers)
  // Card-body tint Tailwind classes (before / after commit threshold)
  // Kept for the current SwipeCard; will be removed when tint switches to inline style in 段1-β.
  bgClass: string
  textClass: string
  borderClass: string
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
