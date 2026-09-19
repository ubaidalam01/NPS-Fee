export type AppAlertPayload = {
  title: string;
  message: string;
};

type Handler = (payload: AppAlertPayload) => void;

let handler: Handler | null = null;

/** Register the UI host that renders styled alerts (see AppAlertHost). */
export function setAppAlertHandler(next: Handler | null) {
  handler = next;
}

/** Drop-in replacement for window.alert — never uses the browser dialog. */
export function showAppAlert(message: string, title = "Notice") {
  if (handler) {
    handler({ title, message });
    return;
  }
  // Fallback only if host not mounted (should not happen in-app)
  console.warn(`[alert] ${title}: ${message}`);
}
