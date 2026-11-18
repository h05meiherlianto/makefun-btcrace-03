// Deep-dip bot for the cbBTC 24h race (agent-fun/bars-replay/v1, long only).
//
// The dev window drifts down about 2.8% over 24 hours, but with a +2.4%
// recovery in the middle hours — and a full-size round trip costs ~26 bps in
// fees, slippage and impact, far more than 1-minute noise. So the bot trades
// at most once, buying a genuine dip and riding the recovery:
//
//   - Entry, decided on a bar's close (filled at the next bar's open): the
//     close falls 180 bps under the window's first close, or, if no such dip
//     ever comes, at scored bar 720 (halfway). One position, the whole cash.
//     No entry after bar 1320: a trade opened in the last two hours has no
//     time to develop before the window's forced flattening.
//   - Exit, the whole position: the close rises 200 bps above the entry
//     (take the profit), or falls 200 bps under the highest close since
//     entry (trailing stop), or falls 250 bps under the entry itself (hard
//     stop: caps the loss even on a sharp gap down where the trailing stop
//     would lag), or is still open at bar 1380 (time exit: close under the
//     bot's own slippage cap instead of being flattened by the harness).
//   - After an exit the bot is done: it never re-enters, so a choppy window
//     cannot bleed it through repeated whipsaws.
//
// Orders cap their slippage at 100 bps past the close they were decided on.
// All math is float64 on + - * / alone, each correctly rounded (IEEE 754),
// and nothing reads the clock, the environment or Math.random, so the same
// bars give the same orders, run after run.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Entry: the close must fall this far under the window's first close, in bps. */
const DIP_BPS = 180;
/** Entry fallback: buy at this scored bar if no dip has come yet. */
const FALLBACK_BAR = 720;
/** Exit: take profit this far above the entry, in bps. */
const TAKE_BPS = 200;
/** Exit: trailing stop this far under the highest close since entry, in bps. */
const TRAIL_BPS = 200;
/** Exit: hard stop this far under the entry close, in bps. */
const HARD_STOP_BPS = 250;
/** No new entry once this many scored bars have passed (the window is 1,440). */
const NO_ENTRY_AFTER = 1320;
/** Exit: if still holding at this scored bar, close the position. */
const TIME_EXIT_BAR = 1380;
/** Slippage cap on every order, in bps past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** The window's first close (0 until the first bar arrives). */
let firstClose = 0;
/** The entry close of the current (only) position, 0 when flat. */
let entryClose = 0;
/** Highest close since the position was opened, 0 when flat. */
let peakClose = 0;
/** Whether the one entry has been used. */
let usedEntry = false;

await runBars({
  onBatch(state: BarsState) {
    if (state.warmingUp) return [];
    const closeRaw = state.close(SYMBOL);
    if (closeRaw === null) return [];
    const close = Number(closeRaw);
    const bar = state.seq;
    if (firstClose === 0) firstClose = close;
    if (bar < 5) return [];
    const holding = state.positions.get(SYMBOL);
    if (holding !== undefined) {
      if (close > peakClose) peakClose = close;
      const takeProfit = close >= entryClose * (1 + TAKE_BPS / 10000);
      const underTrail = peakClose > 0 && close <= peakClose * (1 - TRAIL_BPS / 10000);
      // Hard stop: caps the loss at ~2.5% + fees even on a sharp gap down,
      // where the trailing stop would lag because the peak is stale.
      const hardStop = close <= entryClose * (1 - HARD_STOP_BPS / 10000);
      // Time exit: close under the bot's own slippage cap instead of being
      // flattened by the harness at the window's end.
      const timeExit = bar >= TIME_EXIT_BAR;
      if (takeProfit || underTrail || hardStop || timeExit) {
        entryClose = 0;
        peakClose = 0;
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: holding.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }
    // Flat: the single entry — a deep dip under the window open, or the
    // halfway fallback, and never in the last two hours.
    if (usedEntry || bar > NO_ENTRY_AFTER) return [];
    const deepDip = close <= firstClose * (1 - DIP_BPS / 10000);
    const fallback = bar >= FALLBACK_BAR;
    if (deepDip || fallback) {
      const cash = state.cash;
      if (cash >= BigInt(state.hello.fees.min_notional_quote_units)) {
        usedEntry = true;
        entryClose = close;
        peakClose = close;
        const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [buy];
      }
    }
    return [];
  },
});
