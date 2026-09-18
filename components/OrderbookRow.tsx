import { memo } from "react";

export const ROW_WIDTH_PX = 240;

const SIDE_STYLES = {
  bid: { text: "text-[#6fae8c]", bar: "bg-[#6fae8c]/15" },
  ask: { text: "text-[#c97b72]", bar: "bg-[#c97b72]/15" },
} as const;

interface OrderbookRowProps {
  side: "bid" | "ask";
  price: string;
  size: string;
  total: string;
  depthFraction: number;
  sizeChange: number;
}

function OrderbookRowImpl({ side, price, size, total, depthFraction }: OrderbookRowProps) {
  const styles = SIDE_STYLES[side];
  return (
    <div
      className="relative grid h-[22px] grid-cols-3 items-center px-2 font-mono text-xs [font-variant-numeric:tabular-nums]"
      style={{ width: ROW_WIDTH_PX }}
    >
      <div
        className={`absolute inset-y-0 left-0 w-full ${styles.bar}`}
        style={{ transform: `scaleX(${depthFraction})`, transformOrigin: "left" }}
      />
      <span className={`relative z-10 text-left ${styles.text}`}>{price}</span>
      <span className="relative z-10 text-right text-zinc-300">{size}</span>
      <span className="relative z-10 text-right text-zinc-300">{total}</span>
    </div>
  );
}

export const OrderbookRow = memo(OrderbookRowImpl);
