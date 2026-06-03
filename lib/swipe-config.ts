// Swipe gesture configuration — single source of truth for thresholds, colors, physics.
// To tune behavior, edit here only.

// Distance (px) at which a swipe commits and fires its callback.
export const SWIPE_COMMIT_PX = 220

// Haptic pulse duration (ms) fired once when drag first crosses SWIPE_COMMIT_PX.
export const SWIPE_HAPTIC_MS = 8

// Card visual-follow factor: card translates at this fraction of the raw drag distance.
export const CARD_FOLLOW_FACTOR = 0.5

// Max color-wash tint opacity on the card surface during drag.
export const CARD_TINT_MAX_OPACITY = 0.48

// Max tilt angle (degrees) at full commit drag.
export const CARD_MAX_TILT_DEG = 3

// Direction-fixed zone colors (left = red, right = blue). Hex to avoid Tailwind purge.
export const ZONE_LEFT_COLOR  = "#E24B4A"
export const ZONE_RIGHT_COLOR = "#378ADD"
export const ZONE_LABEL_COLOR = "#ffffff"

// Width (px) of the edge gradient peeking from the screen edge at rest.
export const ZONE_EDGE_PEEK_PX = 24

// Opacity of the resting edge peek. Set to 0 to hide at rest.
export const ZONE_EDGE_PEEK_OPACITY = 0.22

// Width (px) of the gradient feather at the leading edge during drag.
// Makes the advancing color face look like a fog front instead of a hard wall.
export const ZONE_FRONT_FEATHER_PX = 48

// Zone must be at least this wide (px) before the action label appears.
export const ZONE_LABEL_SHOW_PX = 100

export interface SwipeActionConfig {
  label: string
}

export const SWIPE_ACTIONS = {
  toBuyList:  { label: "買い物リストへ" },
  toStillOk:  { label: "まだ大丈夫" },
  sorosoro:   { label: "そろそろ…" },
  bought:     { label: "買った ✓" },
  deleteItem: { label: "削除" },
} satisfies Record<string, SwipeActionConfig>
