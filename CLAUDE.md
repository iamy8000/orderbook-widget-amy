@AGENTS.md
# Orderbook Widget — Build Rules

## What this is
A take-home for a frontend role. Build a live orderbook widget for Hyperliquid
perps (BTC + ETH) in Next.js + React + TypeScript.

Graded on: liveness, smoothness, readability, information density, and the
absence of excessive re-renders. The brief explicitly warns against AI-generated
bloat. Small and sharp beats large and feature-rich.

Time budget: ~2 hours. Prefer the simple correct thing over the general thing.

## Dependencies
Allowed: next, react, react-dom, typescript, tailwindcss.
Anything else — charting libs, state libs, ws wrappers, animation libs, date
libs, icon packs — ASK FIRST. The answer is almost always no. Native WebSocket,
CSS transitions, and useSyncExternalStore cover everything here.

## The feed (verified — do not guess these)

Endpoint: `wss://api.hyperliquid.xyz/ws`

Subscribe:
{"method":"subscribe","subscription":{"type":"l2Book","coin":"BTC","nSigFigs":5}}

Unsubscribe: same shape, `"method":"unsubscribe"`, with the subscription object
matching the original EXACTLY (same keys, same values) or the server ignores it.

Message:
{"channel":"l2Book","data":{"coin":"BTC","time":1700000000000,
  "levels":[[{"px":"105533","sz":"0.00151","n":3}, ...],[ ...asks... ]]}}

levels[0] = bids, descending. levels[1] = asks, ascending. px/sz are STRINGS.

Critical properties:
- Every message is a COMPLETE SNAPSHOT, not a diff. Replace state wholesale.
  No merging, no sequence numbers, no reconciliation, no REST bootstrap.
- Cadence is throttled: pushed per block, at most once per ~0.5s. Smoothness
  CANNOT come from the feed. It comes from CSS transitions and decaying
  highlights. Design for ~2 updates/sec.
- `nSigFigs`: 2 | 3 | 4 | 5 | null (null = full precision).
- `mantissa`: 1 | 2 | 5, allowed ONLY when nSigFigs is 5.
- Optional `fast: true` gives 5 levels instead of 20. Default (slow) is fine.
- Send {"method":"ping"} every 30s or the connection is dropped when idle.
- Also subscribe to {"type":"trades","coin":X} for last-price + direction.

## Architecture — non-negotiable

1. ONE module-level WebSocket client, outside React. Not a socket per
   component, not a socket in useEffect. Exposes subscribe(key, cb) returning
   an unsubscribe fn. Ref-count subscribers so StrictMode's double-mount does
   not tear down the live connection.

2. Incoming messages land in a MUTABLE REF. A single requestAnimationFrame
   loop publishes the latest snapshot to React. Three messages in one frame =
   one render. Wire it up with useSyncExternalStore.

3. Render a FIXED number of rows per side (12). Rows are keyed by SLOT INDEX,
   never by price. Prices scroll through fixed slots. Keying by price remounts
   the list every tick and destroys both perf and CSS transitions.

4. Row components are memo()'d and accept ONLY primitives (string | number |
   boolean). No object or array props — memo becomes a no-op otherwise.

5. Cumulative totals, max-cumulative for bar scaling, and the per-level diff
   against the previous snapshot are computed in ONE pass in a useMemo, in the
   container. Never per row.

6. Depth bars animate with `transform: scaleX()` + transform-origin, never
   animated width/left. Flashes are a CSS class with a ~500ms decay animation,
   not a JS timer per row.

7. All numeric cells use `font-variant-numeric: tabular-nums` and fixed-width
   columns. Horizontally shifting digits are the #1 cause of visual jank.

8. On symbol or precision change: unsubscribe, CLEAR the book, show a skeleton,
   subscribe. Never render a stale side against a fresh one.

9. Reconnect with exponential backoff + jitter, capped ~10s. Resubscribe to
   current selections on reopen.

## UI spec

Dark charcoal background (near #131314), panel slightly lighter. Asks muted red,
bids muted green; depth bars are the same hue at low opacity, extending from the
outer edge inward. Monospace numerics, small type, tight row height (~22px).

Layout top to bottom: symbol header → Orders/Trades tabs → column headers
(Price / Size / Total) → asks (reversed, best ask nearest the spread) → spread
row (absolute + %) → bids → footer with tick-size selector and size-unit toggle.

The precision dropdown shows TICK SIZES (e.g. "0.1", "1", "10"), not raw
nSigFigs values. Traders think in ticks. Derive the label from the actual
returned levels so it stays correct across symbols and magnitudes.

Feedback layer, in priority order if time runs short:
1. Size-change flash per level (brighten on increase, dim on decrease)
2. Cumulative depth bars
3. Spread row with absolute + percentage
4. Last trade price with direction arrow
5. Connection status + staleness (Date.now() - data.time)
6. Hover row → cumulative notional to fill to that level
7. Bid/ask imbalance bar

## File layout
app/page.tsx
lib/hyperliquid/socket.ts      — connection, ping, backoff, ref-counted subs
lib/hyperliquid/types.ts       — WsBook, WsLevel, WsTrade
lib/hyperliquid/useOrderbook.ts— useSyncExternalStore + rAF flush
components/Orderbook.tsx       — container, single-pass derivation
components/OrderbookRow.tsx    — memo'd, primitives only
components/Controls.tsx        — symbol + tick dropdowns

That is the whole app. Do not add a provider layer, a generic event bus, a
reducer, a config module, or an abstraction over WebSocket "in case we add
more exchanges." There is one exchange.

## Anti-bloat rules
- No file exists unless something imports it.
- No comment restates what the code says.
- No try/catch that only rethrows. No defensive checks for states that cannot
  occur given snapshot semantics.
- No `any`. No `as` casts except at the raw JSON boundary, parsed once.
- No README section describing features that do not exist.

## Definition of done
`npm run build` and `npx tsc --noEmit` both clean.
Switching symbol and tick size works without visual artifacts.
Killing wifi shows a disconnected state and recovers on reconnect.
React Profiler: a tick re-renders only the rows whose values changed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
