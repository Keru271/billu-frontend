'use client';

export interface QueuedOfflineBill {
  id: string; // temporary offline ID
  offlineBillNo: string | number;
  payload: any; // checkout payload passed to /api/bills
  createdAt: string;
  totalPaise: number;
  customerName?: string | null;
  itemsCount: number;
  attempts: number;
  lastError?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: string | null;
  lastSyncMessage: string | null;
}

const STORAGE_QUEUE_KEY = 'billo_offline_bills_queue';
const STORAGE_LAST_BILL_NO_KEY = 'billo_last_offline_bill_no';
const STORAGE_LAST_SYNC_KEY = 'billo_last_sync_time';

export function getOfflineQueue(): QueuedOfflineBill[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read offline bills queue:', e);
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedOfflineBill[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue));
    notifySyncStatus();
  } catch (e) {
    console.error('Failed to save offline bills queue:', e);
  }
}

export function getNextOfflineBillNo(): number {
  if (typeof window === 'undefined') return 9001;
  try {
    const lastSaved = parseInt(localStorage.getItem(STORAGE_LAST_BILL_NO_KEY) || '9000', 10);
    const next = lastSaved + 1;
    localStorage.setItem(STORAGE_LAST_BILL_NO_KEY, next.toString());
    return next;
  } catch {
    return Math.floor(9000 + Math.random() * 900);
  }
}

/**
 * Deduct stock from the locally cached products in localStorage
 * so that while offline, product catalog stock stays accurate
 */
export function deductLocalCachedStock(cartItems: Array<{ productId: string; qty: number }>): void {
  if (typeof window === 'undefined') return;
  try {
    const cachedProdsRaw = localStorage.getItem('billo_cache_/api/products');
    if (!cachedProdsRaw) return;

    const products = JSON.parse(cachedProdsRaw);
    if (!Array.isArray(products)) return;

    for (const item of cartItems) {
      const prod = products.find((p: any) => p.id === item.productId);
      if (prod && typeof prod.stock === 'number') {
        prod.stock = Math.max(0, prod.stock - item.qty);
        prod.isLowStock = prod.stock <= (prod.reorderLevel || 5);
      }
    }

    localStorage.setItem('billo_cache_/api/products', JSON.stringify(products));
    window.dispatchEvent(new CustomEvent('billo:local-stock-updated'));
  } catch (e) {
    console.warn('Failed to update local cached stock:', e);
  }
}

/**
 * Create an offline bill record and queue it for background synchronization
 */
export function createAndQueueOfflineBill(
  payload: any,
  summary: {
    subtotalPaise: number;
    discountPaise: number;
    totalTaxPaise: number;
    grandTotalPaise: number;
    cartItems: any[];
  }
): any {
  const offlineBillNo = getNextOfflineBillNo();
  const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const queuedBill: QueuedOfflineBill = {
    id: offlineId,
    offlineBillNo,
    payload,
    createdAt: now,
    totalPaise: summary.grandTotalPaise,
    customerName: payload.customerName || null,
    itemsCount: payload.items?.length || 0,
    attempts: 0,
  };

  const queue = getOfflineQueue();
  queue.push(queuedBill);
  saveOfflineQueue(queue);

  // Deduct local cached stock immediately
  if (payload.items) {
    deductLocalCachedStock(payload.items);
  }

  // Construct mock Bill response matching /api/bills structure
  return {
    id: offlineId,
    billNo: offlineBillNo,
    tenantId: 'offline',
    userId: 'offline-cashier',
    subtotalPaise: summary.subtotalPaise,
    discountPaise: summary.discountPaise,
    taxPaise: summary.totalTaxPaise,
    totalPaise: summary.grandTotalPaise,
    status: 'PAID',
    createdAt: now,
    payments: payload.payments || [],
    isOffline: true,
  };
}

let isSyncing = false;
let lastSyncMessage: string | null = null;

export function notifySyncStatus(): void {
  if (typeof window === 'undefined') return;
  const queue = getOfflineQueue();
  const lastSyncTime = localStorage.getItem(STORAGE_LAST_SYNC_KEY);

  const status: SyncStatus = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: queue.length,
    isSyncing,
    lastSyncTime,
    lastSyncMessage,
  };

  window.dispatchEvent(new CustomEvent('billo:sync-status', { detail: status }));
}

/**
 * Upload all queued offline bills to the server sequentially
 */
export async function syncOfflineBills(
  apiRequestFn: (endpoint: string, options?: RequestInit) => Promise<any>
): Promise<{ success: boolean; syncedCount: number; remainingCount: number; message: string }> {
  if (typeof window === 'undefined') return { success: true, syncedCount: 0, remainingCount: 0, message: '' };
  if (!navigator.onLine) {
    return {
      success: false,
      syncedCount: 0,
      remainingCount: getOfflineQueue().length,
      message: 'Device is offline. Will sync once connected.',
    };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, remainingCount: 0, message: 'All bills are synced.' };
  }

  if (isSyncing) {
    return {
      success: true,
      syncedCount: 0,
      remainingCount: queue.length,
      message: 'Sync in progress...',
    };
  }

  isSyncing = true;
  notifySyncStatus();

  let syncedCount = 0;
  const remainingQueue: QueuedOfflineBill[] = [];

  for (const item of queue) {
    try {
      const res = await apiRequestFn('/api/bills', {
        method: 'POST',
        body: JSON.stringify(item.payload),
      });

      if (res.success) {
        syncedCount++;
      } else {
        item.attempts += 1;
        item.lastError = res.error?.message || 'Server error';
        remainingQueue.push(item);
      }
    } catch (err: any) {
      item.attempts += 1;
      item.lastError = err?.message || 'Network error';
      remainingQueue.push(item);
      // If network fails completely mid-sync, stop trying remaining
      break;
    }
  }

  isSyncing = false;
  saveOfflineQueue(remainingQueue);

  const now = new Date().toISOString();
  localStorage.setItem(STORAGE_LAST_SYNC_KEY, now);

  if (syncedCount > 0) {
    lastSyncMessage = `Successfully synced ${syncedCount} offline bill${syncedCount > 1 ? 's' : ''} to server!`;
  } else if (remainingQueue.length > 0) {
    lastSyncMessage = `Sync paused. ${remainingQueue.length} bill${remainingQueue.length > 1 ? 's' : ''} waiting for stable connection.`;
  }

  notifySyncStatus();

  // If items were synced, refresh master catalog to get authoritative stock
  if (syncedCount > 0) {
    window.dispatchEvent(new CustomEvent('billo:refresh-master-data'));
  }

  return {
    success: remainingQueue.length === 0,
    syncedCount,
    remainingCount: remainingQueue.length,
    message: lastSyncMessage || 'Sync complete.',
  };
}

/**
 * Initialize offline sync listeners
 */
export function initOfflineSync(
  apiRequestFn: (endpoint: string, options?: RequestInit) => Promise<any>
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    notifySyncStatus();
    // Delay slightly to ensure connection is steady
    setTimeout(() => {
      syncOfflineBills(apiRequestFn);
    }, 1500);
  };

  const handleOffline = () => {
    notifySyncStatus();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Background sync check every 20 seconds
  const interval = setInterval(() => {
    if (navigator.onLine && getOfflineQueue().length > 0 && !isSyncing) {
      syncOfflineBills(apiRequestFn);
    }
  }, 20000);

  // Initial check on startup
  if (navigator.onLine && getOfflineQueue().length > 0) {
    setTimeout(() => {
      syncOfflineBills(apiRequestFn);
    }, 2000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(interval);
  };
}
