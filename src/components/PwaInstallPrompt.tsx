'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Shows an install banner when the browser fires beforeinstallprompt (Chromium, etc.).
 */
export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }, [deferred]);

  if (dismissed || !deferred) return null;

  return (
    <div
      role="status"
      className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/50 px-3 py-2.5 text-sm text-indigo-100"
    >
      <Download className="h-4 w-4 shrink-0 text-indigo-300" aria-hidden />
      <span className="text-center font-medium">Install Minevine as an app for quick access.</span>
      <div className="flex w-full min-[400px]:w-auto min-[400px]:justify-end gap-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-[40px] flex-1 min-[400px]:flex-none rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={install}
          className="min-h-[40px] flex-1 min-[400px]:flex-none rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-400"
        >
          Install
        </button>
      </div>
    </div>
  );
}
