'use client';

import { Product } from '../components/POSBilling';

const STORAGE_PRODUCTS_KEY = 'billo_products_store';
const CACHE_PRODUCTS_KEY = 'billo_cache_/api/products';
const STORAGE_SYNC_PENDING_KEY = 'billo_stock_sync_pending';

/**
 * Retrieve cached products from localStorage.
 * Fast instantaneous retrieval to populate catalog on startup.
 */
export function getStoredProducts(): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw =
      localStorage.getItem(STORAGE_PRODUCTS_KEY) ||
      localStorage.getItem(CACHE_PRODUCTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse stored products:', err);
    return [];
  }
}

/**
 * Save products into persistent local storage and mirror to API cache.
 */
export function saveStoredProducts(products: Product[]): void {
  if (typeof window === 'undefined' || !Array.isArray(products)) return;
  try {
    const str = JSON.stringify(products);
    localStorage.setItem(STORAGE_PRODUCTS_KEY, str);
    localStorage.setItem(CACHE_PRODUCTS_KEY, str);
  } catch (err) {
    console.warn('Failed to save products to localStorage:', err);
  }
}

/**
 * Deduct stock locally immediately upon selling.
 * Updates local store and dispatches event so the UI updates with zero delay.
 */
export function deductProductStockLocally(
  soldItems: Array<{ productId: string; qty: number }>
): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const products = getStoredProducts();
    if (!products.length) return [];

    let hasChanges = false;
    for (const item of soldItems) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod && typeof prod.stock === 'number') {
        prod.stock = Math.max(0, prod.stock - item.qty);
        prod.isLowStock = prod.stock <= (prod.reorderLevel ?? 5);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      saveStoredProducts(products);
      markStockSyncPending(true);
      window.dispatchEvent(
        new CustomEvent('billo:products-updated', { detail: { products } })
      );
    }

    return products;
  } catch (err) {
    console.warn('Failed to deduct local product stock:', err);
    return [];
  }
}

/**
 * Mark whether stock needs to be synchronized with the backend.
 */
export function markStockSyncPending(pending: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (pending) {
      localStorage.setItem(STORAGE_SYNC_PENDING_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_SYNC_PENDING_KEY);
    }
  } catch {}
}

export function isStockSyncPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_SYNC_PENDING_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Idle Stock Synchronization Manager.
 * Detects user inactivity. If the user doesn't perform any actions for `idleTimeoutMs` (e.g. 4 seconds),
 * it triggers a silent background sync of product stock from the server.
 */
export function initIdleStockSync(
  syncFn: () => Promise<Product[] | null>,
  idleTimeoutMs = 4000
): () => void {
  if (typeof window === 'undefined') return () => {};

  let lastActivity = Date.now();
  let isSyncing = false;

  const markActive = () => {
    lastActivity = Date.now();
  };

  const activityEvents = [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'scroll',
    'input',
  ];

  activityEvents.forEach((evt) => {
    window.addEventListener(evt, markActive, { passive: true });
  });

  // Check periodically every 1.5 seconds if user is idle
  const intervalId = window.setInterval(async () => {
    const idleDuration = Date.now() - lastActivity;

    // Only sync if user has been idle for >= idleTimeoutMs and not currently syncing
    if (idleDuration >= idleTimeoutMs && !isSyncing) {
      // Sync if there was a recent sale OR periodic check (every 45s of idle)
      const shouldSync = isStockSyncPending() || idleDuration % 45000 < 2000;
      if (shouldSync) {
        try {
          isSyncing = true;
          const fresh = await syncFn();
          if (fresh && Array.isArray(fresh)) {
            saveStoredProducts(fresh);
            markStockSyncPending(false);
            window.dispatchEvent(
              new CustomEvent('billo:products-updated', { detail: { products: fresh } })
            );
          }
        } catch (err) {
          console.warn('Silent idle stock sync skipped or failed:', err);
        } finally {
          isSyncing = false;
        }
      }
    }
  }, 1500);

  return () => {
    window.clearInterval(intervalId);
    activityEvents.forEach((evt) => {
      window.removeEventListener(evt, markActive);
    });
  };
}
