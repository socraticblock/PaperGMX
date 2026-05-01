"use client";

export interface TopTabOption {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface TopTabsProps {
  tabs: readonly TopTabOption[];
  activeId: string;
  onChange?: (id: string) => void;
  className?: string;
}

/**
 * Thin tab row (Price / Depth / Net Rate style).
 */
export function TopTabs({
  tabs,
  activeId,
  onChange,
  className = "",
}: TopTabsProps) {
  return (
    <div
      role="tablist"
      className={`flex gap-4 border-b border-trade-border-subtle px-3 md:px-4 ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const base =
          "-mb-px pb-2 text-[length:var(--text-trade-body)] font-medium transition-colors";
        const inactive =
          "text-text-muted hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-40";
        const activeCls = active
          ? "border-b-2 border-blue-primary text-text-primary"
          : inactive;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={!!tab.disabled}
            onClick={() => {
              if (onChange && !tab.disabled) onChange(tab.id);
            }}
            className={`${base} ${activeCls}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
