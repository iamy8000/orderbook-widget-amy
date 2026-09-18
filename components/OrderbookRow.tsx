import { memo, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const ROW_WIDTH_PX = 300;

const SIDE_STYLES = {
  bid: { text: "text-[#1fa67d]", bar: "bg-[#1fa67d]/15", flashUp: "flash-up-bid" },
  ask: { text: "text-[#ED7088]", bar: "bg-[#ED7088]/15", flashUp: "flash-up-ask" },
} as const;

interface OrderbookRowProps {
  side: "bid" | "ask";
  index: number;
  coin: string;
  price: string;
  size: string;
  total: string;
  depthFraction: number;
  sizeChange: number;
  isHovered: boolean;
  isSelected: boolean;
  tooltipDistance: string;
  tooltipAvgPrice: string;
  tooltipTotalBase: string;
  tooltipTotalNotional: string;
  onHover: (side: "bid" | "ask", index: number) => void;
  onLeave: () => void;
}

function OrderbookRowImpl({
  side,
  index,
  coin,
  price,
  size,
  total,
  depthFraction,
  sizeChange,
  isHovered,
  isSelected,
  tooltipDistance,
  tooltipAvgPrice,
  tooltipTotalBase,
  tooltipTotalNotional,
  onHover,
  onLeave,
}: OrderbookRowProps) {
  const styles = SIDE_STYLES[side];
  const flashClass = sizeChange > 0 ? styles.flashUp : sizeChange < 0 ? "flash-down" : "";
  const showTooltip = isHovered && tooltipAvgPrice !== "";

  const rootRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  // The panel this row lives in clips overflow for its rounded corners, so a
  // tooltip positioned via CSS (right-full) would be invisible — portal it to
  // <body> instead and place it with the row's own measured screen position.
  useLayoutEffect(() => {
    if (!showTooltip || !rootRef.current) {
      setTooltipPos(null);
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    setTooltipPos({ top: rect.top + rect.height / 2, left: rect.left });
  }, [showTooltip]);

  return (
    <div
      ref={rootRef}
      className="relative grid h-[22px] grid-cols-3 items-center px-2 font-mono text-xs [font-variant-numeric:tabular-nums]"
      style={{ width: ROW_WIDTH_PX }}
      onMouseEnter={() => onHover(side, index)}
      onMouseLeave={onLeave}
    >
      <div
        className={`absolute inset-y-0 left-0 w-full transition-transform duration-300 ease-out ${styles.bar}`}
        style={{ transform: `scaleX(${depthFraction})`, transformOrigin: "left" }}
      />
      {isSelected && <div className="pointer-events-none absolute inset-0 bg-white/5" />}
      {flashClass && <div key={size} className={`pointer-events-none absolute inset-0 z-20 ${flashClass}`} />}
      {isHovered && (
        <div
          className={`pointer-events-none absolute inset-x-0 border-dashed border-white/40 ${
            side === "ask" ? "top-0 border-t" : "bottom-0 border-b"
          }`}
        />
      )}
      <span className={`relative z-10 text-left ${styles.text}`}>{price}</span>
      <span className="relative z-10 text-right text-zinc-300">{size}</span>
      <span className="relative z-10 text-right text-zinc-300">{total}</span>
      {showTooltip &&
        tooltipPos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 w-40 -translate-x-full -translate-y-1/2 rounded-md border border-white/10 bg-[#0f1a1f] p-2 text-[11px] text-zinc-400 shadow-lg"
            style={{ top: tooltipPos.top, left: tooltipPos.left - 8 }}
          >
            <div className="flex justify-between gap-2">
              <span>Distance from Mid</span>
              <span className="text-zinc-200">{tooltipDistance}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Average Price</span>
              <span className="text-zinc-200">{tooltipAvgPrice}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Total ({coin})</span>
              <span className="text-zinc-200">{tooltipTotalBase}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Total (USD)</span>
              <span className="text-zinc-200">{tooltipTotalNotional}</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export const OrderbookRow = memo(OrderbookRowImpl);
