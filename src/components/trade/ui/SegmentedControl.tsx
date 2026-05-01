"use client";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
  tone?: "neutral" | "long" | "short";
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

/** Long | Short | (optional third) strip like GMX order panel. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`grid gap-px rounded-md bg-trade-border p-px ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const toneCls =
          opt.tone === "long" && active
            ? "bg-green-primary/20 text-green-primary"
            : opt.tone === "short" && active
              ? "bg-red-primary/20 text-red-primary"
              : active
                ? "bg-trade-raised text-text-primary"
                : "bg-trade-panel text-text-muted hover:bg-trade-raised/80 hover:text-text-secondary";
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled || opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`min-h-[36px] px-2 text-[length:var(--text-trade-body)] font-semibold transition-colors disabled:opacity-40 ${toneCls}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
