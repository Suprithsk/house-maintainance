/**
 * Milk and curd are sold in fixed 0.5 L packets and priced per packet, so
 * quantities are entered in litres and billed in packet multiples.
 * The backend validates the same step (see ../house-maintainance-be milk routes).
 */
export const PACKET_SIZE = 0.5;

/** What a new day starts at — one packet of each. */
export const DEFAULT_QUANTITY = 0.5;

/**
 * The only amounts selectable — there is no free-text box. 0 is how a day with
 * milk but no curd gets recorded; 3 L is the most that ever arrives.
 */
export const QUANTITY_PRESETS = [0, 0.5, 1, 1.5, 2, 2.5, 3];
