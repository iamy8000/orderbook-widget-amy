import { Orderbook } from "@/components/Orderbook";

export default function Home() {
  return <Orderbook coin="BTC" nSigFigs={5} />;
}
