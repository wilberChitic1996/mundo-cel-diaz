import * as Sentry from '@sentry/react';

export function initSentry() {
  var dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    release: 'praxisgt@2.2.0',
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    integrations: [Sentry.browserTracingIntegration()],
    ignoreErrors: [
      'Network Error',
      'Request failed with status code 401',
      'Request failed with status code 404',
    ],
  });
}

export { Sentry };
