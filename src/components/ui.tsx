import { cn } from "@/lib/utils";
import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
} from "react";

export const Card = forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
  }
>(function Card({ children, className }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl bg-card shadow-[0_2px_12px_rgba(27,42,74,0.06)] border border-border/60",
        className
      )}
    >
      {children}
    </div>
  );
});

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-navy">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "navy" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(
  function Button(
    { className, variant = "navy", size = "md", ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed",
          size === "sm" && "min-h-9 px-3.5 py-2 text-xs",
          size === "md" && "min-h-11 px-4 py-2.5 text-sm",
          size === "lg" && "min-h-12 px-5 py-3 text-sm",
          variant === "primary" &&
            "bg-lime text-navy hover:bg-lime-dark shadow-sm",
          variant === "navy" && "bg-navy text-white hover:bg-navy-light",
          variant === "ghost" && "bg-transparent text-navy hover:bg-sidebar",
          variant === "danger" && "bg-danger text-white hover:opacity-90",
          variant === "outline" &&
            "border border-border bg-white text-navy hover:bg-sidebar",
          className
        )}
        {...props}
      />
    );
  }
);

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full min-h-11 rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-navy outline-none transition placeholder:text-muted/70 focus:border-teal focus:ring-2 focus:ring-teal/20",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full min-h-11 rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-navy outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-navy outline-none transition placeholder:text-muted/70 focus:border-teal focus:ring-2 focus:ring-teal/20",
        className
      )}
      {...props}
    />
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
    >
      {children}
    </label>
  );
}

export function Badge({
  children,
  tone = "teal",
}: {
  children: React.ReactNode;
  tone?: "teal" | "lime" | "navy" | "danger" | "warning" | "muted";
}) {
  const tones = {
    teal: "bg-teal/15 text-teal",
    lime: "bg-lime/30 text-navy",
    navy: "bg-navy/10 text-navy",
    danger: "bg-danger/10 text-danger",
    warning: "bg-warning/15 text-warning",
    muted: "bg-border text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-navy sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-5 py-12 text-center text-sm text-muted">{message}</div>
  );
}

/** Horizontally scrollable table container — use for md+ tables */
export function TableWrap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full overflow-x-auto overscroll-x-contain", className)}>
      <div className="min-w-0 md:min-w-[640px]">{children}</div>
    </div>
  );
}
