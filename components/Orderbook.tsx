"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrderbook, useConnectionStatus } from "@/lib/hyperliquid/useOrderbook";
import type { WsBook, WsLevel } from "@/lib/hyperliquid/types";
import { OrderbookRow, ROW_WIDTH_PX } from "./OrderbookRow";
import { MarketControls, UnitToggle, type Coin, type Unit, type TickOption } from "./Controls";

const ROWS = 12;

const TICK_MULTIPLIERS = [1, 2, 5, 10, 100, 1000] as const;

interface TickSetting {
  nSigFigs: 2 | 3 | 4 | 5;
  mantissa?: 1 | 2 | 5;
}

function tickSettingFor(multiplier: number): TickSetting {
  switch (multiplier) {
    case 2:
      return { nSigFigs: 5, mantissa: 2 };
    case 5:
      return { nSigFigs: 5, mantissa: 5 };
    case 10:
      return { nSigFigs: 4 };
    case 100:
      return { nSigFigs: 3 };
    case 1000:
      return { nSigFigs: 2 };
    default:
      return { nSigFigs: 5 };
  }
}

function formatTick(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function estimateTick(multiplier: number, referencePrice: number): number {
  const integerDigits = Math.floor(Math.log10(referencePrice)) + 1;
  return Math.pow(10, integerDigits - 5) * multiplier;
}

function gcdInt(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

// Every returned price (bid or ask) sits on the same aggregation grid, so its
// distance from any fixed anchor price is an exact multiple of the true tick.
// GCD across all of them (both sides combined, for more samples) recovers
// that tick regardless of which individual slots happen to be occupied.
function deriveActiveTick(...rowGroups: RawRow[][]): number {
  const prices = rowGroups.flatMap((rows) => rows.map((r) => r.price).filter(Boolean));
  if (prices.length < 2) return NaN;
  const scale = Math.pow(10, Math.max(...prices.map(decimalsOf)));
  const scaled = prices.map((p) => Math.round(Number(p) * scale));
  const anchor = scaled[0];
  let g = 0;
  for (let i = 1; i < scaled.length; i++) {
    const diff = Math.abs(scaled[i] - anchor);
    if (diff > 0) g = gcdInt(g, diff);
  }
  return g > 0 ? g / scale : NaN;
}

interface RawRow {
  price: string;
  size: string;
  cumulative: number;
  sizeChange: -1 | 0 | 1;
}

interface DerivedRow {
  price: string;
  size: string;
  total: string;
  depthFraction: number;
  sizeChange: -1 | 0 | 1;
}

interface SpreadInfo {
  absolute: string;
  bps: string;
}

function decimalsOf(px: string): number {
  const dot = px.indexOf(".");
  return dot === -1 ? 0 : px.length - dot - 1;
}

function deriveSpread(bestBid: string, bestAsk: string): SpreadInfo | null {
  if (!bestBid || !bestAsk) return null;
  const bidNum = Number(bestBid);
  const askNum = Number(bestAsk);
  const diff = askNum - bidNum;
  const mid = (askNum + bidNum) / 2;
  return {
    absolute: diff.toFixed(decimalsOf(bestAsk)),
    bps: `${((diff / mid) * 10000).toFixed(2)} bps`,
  };
}

const EMPTY_RAW: RawRow = { price: "", size: "", cumulative: 0, sizeChange: 0 };

interface DeriveResult {
  rows: RawRow[];
  maxCumulative: number;
}

function deriveRawRows(
  levels: WsLevel[] | undefined,
  prevLevels: WsLevel[] | undefined,
  unit: Unit
): DeriveResult {
  const prevByPrice = new Map<string, number>();
  if (prevLevels) {
    for (const level of prevLevels) prevByPrice.set(level.px, Number(level.sz));
  }

  const rows: RawRow[] = [];
  let cumulative = 0;
  for (let i = 0; i < ROWS; i++) {
    const level = levels?.[i];
    if (!level) {
      rows.push(EMPTY_RAW);
      continue;
    }
    const size = Number(level.sz);
    const displayAmount = unit === "usdc" ? size * Number(level.px) : size;
    cumulative += displayAmount;
    const prevSize = prevByPrice.get(level.px);
    const sizeChange: -1 | 0 | 1 =
      prevSize === undefined || prevSize === size ? 0 : size > prevSize ? 1 : -1;
    rows.push({
      price: level.px,
      size: unit === "usdc" ? formatUsd(displayAmount) : level.sz,
      cumulative,
      sizeChange,
    });
  }
  return { rows, maxCumulative: cumulative };
}

function formatTotal(n: number): string {
  if (n === 0) return "";
  return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function formatUsd(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Snap depthFraction to the nearest 1/ROW_WIDTH_PX step so sub-pixel float drift in the
// cumulative total doesn't register as a "changed" prop and defeat row memoization.
function roundToPixel(fraction: number): number {
  return Math.round(fraction * ROW_WIDTH_PX) / ROW_WIDTH_PX;
}

function finalizeRows(raw: RawRow[], maxCumulative: number, unit: Unit): DerivedRow[] {
  const formatter = unit === "usdc" ? formatUsd : formatTotal;
  return raw.map((row) => ({
    price: row.price,
    size: row.size,
    total: formatter(row.cumulative),
    depthFraction: maxCumulative > 0 ? roundToPixel(row.cumulative / maxCumulative) : 0,
    sizeChange: row.sizeChange,
  }));
}

export function Orderbook() {
  const [coin, setCoin] = useState<Coin>("BTC");
  const [tickMultiplier, setTickMultiplier] = useState<number>(1);
  const [unit, setUnit] = useState<Unit>("base");
  const tickSetting = tickSettingFor(tickMultiplier);

  const snapshot = useOrderbook(coin, tickSetting.nSigFigs, tickSetting.mantissa);

  const [lastBook, setLastBook] = useState<WsBook | null>(null);
  const [prevBook, setPrevBook] = useState<WsBook | null>(null);
  if (snapshot.book !== lastBook) {
    setPrevBook(lastBook);
    setLastBook(snapshot.book);
  }

  const { bidRows, askRows, spread, tickOptions, bidImbalance } = useMemo(() => {
    const book = snapshot.book;

    const bidsRaw = deriveRawRows(book?.levels[0], prevBook?.levels[0], unit);
    const asksRaw = deriveRawRows(book?.levels[1], prevBook?.levels[1], unit);

    const bestBid = bidsRaw.rows[0].price;
    const bestAsk = asksRaw.rows[0].price;
    const referencePrice = bestBid ? Number(bestBid) : bestAsk ? Number(bestAsk) : NaN;

    const activeTick = deriveActiveTick(bidsRaw.rows, asksRaw.rows);

    const tickOptions: TickOption[] = TICK_MULTIPLIERS.map((multiplier) => {
      const tick =
        multiplier === tickMultiplier && Number.isFinite(activeTick)
          ? activeTick
          : Number.isFinite(referencePrice)
            ? estimateTick(multiplier, referencePrice)
            : NaN;
      return { multiplier, label: formatTick(tick) || String(multiplier) };
    });

    const totalDepth = bidsRaw.maxCumulative + asksRaw.maxCumulative;
    // Round to the nearest 0.5% so sub-visual noise doesn't jitter the bar.
    const bidImbalance = totalDepth > 0 ? Math.round((bidsRaw.maxCumulative / totalDepth) * 200) / 200 : 0.5;

    return {
      bidRows: finalizeRows(bidsRaw.rows, bidsRaw.maxCumulative, unit),
      askRows: finalizeRows(asksRaw.rows, asksRaw.maxCumulative, unit),
      spread: deriveSpread(bestBid, bestAsk),
      tickOptions,
      bidImbalance,
    };
  }, [snapshot.book, prevBook, tickMultiplier, unit]);

  const asksDisplay = useMemo(() => [...askRows].reverse(), [askRows]);

  const lastTrade = snapshot.lastTrade;
  const isLoading = snapshot.book === null;
  const unitLabel = unit === "usdc" ? "USD" : coin;
  const connectionStatus = useConnectionStatus();

  useEffect(() => {
    document.title = lastTrade ? `${lastTrade.px} | ${coin} | Amy Order Book` : `${coin} | Amy Order Book`;
  }, [lastTrade, coin]);

  return (
    <div className="overflow-hidden rounded-lg bg-[#0f1a1f]" style={{ width: ROW_WIDTH_PX }}>
      <div className="flex items-center justify-between px-2 py-1 text-sm font-medium text-zinc-200">
        <span>Order Book</span>
        <span className="flex items-center gap-1.5 text-[11px] font-normal text-zinc-500">
          <span
            className={`h-1.5 w-1.5 rounded-full ${connectionStatus === "open" ? "bg-[#1fa67d]" : "bg-[#ED7088]"}`}
          />
          {connectionStatus === "open" ? "Live" : connectionStatus === "connecting" ? "Connecting…" : "Reconnecting…"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-2 py-1.5 text-xs text-[#949e9c]">
        <MarketControls
          coin={coin}
          onCoinChange={setCoin}
          tickOptions={tickOptions}
          tickMultiplier={tickMultiplier}
          onTickChange={setTickMultiplier}
        />
        <UnitToggle coin={coin} unit={unit} onUnitChange={setUnit} />
      </div>
      <div className="grid grid-cols-3 px-2 py-1.5 text-[11px] text-[#949e9c]">
        <span className="text-left">Price</span>
        <span className="text-right">Size ({unitLabel})</span>
        <span className="text-right">Total ({unitLabel})</span>
      </div>
      {isLoading ? (
        <SkeletonRows />
      ) : (
        <div className="flex flex-col gap-px">
          {asksDisplay.map((row, i) => (
            <OrderbookRow
              key={i}
              side="ask"
              price={row.price}
              size={row.size}
              total={row.total}
              depthFraction={row.depthFraction}
              sizeChange={row.sizeChange}
            />
          ))}
        </div>
      )}
      <div className="flex h-1 w-full">
        <div
          className="bg-[#1fa67d] transition-[width] duration-300 ease-out"
          style={{ width: `${bidImbalance * 100}%` }}
        />
        <div
          className="bg-[#ED7088] transition-[width] duration-300 ease-out"
          style={{ width: `${(1 - bidImbalance) * 100}%` }}
        />
      </div>
      <div className="bg-white/5 px-2 py-0.5 text-xs text-zinc-500 [font-variant-numeric:tabular-nums]">
        {lastTrade && (
          <div className="grid h-4 grid-cols-3 items-center">
            <span className="text-left">Last price</span>
            <span className={`col-span-2 text-right ${lastTrade.side === "B" ? "text-[#1fa67d]" : "text-[#ED7088]"}`}>
              {lastTrade.px} {lastTrade.side === "B" ? "▲" : "▼"}
            </span>
          </div>
        )}
        <div className="grid h-4 grid-cols-3 items-center">
          <span className="text-left">Spread</span>
          <span className="text-right text-zinc-300">{spread?.absolute ?? ""}</span>
          <span className="text-right">{spread?.bps ?? ""}</span>
        </div>
      </div>
      {isLoading ? (
        <SkeletonRows />
      ) : (
        <div className="flex flex-col gap-px">
          {bidRows.map((row, i) => (
            <OrderbookRow
              key={i}
              side="bid"
              price={row.price}
              size={row.size}
              total={row.total}
              depthFraction={row.depthFraction}
              sizeChange={row.sizeChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-px">
      {Array.from({ length: ROWS }, (_, i) => (
        <div key={i} className="flex h-[22px] items-center px-2">
          <div className="h-3 w-full animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}
