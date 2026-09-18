import { memo } from "react";

export const ROW_WIDTH_PX = 300;

const SIDE_STYLES = {
  bid: { text: "text-[#1fa67d]", bar: "bg-[#1fa67d]/15", flashUp: "flash-up-bid" },
  ask: { text: "text-[#ED7088]", bar: "bg-[#ED7088]/15", flashUp: "flash-up-ask" },
} as const;

interface OrderbookRowProps {
  side: "bid" | "ask";
  price: string;
  size: string;
  total: string;
  depthFraction: number;
  sizeChange: number;
}

function OrderbookRowImpl({ side, price, size, total, depthFraction, sizeChange }: OrderbookRowProps) {
  const styles = SIDE_STYLES[side];
  const flashClass = sizeChange > 0 ? styles.flashUp : sizeChange < 0 ? "flash-down" : "";

  return (
    <div
      className="relative grid h-[22px] grid-cols-3 items-center px-2 font-mono text-xs [font-variant-numeric:tabular-nums]"
      style={{ width: ROW_WIDTH_PX }}
    >
      <div
        className={`absolute inset-y-0 left-0 w-full transition-transform duration-300 ease-out ${styles.bar}`}
        style={{ transform: `scaleX(${depthFraction})`, transformOrigin: "left" }}
      />
      {flashClass && <div key={size} className={`pointer-events-none absolute inset-0 z-20 ${flashClass}`} />}
      <span className={`relative z-10 text-left ${styles.text}`}>{price}</span>
      <span className="relative z-10 text-right text-zinc-300">{size}</span>
      <span className="relative z-10 text-right text-zinc-300">{total}</span>
    </div>
  );
}

export const OrderbookRow = memo(OrderbookRowImpl);
