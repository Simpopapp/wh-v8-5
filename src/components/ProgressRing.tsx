import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ProgressRingProps extends HTMLAttributes<HTMLDivElement> {
  /** 0 a 1 */
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}

/**
 * Anel de progresso compartilhado. Papel acessível configurável via props
 * (default `timer`, consumidores podem sobrescrever para `progressbar`).
 */
export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  className,
  children,
  ...rest
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="timer"
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-200 ease-out motion-reduce:transition-none"
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      ) : null}
    </div>
  );
}
