import { memo } from "react";

export const ROW_WIDTH_PX = 240;

interface OrderbookRowProps {
  side: "bid" | "ask";
  price: string;
  size: string;
  total: string;
  depthFraction: number;
  sizeChange: number;
}

function OrderbookRowImpl({ side, price, size, total, depthFraction }: OrderbookRowProps) {
  return (
    <div
      className="relative grid h-[22px] grid-cols-3 items-center font-mono text-xs [font-variant-numeric:tabular-nums]"
      style={{ width: ROW_WIDTH_PX }}
    >
      <div
        className="absolute inset-y-0 w-full bg-white/10"
        style={{
          transform: `scaleX(${depthFraction})`,
          transformOrigin: side === "bid" ? "right" : "left",
        }}
      />
      <span className="relative z-10 pr-2 text-right">{price}</span>
      <span className="relative z-10 pr-2 text-right">{size}</span>
      <span className="relative z-10 pr-2 text-right">{total}</span>
    </div>
  );
}

export const OrderbookRow = memo(OrderbookRowImpl);
