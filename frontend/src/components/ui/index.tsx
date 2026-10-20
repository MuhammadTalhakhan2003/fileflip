"use client";

import clsx from "clsx";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ Button */

type Variant = "primary" | "tint" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Category color for the "tint" variant. */
  color?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
  xl: "h-14 px-8 text-base gap-2.5 rounded-2xl",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_8px_24px_-10px_var(--brand)] hover:bg-brand-strong hover:shadow-[0_12px_28px_-10px_var(--brand)]",
  tint: "tint-bg text-white shadow-[0_10px_28px_-12px_var(--c)] hover:brightness-[1.06] hover:shadow-[0_14px_32px_-12px_var(--c)]",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2 shadow-soft",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger/10 text-danger hover:bg-danger/15",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, color, leftIcon, rightIcon, className, children, disabled, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={color ? ({ "--c": color, ...style } as CSSProperties) : style}
      className={clsx(
        "inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition-all duration-200",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        sizes[size],
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

/* ------------------------------------------------------------------ Switch */

export function Switch({
  checked,
  onChange,
  label,
  description,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  color?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{ "--c": color ?? "var(--brand)" } as CSSProperties}
        className={clsx(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "tint-bg" : "bg-surface-3",
        )}
      >
        <span
          className={clsx(
            "inline-block size-5 rounded-full bg-white shadow-md transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------------ Segmented */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  color,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode; hint?: string }[];
  onChange: (v: T) => void;
  color?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      className="grid gap-1 rounded-xl bg-surface-2 p-1"
      style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))`, "--c": color ?? "var(--brand)" } as CSSProperties}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={clsx(
              "truncate rounded-lg px-2 font-medium transition-all duration-200",
              size === "sm" ? "py-1.5 text-xs" : "py-2 text-[13px]",
              active ? "bg-surface text-ink shadow-soft ring-1 ring-line" : "text-muted hover:text-ink",
            )}
          >
            {active ? <span className="tint-text">{o.label}</span> : o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Field */

export function Field({
  label,
  hint,
  htmlFor,
  children,
  trailing,
}: {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={clsx(
        "h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-subtle",
        "transition-colors outline-none hover:border-line-strong focus:border-brand focus:ring-4 focus:ring-brand/10",
        className,
      )}
      {...rest}
    />
  );
});

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} autoComplete="off" className="pr-10" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-subtle hover:text-ink"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  color,
  suffix = "",
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  color?: string;
  suffix?: string;
}) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <div className="flex items-center gap-3" style={{ "--c": color ?? "var(--brand)" } as CSSProperties}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[var(--c)]"
        style={{ background: `linear-gradient(to right, var(--c) ${pct}%, var(--surface-3) ${pct}%)` }}
      />
      <span className="w-16 shrink-0 rounded-lg bg-surface-2 py-1 text-center text-xs font-semibold tabular-nums text-ink">
        {value}
        {suffix}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ misc */

export function Badge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "ai" | "new" | "muted" }) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    ai: "bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white",
    new: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    muted: "bg-surface-2 text-muted",
  };
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase", tones[tone])}>
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-surface-2 px-1.5 font-sans text-[11px] font-medium text-muted">
      {children}
    </kbd>
  );
}
