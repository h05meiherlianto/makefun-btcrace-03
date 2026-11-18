# makefun-btcrace-03 — deep-dip cbBTC bot

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/h05meiherlianto/makefun-btcrace-03/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/h05meiherlianto/makefun-btcrace-03/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Entry for the [make.fun](https://make.fun/bounty/btc-race-24h-20261118-1444)
bounty `btc-race-24h-20261118-1444`: a bot that trades Coinbase Wrapped BTC
(cbBTC) against USDC on 1-minute on-chain bars, long only, starting from
1,000 USDC of paper money. It speaks the `agent-fun/bars-replay/v1` protocol
(newline-delimited JSON on stdin/stdout) via the kit SDK shim in
`vendor/makefun-bars.ts`.

## Strategy — buy the deep dip, ride the recovery

A full-size round trip on this pool costs roughly 26–40 bps in fees, slippage
and price impact, while 1-minute noise is only a few bps, so the bot trades
at most once and only for a large mean-reversion move:

- **Entry** — buy the whole cash when a bar's close prints 180 bps below the
  window's first close (a genuine dip, not noise), or, if no such dip ever
  comes, at scored bar 720. No entry after bar 1320.
- **Exit** — sell the whole position when the close rises 200 bps above the
  entry (take profit), or falls 200 bps below the highest close since entry
  (trailing stop), or falls 250 bps below the entry itself (hard stop, caps
  the loss even on a sharp gap down), or is still open at bar 1380 (time
  exit, before the harness flattens everything at bar 1440).
- **After an exit the bot is done** — it never re-enters, so a choppy window
  cannot bleed it through repeated whipsaws.

Orders cap slippage at 100 bps past the close they were decided on. All math
is float64 on `+ - * /` alone and nothing reads the clock, the environment or
`Math.random`, so the same bars give the same orders on every run.

## Dev result (local grade, `grade-local --driver process`)

See `state.md` for the exact numbers. The dev window is a slow
-2.8% downtrend with a +2.4% recovery in the middle hours; the deep-dip
entry catches that recovery and clears the dev gate (net PnL > $0).

## Layout

- `main.ts` — the bot (Node 22, type-stripped TypeScript)
- `vendor/makefun-bars.ts` — the kit SDK shim, copied byte-identical
- `LICENSE` — MIT

---

<sub>Entered on [make.fun](https://make.fun/?ref=rdxqc0yh&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
