"use client";

import { useEffect, useId, useRef } from "react";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shows loading text on the confirm button and disables actions */
  confirming?: boolean;
  confirmDisabled?: boolean;
  /** Confirm button style — danger for delete/void, primary/navy for notices */
  variant?: "danger" | "primary" | "navy";
  /** Optional extra content (e.g. reason field) between description and actions */
  children?: React.ReactNode;
  /** When true, only the confirm button is shown (for alert/notice dialogs) */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * App-styled confirmation modal. Replaces window.confirm() for destructive
 * (and other) actions. Closes on Cancel, Escape, or backdrop click; only
 * runs the action when the confirm button is clicked.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirming = false,
  confirmDisabled = false,
  variant = "danger",
  children,
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (hideCancel ? confirmRef.current : cancelRef.current)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirming) {
        e.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, confirming, onCancel, hideCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/45 p-4 animate-fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (confirming) return;
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Card
          className={cn(
            "p-6 shadow-[0_12px_40px_rgba(27,42,74,0.18)]",
            "animate-fade-up"
          )}
        >
          <h2 id={titleId} className="text-lg font-extrabold text-navy">
            {title}
          </h2>
          <div id={descId} className="mt-2 text-sm leading-relaxed text-muted">
            {description}
          </div>

          {children ? <div className="mt-4">{children}</div> : null}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {!hideCancel ? (
              <Button
                ref={cancelRef}
                type="button"
                variant="ghost"
                disabled={confirming}
                onClick={onCancel}
              >
                {cancelLabel}
              </Button>
            ) : null}
            <Button
              ref={confirmRef}
              type="button"
              variant={variant}
              disabled={confirming || confirmDisabled}
              onClick={onConfirm}
            >
              {confirming ? "Please wait…" : confirmLabel}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
