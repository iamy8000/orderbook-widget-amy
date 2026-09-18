"use client";

import { useMemo, useState } from "react";
import { useOrderbook } from "@/lib/hyperliquid/useOrderbook";
import type { WsBook, WsLevel } from "@/lib/hyperliquid/types";
import { OrderbookRow, ROW_WIDTH_PX } from "./OrderbookRow";

const ROWS = 12;

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
  percent: string;
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
    percent: `${((diff / mid) * 100).toFixed(2)}%`,
  };
}

const EMPTY_RAW: RawRow = { price: "", size: "", cumulative: 0, sizeChange: 0 };

function deriveRawRows(levels: WsLevel[] | undefined, prevLevels: WsLevel[] | undefined): RawRow[] {
  const rows: RawRow[] = [];
  let cumulative = 0;
  for (let i = 0; i < ROWS; i++) {
    const level = levels?.[i];
    if (!level) {
      rows.push(EMPTY_RAW);
      continue;
    }
    const size = Number(level.sz);
    cumulative += size;
    const prevSize = prevLevels?.[i] ? Number(prevLevels[i].sz) : undefined;
    const sizeChange: -1 | 0 | 1 =
      prevSize === undefined || prevSize === size ? 0 : size > prevSize ? 1 : -1;
    rows.push({ price: level.px, size: level.sz, cumulative, sizeChange });
  }
  return rows;
}

function formatTotal(n: number): string {
  if (n === 0) return "";
  return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

// Snap depthFraction to the nearest 1/ROW_WIDTH_PX step so sub-pixel float drift in the
// cumulative total doesn't register as a "changed" prop and defeat row memoization.
function roundToPixel(fraction: number): number {
  return Math.round(fraction * ROW_WIDTH_PX) / ROW_WIDTH_PX;
}

function finalizeRows(raw: RawRow[], maxCumulative: number): DerivedRow[] {
  return raw.map((row) => ({
    price: row.price,
    size: row.size,
    total: formatTotal(row.cumulative),
    depthFraction: maxCumulative > 0 ? roundToPixel(row.cumulative / maxCumulative) : 0,
    sizeChange: row.sizeChange,
  }));
}

interface OrderbookProps {
  coin: string;
  nSigFigs: 2 | 3 | 4 | 5 | null;
  mantissa?: 1 | 2 | 5;
}

export function Orderbook({ coin, nSigFigs, mantissa }: OrderbookProps) {
  const snapshot = useOrderbook(coin, nSigFigs, mantissa);

  const [lastBook, setLastBook] = useState<WsBook | null>(null);
  const [prevBook, setPrevBook] = useState<WsBook | null>(null);
  if (snapshot.book !== lastBook) {
    setPrevBook(lastBook);
    setLastBook(snapshot.book);
  }

  const { bidRows, askRows, spread } = useMemo(() => {
    const book = snapshot.book;

    const bidsRaw = deriveRawRows(book?.levels[0], prevBook?.levels[0]);
    const asksRaw = deriveRawRows(book?.levels[1], prevBook?.levels[1]);

    return {
      bidRows: finalizeRows(bidsRaw, bidsRaw[ROWS - 1].cumulative),
      askRows: finalizeRows(asksRaw, asksRaw[ROWS - 1].cumulative),
      spread: deriveSpread(bidsRaw[0].price, asksRaw[0].price),
    };
  }, [snapshot.book, prevBook]);

  const asksDisplay = useMemo(() => [...askRows].reverse(), [askRows]);

  const lastTrade = snapshot.lastTrade;

  return (
    <div className="overflow-hidden rounded-lg bg-[#0f1a1f]" style={{ width: ROW_WIDTH_PX }}>
      <div className="grid grid-cols-3 px-2 py-1.5 text-[11px] text-[#949e9c]">
        <span className="text-left">Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>
      <div>
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
      {lastTrade && (
        <div className="grid grid-cols-3 items-center px-2 py-1 text-xs text-zinc-500 [font-variant-numeric:tabular-nums]">
          <span className="text-left">Last</span>
          <span className={`col-span-2 text-right ${lastTrade.side === "B" ? "text-[#1fa67d]" : "text-[#ED7088]"}`}>
            {lastTrade.px} {lastTrade.side === "B" ? "▲" : "▼"}
          </span>
        </div>
      )}
      <div className="grid grid-cols-3 items-center bg-white/5 px-2 py-1.5 text-xs text-zinc-500 [font-variant-numeric:tabular-nums]">
        <span className="text-left">Spread</span>
        <span className="text-right text-zinc-300">{spread?.absolute ?? ""}</span>
        <span className="text-right">{spread?.percent ?? ""}</span>
      </div>
      <div>
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
    </div>
  );
}
