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

  const { bidRows, askRows } = useMemo(() => {
    const book = snapshot.book;

    const bidsRaw = deriveRawRows(book?.levels[0], prevBook?.levels[0]);
    const asksRaw = deriveRawRows(book?.levels[1], prevBook?.levels[1]);

    return {
      bidRows: finalizeRows(bidsRaw, bidsRaw[ROWS - 1].cumulative),
      askRows: finalizeRows(asksRaw, asksRaw[ROWS - 1].cumulative),
    };
  }, [snapshot.book, prevBook]);

  const asksDisplay = useMemo(() => [...askRows].reverse(), [askRows]);

  return (
    <div className="w-fit">
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
