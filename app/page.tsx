"use client";

import { useOrderbook } from "@/lib/hyperliquid/useOrderbook";

export default function Home() {
  const snapshot = useOrderbook("BTC", 5);

  return <pre>{JSON.stringify(snapshot, null, 2)}</pre>;
}
