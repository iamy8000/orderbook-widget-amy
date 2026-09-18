# Amy Order Book

A live orderbook widget for Hyperliquid BTC and ETH perpetuals, built in
Next.js + React + TypeScript.

**Live demo:** [https://orderbook-widget-amy.vercel.app/](https://orderbook-widget-amy.vercel.app/)

## What it does

- Connects directly to Hyperliquid's public WebSocket (`l2Book` + `trades`)
  for BTC-USD and ETH-USD, switchable via a market dropdown.
- A tick-size dropdown maps to Hyperliquid's `nSigFigs`/`mantissa`
  parameters and labels itself with the real price tick (e.g. "1", "0.1"),
  derived from the actual returned levels rather than hardcoded per symbol.
- Cumulative depth bars, a bid/ask imbalance bar, size-change flashes,
  spread (absolute + bps), last trade price with direction, and a
  connection-status indicator that reflects reconnects.
- A size-denomination toggle switches Size/Total between the base asset
  (BTC/ETH) and USD notional value.

## Architecture

- `lib/hyperliquid/socket.ts` — a single module-level WebSocket connection
  (ref-counted subscriptions, exponential backoff reconnect, exact-object
  unsubscribe) shared across the whole app, independent of React lifecycle.
- `lib/hyperliquid/useOrderbook.ts` — bridges the socket into React via
  `useSyncExternalStore`; incoming messages land in a mutable ref and a
  single `requestAnimationFrame` loop flushes at most once per frame, so
  bursts of messages coalesce into one render.
- `components/Orderbook.tsx` — the container: derives cumulative totals,
  depth-bar fractions, and per-level diffs in one pass per tick.
- `components/OrderbookRow.tsx` — memoized, primitive-only props, so a tick
  only re-renders the rows whose values actually changed.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verifying

```bash
npx tsc --noEmit
npx eslint components lib app --max-warnings=0
npm run build
```
