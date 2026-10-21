'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Loader2, CloudUpload } from 'lucide-react';
import { SyncStatus, getOfflineQueue, syncOfflineBills } from '../lib/offlineSync';
import { apiRequest } from '../lib/api';

export default function OfflineSyncBanner() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncTime: null,
    lastSyncMessage: null,
  });
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    // Initial status
    setStatus({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      pendingCount: getOfflineQueue().length,
      isSyncing: false,
      lastSyncTime: localStorage.getItem('billo_last_sync_time'),
      lastSyncMessage: null,
    });

    const handleSyncStatus = (e: any) => {
      const detail: SyncStatus = e.detail;
      setStatus(detail);
      if (detail.lastSyncMessage && detail.lastSyncMessage.includes('Successfully synced')) {
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 4500);
      }
    };

    window.addEventListener('billo:sync-status', handleSyncStatus);
    return () => window.removeEventListener('billo:sync-status', handleSyncStatus);
  }, []);

  const handleManualSync = async () => {
    await syncOfflineBills(apiRequest);
  };

  // If online and no pending offline bills, only show brief success toast if just synced
  if (status.isOnline && status.pendingCount === 0) {
    if (!showSuccessToast) return null;

    return (
      <div className="fixed top-3 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="bg-emerald-600 text-white text-xs font-semibold px-3.5 py-2 rounded-full shadow-lg flex items-center space-x-2 border border-emerald-500">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>All offline bills synced to server!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-3 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      {!status.isOnline ? (
        // Offline Pill
        <div className="bg-amber-600 text-white text-xs font-semibold px-3.5 py-2 rounded-full shadow-lg flex items-center space-x-2 border border-amber-500">
          <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
          <span>Offline Mode</span>
          {status.pendingCount > 0 && (
            <span className="bg-amber-700/80 px-2 py-0.5 rounded-full text-[11px] font-mono">
              {status.pendingCount} pending upload
            </span>
          )}
        </div>
      ) : status.isSyncing ? (
        // Syncing in progress
        <div className="bg-indigo-600 text-white text-xs font-semibold px-3.5 py-2 rounded-full shadow-lg flex items-center space-x-2 border border-indigo-500">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
          <span>Syncing {status.pendingCount} bill{status.pendingCount > 1 ? 's' : ''} to server...</span>
        </div>
      ) : (
        // Online with pending bills
        <div className="bg-stone-900 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg flex items-center space-x-2.5 border border-stone-700">
          <CloudUpload className="w-4 h-4 text-indigo-400" />
          <span>{status.pendingCount} offline bill{status.pendingCount > 1 ? 's' : ''} queued</span>
          <button
            onClick={handleManualSync}
            className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[11px] px-2.5 py-1 rounded-full transition-all flex items-center space-x-1 cursor-pointer"
            title="Upload pending offline bills now"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync Now</span>
          </button>
        </div>
      )}
    </div>
  );
}
