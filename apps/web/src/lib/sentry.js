/**
 * Optional Sentry monitoring initialization for AniResQ Web
 * Enabled ONLY when VITE_SENTRY_DSN is configured.
 */

export function initFrontendSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  try {
    // Dynamic import with variable to prevent Vite import-analysis errors when @sentry/react is not installed
    const sentryPkg = '@sentry/react';
    import(/* @vite-ignore */ sentryPkg)
      .then((Sentry) => {
        Sentry.init({
          dsn,
          sendDefaultPii: false,
          beforeSend(event) {
            // Strip Authorization headers and credentials
            if (event.request && event.request.headers) {
              delete event.request.headers['Authorization'];
              delete event.request.headers['authorization'];
              delete event.request.headers['apikey'];
            }
            return event;
          },
        });
      })
      .catch(() => {
        // Optional dependency not installed; silently ignore
      });
  } catch {
    // Silently ignore
  }
}
