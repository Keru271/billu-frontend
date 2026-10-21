'use client';

import React, { useState, useEffect } from 'react';
import { Download, MonitorCheck, Share, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already running as installed PWA
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Check if device is iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // Listen for beforeinstallprompt event (Chrome, Edge, Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      console.log('[PWA] Billo POS successfully installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // If already running in standalone mode or just installed, hide button
  if (isStandalone || installed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback for browsers without beforeinstallprompt support
      alert(
        'To install Billo POS as an app on your device:\n\n' +
        '• In Chrome / Edge: Click the install icon (🖥️ or ⬇️) in the address bar at the top-right.\n' +
        '• In mobile browsers: Tap the menu (⋮) and select "Install app" or "Add to Home Screen".'
      );
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center space-x-1.5 h-9 px-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 hover:bg-orange-100 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-xs active:scale-95"
        title="Install Billo POS as a native desktop or mobile app"
      >
        <Download className="w-3.5 h-3.5 text-[#C2410C]" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-stone-200 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-[#C2410C] mb-4">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-base text-stone-900 mb-1">
              Install Billo POS on iPhone / iPad
            </h3>
            <p className="text-xs text-stone-600 mb-4">
              Install Billo as a standalone POS app for full offline support and full-screen experience:
            </p>

            <ol className="text-xs text-stone-700 space-y-2.5 mb-5 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#C2410C]">1.</span>
                <span>Tap the <Share className="inline w-3.5 h-3.5 text-blue-600 mx-0.5" /> <strong>Share</strong> button in Safari's toolbar.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#C2410C]">2.</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#C2410C]">3.</span>
                <span>Tap <strong>Add</strong> in the top right corner.</span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 bg-[#C2410C] text-white rounded-xl text-xs font-semibold hover:bg-[#9A3412] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
