"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { subscribeBook, subscribeTrades } from "./socket";
import type { WsBook, WsTrade } from "./types";

export interface OrderbookSnapshot {
  book: WsBook | null;
  lastTrade: WsTrade | null;
}

const EMPTY_SNAPSHOT: OrderbookSnapshot = { book: null, lastTrade: null };

export function useOrderbook(
  coin: string,
  nSigFigs: 2 | 3 | 4 | 5 | null,
  mantissa?: 1 | 2 | 5
): OrderbookSnapshot {
  const latestRef = useRef(EMPTY_SNAPSHOT);
  const publishedRef = useRef(EMPTY_SNAPSHOT);
  const dirtyRef = useRef(false);

  const subscribeStore = useCallback(
    (onStoreChange: () => void) => {
      latestRef.current = EMPTY_SNAPSHOT;
      publishedRef.current = EMPTY_SNAPSHOT;
      dirtyRef.current = false;

      let rafId: number;
      const tick = () => {
        if (dirtyRef.current) {
          dirtyRef.current = false;
          publishedRef.current = latestRef.current;
          onStoreChange();
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      const unsubBook = subscribeBook(coin, nSigFigs, mantissa, (book) => {
        latestRef.current = { book, lastTrade: latestRef.current.lastTrade };
        dirtyRef.current = true;
      });
      const unsubTrades = subscribeTrades(coin, (trades) => {
        const last = trades[trades.length - 1];
        if (!last) return;
        latestRef.current = { book: latestRef.current.book, lastTrade: last };
        dirtyRef.current = true;
      });

      return () => {
        cancelAnimationFrame(rafId);
        unsubBook();
        unsubTrades();
      };
    },
    [coin, nSigFigs, mantissa]
  );

  const getSnapshot = useCallback(() => publishedRef.current, []);
  const getServerSnapshot = useCallback(() => EMPTY_SNAPSHOT, []);

  return useSyncExternalStore(subscribeStore, getSnapshot, getServerSnapshot);
}
