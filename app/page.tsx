'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '../components/Navbar';
import POSBilling, { Product, Customer, CartItem, CategoryItem } from '../components/POSBilling';
import InventoryView from '../components/InventoryView';
import CustomersView from '../components/CustomersView';
import BillsHistoryView from '../components/BillsHistoryView';
import DashboardView from '../components/DashboardView';
import SettingsView from '../components/SettingsView';
import HeldCartsDrawer from '../components/HeldCartsDrawer';
import VoiceMicModal from '../components/VoiceMicModal';
import LoginModal from '../components/LoginModal';
import { apiRequest, fetchCurrentUser, logout, AuthUser } from '../lib/api';
import OfflineSyncBanner from '../components/OfflineSyncBanner';
import { initOfflineSync } from '../lib/offlineSync';
import { setLastKnownBillNo } from '../lib/receipt';
import {
  getStoredProducts,
  saveStoredProducts,
  initIdleStockSync,
} from '../lib/productStore';

export default function BillDeskApp() {
  const [activeTab, setActiveTab] = useState<
    'pos' | 'inventory' | 'customers' | 'history' | 'dashboard' | 'settings'
  >('pos');

  // Auth State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Master Data (Instant recovery from local store on startup)
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [heldCarts, setHeldCarts] = useState<any[]>([]);

  // Cart State (Persisted across tabs while cashier operates)
  const [activeCartItems, setActiveCartItems] = useState<CartItem[]>([]);

  // Drawer & Modals
  const [isHeldDrawerOpen, setIsHeldDrawerOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Immediately load cached products on client mount
  useEffect(() => {
    const cached = getStoredProducts();
    if (cached.length > 0) {
      setProducts(cached);
    }
  }, []);

  // 1. Catalog API (Products & Categories) - Needed ONLY for POS & Inventory
  const fetchCatalog = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        apiRequest('/api/products'),
        apiRequest('/api/categories'),
      ]);

      if (prodRes.success && Array.isArray(prodRes.data)) {
        saveStoredProducts(prodRes.data);
        setProducts(prodRes.data);
      }
      if (catRes.success && Array.isArray(catRes.data)) {
        setCategories(catRes.data);
      }
    } catch (e) {
      console.error('Error fetching catalog:', e);
    }
  }, []);

  // 2. Customers API - Needed ONLY for Customers tab or POS Customer Selection
  const fetchCustomers = useCallback(async () => {
    try {
      const custRes = await apiRequest('/api/customers');
      if (custRes.success && Array.isArray(custRes.data)) {
        setCustomers(custRes.data);
      }
    } catch (e) {
      console.error('Error fetching customers:', e);
    }
  }, []);

  // 3. Settings API - Needed ONLY for Settings tab
  const isFetchingSettingsRef = useRef(false);
  const fetchSettings = useCallback(async () => {
    if (isFetchingSettingsRef.current) return;
    isFetchingSettingsRef.current = true;
    try {
      const setRes = await apiRequest('/api/settings');
      if (setRes.success && setRes.data) {
        setShopSettings(setRes.data);
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    } finally {
      isFetchingSettingsRef.current = false;
    }
  }, []);

  // 4. Held Carts API - Needed ONLY when Held Drawer is opened
  const fetchHeldCarts = useCallback(async () => {
    try {
      const heldRes = await apiRequest('/api/held');
      if (heldRes.success && Array.isArray(heldRes.data)) {
        setHeldCarts(heldRes.data);
      }
    } catch (e) {
      console.error('Error fetching held carts:', e);
    }
  }, []);

  // Trigger ONLY the API needed for the currently active tab
  const lastFetchedTabRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser) return;

    if (lastFetchedTabRef.current === activeTab) return;
    lastFetchedTabRef.current = activeTab;

    if (activeTab === 'pos' || activeTab === 'inventory') {
      fetchCatalog();
    } else if (activeTab === 'customers') {
      fetchCustomers();
    } else if (activeTab === 'settings') {
      fetchSettings();
    }
    // 'history' and 'dashboard' fetch their own respective endpoints internally on mount
  }, [activeTab, Boolean(currentUser), fetchCatalog, fetchCustomers, fetchSettings]);

  // Fetch held carts ONLY when the held drawer is opened
  const lastHeldFetchedOpenRef = useRef<boolean>(false);
  useEffect(() => {
    if (isHeldDrawerOpen && currentUser && !lastHeldFetchedOpenRef.current) {
      lastHeldFetchedOpenRef.current = true;
      fetchHeldCarts();
    } else if (!isHeldDrawerOpen) {
      lastHeldFetchedOpenRef.current = false;
    }
  }, [isHeldDrawerOpen, Boolean(currentUser), fetchHeldCarts]);

  // Auth Initialization (Runs once on mount)
  const isAuthInitRef = useRef(false);
  useEffect(() => {
    if (isAuthInitRef.current) return;
    isAuthInitRef.current = true;

    const initAuth = async () => {
      try {
        setIsAuthChecking(true);
        const user = await fetchCurrentUser();
        if (user) {
          setCurrentUser(user);
          if (user.tenant) {
            setShopSettings(user.tenant);
          }
        } else {
          setCurrentUser(null);
          setIsLoginModalOpen(true);
        }
      } catch (e) {
        console.error('Auth initialization error:', e);
        setIsLoginModalOpen(true);
      } finally {
        setIsAuthChecking(false);
      }
    };

    initAuth();

    const handleUnauthorized = () => {
      setCurrentUser(null);
      setIsLoginModalOpen(true);
    };

    const handleAuthChanged = (e: any) => {
      if (e.detail?.user) {
        setCurrentUser(e.detail.user);
        if (e.detail.user.tenant) {
          setShopSettings(e.detail.user.tenant);
        }
      } else {
        setCurrentUser(null);
        setIsLoginModalOpen(true);
      }
    };

    const cleanupOffline = initOfflineSync(apiRequest);

    // Listen to local product stock updates (from sales/deductions)
    const handleProductsUpdated = (e: any) => {
      if (Array.isArray(e.detail?.products)) {
        setProducts(e.detail.products);
      }
    };

    window.addEventListener('billo:products-updated', handleProductsUpdated);
    window.addEventListener('billdesk:unauthorized', handleUnauthorized);
    window.addEventListener('billdesk:auth-changed', handleAuthChanged);

    // Idle Detection: If cashier doesn't perform actions for 4 seconds,
    // sync updated product stock from the server in the background
    const cleanupIdleSync = initIdleStockSync(async () => {
      try {
        const res = await apiRequest('/api/products');
        if (res.success && Array.isArray(res.data)) {
          return res.data;
        }
      } catch (err) {
        console.warn('Background idle product sync error:', err);
      }
      return null;
    }, 4000);

    return () => {
      cleanupOffline();
      cleanupIdleSync();
      window.removeEventListener('billo:products-updated', handleProductsUpdated);
      window.removeEventListener('billdesk:unauthorized', handleUnauthorized);
      window.removeEventListener('billdesk:auth-changed', handleAuthChanged);
    };
  }, []);

  // Keyboard shortcut listener for F1, F4, etc.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('pos');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setIsHeldDrawerOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setActiveCartItems([]);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = async (user: AuthUser) => {
    setCurrentUser(user);
    if (user.tenant) {
      setShopSettings(user.tenant);
    }
    setIsLoginModalOpen(false);
    fetchCatalog();
  };

  // Hold / Park Cart Action
  const handleParkCart = async (labelOrItems?: any) => {
    if (activeCartItems.length === 0) return;

    const labelText = typeof labelOrItems === 'string' ? labelOrItems : undefined;
    const payload = {
      label: labelText || `Parked Cart (${activeCartItems.length} items)`,
      items: activeCartItems.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        pricePaise: i.product.pricePaise,
        taxPct: i.product.taxPct,
        qty: i.qty,
      })),
    };

    const res = await apiRequest('/api/held', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setActiveCartItems([]);
      fetchHeldCarts();
    } else {
      alert(`Could not park cart: ${res.error?.message}`);
    }
  };

  // Resume Parked Cart Action
  const handleResumeCart = async (cartId: string) => {
    const res = await apiRequest(`/api/held/${cartId}/resume`, { method: 'POST' });
    if (res.success && res.data) {
      const heldData = res.data;
      if (Array.isArray(heldData.items)) {
        const restored: CartItem[] = [];
        for (const item of heldData.items) {
          const prod = products.find((p) => p.id === item.productId);
          if (prod) {
            restored.push({ product: prod, qty: item.qty });
          }
        }
        setActiveCartItems(restored);
        setActiveTab('pos');
      }
      fetchHeldCarts();
    }
  };

  // Discard Parked Cart Action
  const handleDiscardCart = async (cartId: string) => {
    const res = await apiRequest(`/api/held/${cartId}`, { method: 'DELETE' });
    if (res.success) {
      fetchHeldCarts();
    }
  };

  // Apply Voice Actions (from Voice-to-Cart)
  const handleApplyVoiceActions = (actions: any[]) => {
    for (const act of actions) {
      if (act.action === 'ADD' && act.product) {
        const productToAdd = products.find((p) => p.id === act.product.id);
        if (productToAdd) {
          const qty = act.qty || 1;
          setActiveCartItems((prev) => {
            const idx = prev.findIndex((i) => i.product.id === productToAdd.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], qty: updated[idx].qty + qty };
              return updated;
            }
            return [...prev, { product: productToAdd, qty }];
          });
        }
      } else if (act.action === 'REMOVE' && act.product) {
        setActiveCartItems((prev) => prev.filter((i) => i.product.id !== act.product.id));
      } else if (act.action === 'CLEAR') {
        setActiveCartItems([]);
      }
    }
    setActiveTab('pos');
  };

  const totalCartCount = activeCartItems.reduce((acc, i) => acc + i.qty, 0);

  if (isAuthChecking && !currentUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen bg-[#FAFAF9] text-[#78716C] font-sans">
        <div className="w-9 h-9 rounded-full border-2 border-[#C2410C] border-t-transparent animate-spin mb-3 shadow-xs" />
        <p className="text-sm font-semibold text-[#1C1917]">Starting BillDesk POS...</p>
        <p className="text-xs text-[#78716C] mt-1 font-mono">Fetching catalog & caching product stock...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#FAFAF9] text-[#1C1917] font-sans">
      {/* Floating Offline & Sync Banner */}
      <OfflineSyncBanner />

      {/* Top Navigation & Mobile Bottom Nav */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        shopName={shopSettings?.name || currentUser?.tenant?.name || 'Shree Ganesh Supermarket'}
        heldCount={heldCarts.length}
        onOpenHeld={() => setIsHeldDrawerOpen(true)}
        onOpenVoice={() => setIsVoiceModalOpen(true)}
        isVoiceActive={isVoiceModalOpen}
        cartItemCount={totalCartCount}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* Main View Area (with bottom padding on mobile for bottom navigation bar) */}
      <main className="flex-1 flex overflow-hidden pb-14 lg:pb-0">
        {activeTab === 'pos' && (
          <POSBilling
            products={products}
            categories={categories}
            customers={customers}
            refreshData={fetchCatalog}
            onRequestCustomers={fetchCustomers}
            onParkCart={handleParkCart}
            activeCartItems={activeCartItems}
            setActiveCartItems={setActiveCartItems}
            shopSettings={shopSettings}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            products={products}
            categories={categories}
            refreshData={fetchCatalog}
            currentUser={currentUser}
            shopSettings={shopSettings}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            refreshData={fetchCustomers}
            shopName={shopSettings?.name || currentUser?.tenant?.name || 'Shree Ganesh Supermarket'}
          />
        )}

        {activeTab === 'history' && (
          <BillsHistoryView shopSettings={shopSettings} currentUser={currentUser} />
        )}

        {activeTab === 'dashboard' && <DashboardView currentUser={currentUser} />}

        {activeTab === 'settings' && (
          <SettingsView
            shopSettings={shopSettings}
            refreshSettings={fetchSettings}
            currentUser={currentUser}
          />
        )}
      </main>

      {/* Parked Carts Drawer */}
      <HeldCartsDrawer
        isOpen={isHeldDrawerOpen}
        onClose={() => setIsHeldDrawerOpen(false)}
        heldCarts={heldCarts}
        onParkCurrentCart={handleParkCart}
        onResumeCart={handleResumeCart}
        onDiscardCart={handleDiscardCart}
        hasItemsInCart={activeCartItems.length > 0}
      />

      {/* Voice-to-Cart Modal */}
      <VoiceMicModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onApplyVoiceActions={handleApplyVoiceActions}
      />

      {/* Login Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onSuccess={handleLoginSuccess}
        onClose={() => setIsLoginModalOpen(false)}
        canDismiss={Boolean(currentUser)}
      />
    </div>
  );
}
