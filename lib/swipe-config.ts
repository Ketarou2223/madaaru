// Swipe gesture configuration — single source of truth for labels, colors, thresholds.
// To tune behavior, edit here only. Tab components pass configs to SwipeCard unchanged.

// Distance (px) at which a swipe commits and fires its callback.
// Below this threshold → snaps back on release.
// Tuned for a ~390px-wide screen; increase if accidental triggers occur.
export const SWIPE_COMMIT_PX = 220

// Haptic pulse duration (ms) fired once when drag first crosses SWIPE_COMMIT_PX.
// navigator.vibrate is optional-chained — silently no-ops on iOS / unsupported browsers.
export const SWIPE_HAPTIC_MS = 8

// --- Zone overlay strip constants ---

// Zone colors are direction-fixed regardless of which action occupies that direction.
// Using CSS hex to avoid Tailwind dynamic-class purge issues.
export const ZONE_LEFT_COLOR  = "#ef4444"   // red-500  — left swipe action
export const ZONE_RIGHT_COLOR = "#3b82f6"   // blue-500 — right swipe action
export const ZONE_LABEL_COLOR = "#ffffff"

// Width (px) of each zone strip at rest (always visible as a directional affordance)
export const ZONE_RESTING_PX = 28

// Maximum zone width (px) reached when dragProgress = 1 (SWIPE_COMMIT_PX crossed)
export const ZONE_MAX_PX = 140

// Zone strip opacity bounds
export const ZONE_OPACITY_RESTING = 0.18
export const ZONE_OPACITY_ACTIVE  = 0.92

// Max opacity of the full-card color-wash tint during drag
export const CARD_TINT_MAX_OPACITY = 0.48

export interface SwipeActionConfig {
  label: string  // Text shown in the zone strip while dragging
}

export const SWIPE_ACTIONS = {
  toBuyList:  { label: "買い物リストへ" },
  toStillOk:  { label: "まだ大丈夫" },
  sorosoro:   { label: "そろそろ…" },
  bought:     { label: "買った ✓" },
  deleteItem: { label: "削除" },
} satisfies Record<string, SwipeActionConfig>
