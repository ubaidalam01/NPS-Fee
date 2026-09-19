"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { setAppAlertHandler, type AppAlertPayload } from "@/lib/app-alert";

/**
 * Mount once in the app shell. Renders styled alerts for showAppAlert()
 * (replaces window.alert across the app, including non-React helpers).
 */
export function AppAlertHost() {
  const [alert, setAlert] = useState<AppAlertPayload | null>(null);

  useEffect(() => {
    setAppAlertHandler((payload) => setAlert(payload));
    return () => setAppAlertHandler(null);
  }, []);

  return (
    <ConfirmDialog
      open={Boolean(alert)}
      title={alert?.title ?? "Notice"}
      description={alert?.message ?? null}
      confirmLabel="OK"
      variant="navy"
      hideCancel
      onCancel={() => setAlert(null)}
      onConfirm={() => setAlert(null)}
    />
  );
}
