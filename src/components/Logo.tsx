"use client";

export default function Logo({ size = "default" }: { size?: "small" | "default" | "large" }) {
  const sizeClasses = {
    small: "h-6 w-6 text-xs",
    default: "h-8 w-8 text-sm",
    large: "h-14 w-14 text-xl",
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses[size]} flex items-center justify-center rounded-xl bg-blue-primary font-bold text-white`}
      >
        P
      </div>
      {(size === "default" || size === "large") && (
        <span
          className={`font-bold text-text-primary ${
            size === "large" ? "text-2xl" : "text-lg"
          }`}
        >
          Paper<span className="text-blue-primary">GMX</span>
        </span>
      )}
    </div>
  );
}
