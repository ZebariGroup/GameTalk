'use client';

import { useEffect } from 'react';

/**
 * Registers the app service worker in production for PWA installability,
 * offline fallback navigation, and static asset caching.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (cancelled) return;
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (next) {
            next.addEventListener('statechange', () => {
              if (next.state === 'installed' && navigator.serviceWorker.controller) {
                /* new version available — could show refresh UI later */
              }
            });
          }
        });
      })
      .catch(() => {
        /* registration optional */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
