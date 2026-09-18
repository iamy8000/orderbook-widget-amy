"use client";

export const COINS = ["BTC", "ETH"] as const;
export type Coin = (typeof COINS)[number];

// "base" means "whatever coin is currently selected" (BTC or ETH) — its
// display label always follows `coin`, so the toggle/header text stays
// correct across market switches without the value itself needing to change.
export type Unit = "base" | "usdc";

export interface TickOption {
  multiplier: number;
  label: string;
}

interface MarketControlsProps {
  coin: Coin;
  onCoinChange: (coin: Coin) => void;
  tickOptions: TickOption[];
  tickMultiplier: number;
  onTickChange: (multiplier: number) => void;
}

export function MarketControls({ coin, onCoinChange, tickOptions, tickMultiplier, onTickChange }: MarketControlsProps) {
  return (
    <>
      <select
        className="bg-transparent text-zinc-200 outline-none"
        value={coin}
        onChange={(e) => onCoinChange(e.target.value as Coin)}
      >
        {COINS.map((c) => (
          <option key={c} value={c} className="bg-[#0f1a1f]">
            {c}-USD
          </option>
        ))}
      </select>
      <select
        className="bg-transparent text-right text-zinc-200 outline-none"
        value={tickMultiplier}
        onChange={(e) => onTickChange(Number(e.target.value))}
      >
        {tickOptions.map((opt) => (
          <option key={opt.multiplier} value={opt.multiplier} className="bg-[#0f1a1f]">
            {opt.label}
          </option>
        ))}
      </select>
    </>
  );
}

interface UnitToggleProps {
  coin: Coin;
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
}

// Denomination: a two-way display toggle for the same data, not a "pick one
// of N markets/precisions" choice — a segmented button reads as flipping a
// switch, distinct from the dropdowns above it.
export function UnitToggle({ coin, unit, onUnitChange }: UnitToggleProps) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-white/10 text-[11px]">
      <button
        type="button"
        onClick={() => onUnitChange("usdc")}
        className={`px-2 py-1 ${unit === "usdc" ? "bg-white/10 text-zinc-100" : "text-zinc-500"}`}
      >
        USD
      </button>
      <button
        type="button"
        onClick={() => onUnitChange("base")}
        className={`px-2 py-1 ${unit === "base" ? "bg-white/10 text-zinc-100" : "text-zinc-500"}`}
      >
        {coin}
      </button>
    </div>
  );
}
