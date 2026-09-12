/**
 * Device-side constants. The wash limit, dry-delay presets and nag interval all
 * come from the server's `settings` block, so both ends can't disagree.
 */

/** Hour of day the descale nag repeats at, while the count is over the limit. */
export const DESCALE_NAG_HOUR = 9;
