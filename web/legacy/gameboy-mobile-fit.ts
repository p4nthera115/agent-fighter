/*
 * Archived Game Boy fit logic.
 *
 * This file is documentation only. The active game always uses the landscape
 * fit path in src/game/index.ts.
 */

// Portrait handhelds used fractional zoom so the native 16:9 canvas could fit:
// const handheld = window.matchMedia('(max-width: 820px) and (orientation: portrait)').matches;
// return handheld ? raw : raw >= 1 ? Math.floor(raw) : Math.max(0.2, raw);

// The archived screen height calculation:
// screen.style.setProperty('--screen-h', `${Math.round(VIEW_W * zoom) * VIEW_H / VIEW_W}px`);

