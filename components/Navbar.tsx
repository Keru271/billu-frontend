'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  Users,
  Receipt,
  BarChart3,
  Settings,
  PauseCircle,
  Mic,
  Sparkles,
  LogOut,
  ChevronDown,
  ShieldCheck,
  UserCheck,
  LogIn,
  Lock,
} from 'lucide-react';
import { AuthUser } from '../lib/api';
import PWAInstallButton from './PWAInstallButton';

interface NavbarProps {
  activeTab: 'pos' | 'inventory' | 'customers' | 'history' | 'dashboard' | 'settings';
  setActiveTab: (tab: 'pos' | 'inventory' | 'customers' | 'history' | 'dashboard' | 'settings') => void;
  shopName: string;
  heldCount: number;
  onOpenHeld: () => void;
  onOpenVoice: () => void;
  isVoiceActive?: boolean;
  cartItemCount?: number;
  currentUser: AuthUser | null;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  shopName,
  heldCount,
  onOpenHeld,
  onOpenVoice,
  isVoiceActive = false,
  cartItemCount = 0,
  currentUser,
  onLogout,
  onOpenLogin,
}: NavbarProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingBillsCount, setPendingBillsCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSyncStatus = (e: any) => {
      if (e?.detail) {
        setIsOnline(e.detail.isOnline);
        setPendingBillsCount(e.detail.pendingCount);
      }
    };
    window.addEventListener('billo:sync-status', handleSyncStatus);

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('billo:sync-status', handleSyncStatus);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  interface NavItem {
    id: 'pos' | 'inventory' | 'customers' | 'history' | 'dashboard' | 'settings';
    label: string;
    shortLabel: string;
    icon: any;
    shortcut?: string;
    badge?: string;
    restricted?: boolean;
  }

  const isOwner = currentUser?.role === 'OWNER';
  const canReports = isOwner || Boolean(currentUser?.permissions?.reports);

  const navItems: NavItem[] = [
    { id: 'pos', label: 'POS Billing', shortLabel: 'Billing', icon: ShoppingCart, shortcut: 'F1' },
    { id: 'inventory', label: 'Inventory', shortLabel: 'Stock', icon: Package },
    { id: 'customers', label: 'Customers', shortLabel: 'Customers', icon: Users },
    { id: 'history', label: 'Bills History', shortLabel: 'Bills', icon: Receipt },
    {
      id: 'dashboard',
      label: 'Dashboard',
      shortLabel: 'Reports',
      icon: BarChart3,
      restricted: !canReports,
    },
    {
      id: 'settings',
      label: 'Settings',
      shortLabel: 'Settings',
      icon: Settings,
      badge: !isOwner && currentUser ? 'Staff' : undefined,
    },
  ];

  const getInitials = (name?: string) => {
    if (!name) return 'BD';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Top Bar (Universal Desktop & Mobile) */}
      <header className="h-14 sm:h-16 bg-[#FAFAF9] border-b border-[#D6D3D1] flex items-center justify-between px-3 sm:px-6 shrink-0 z-30 select-none">
        {/* Brand & Store */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#C2410C]/10 border border-[#C2410C]/25 flex items-center justify-center text-[#C2410C] font-semibold shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-display font-bold text-sm sm:text-base tracking-tight text-[#1C1917]">
                BillDesk
              </span>
              <span className="text-[10px] font-semibold bg-[#C2410C]/10 text-[#C2410C] px-1.5 py-0.5 rounded border border-[#C2410C]/20 uppercase">
                Retail OS
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-[#57534E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[220px] font-medium text-[#57534E]">
                {shopName || 'Shree Ganesh Supermarket'}
              </span>
            </div>
          </div>
        </div>

        {/* Center Nav tabs (Desktop Only >= 1024px) */}
        <nav className="hidden lg:flex items-center space-x-1 bg-[#F5F5F4] p-1 rounded-lg border border-[#D6D3D1]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer relative ${
                  isActive
                    ? 'bg-[#C2410C] text-white shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#E7E5E4]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                      isActive ? 'bg-[#9A3412] text-white' : 'bg-[#E7E5E4] text-[#78716C]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.restricted && (
                  <Lock className="w-3 h-3 text-[#78716C] ml-0.5" />
                )}
                {item.shortcut && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isActive ? 'bg-[#9A3412] text-white' : 'bg-[#E7E5E4] text-[#57534E]'
                    }`}
                  >
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right actions: Held Carts, Voice mic, User role */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Held Carts (F4) */}
          <button
            onClick={onOpenHeld}
            className="relative flex items-center space-x-1.5 h-9 px-3 rounded-lg bg-[#F5F5F4] border border-[#D6D3D1] text-[#1C1917] hover:bg-[#E7E5E4] text-xs font-semibold transition-all duration-150 cursor-pointer"
            title="Parked Carts (F4)"
          >
            <PauseCircle className="w-4 h-4 text-[#C2410C]" />
            <span className="hidden sm:inline">Held</span>
            {heldCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#F59E0B] text-white font-bold text-[10px] flex items-center justify-center font-mono">
                {heldCount}
              </span>
            )}
            <kbd className="hidden md:inline text-[9px] bg-[#E7E5E4] px-1 py-0.5 rounded text-[#57534E] font-mono">
              F4
            </kbd>
          </button>

          {/* Voice Billing Mic */}
          <button
            onClick={onOpenVoice}
            className={`flex items-center space-x-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
              isVoiceActive
                ? 'bg-[#C2410C] text-white shadow-[0_4px_12px_rgba(194,65,12,0.25)]'
                : 'bg-[#F5F5F4] text-[#57534E] hover:text-[#1C1917] hover:bg-[#E7E5E4] border border-[#D6D3D1]'
            }`}
            title="Voice-to-Cart billing"
          >
            <Mic className={`w-4 h-4 ${isVoiceActive ? 'text-white' : 'text-[#C2410C]'}`} />
            <span className="hidden sm:inline">Voice</span>
          </button>

          {/* PWA Install App Button */}
          <PWAInstallButton />

          {/* Online / Offline Status Indicator */}
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#D6D3D1] bg-[#FAFAF9]">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span className={isOnline ? 'text-[#57534E]' : 'text-amber-800'}>
              {isOnline
                ? pendingBillsCount > 0
                  ? `Syncing (${pendingBillsCount})`
                  : 'Online'
                : `Offline (${pendingBillsCount})`}
            </span>
          </div>

          {/* User Account / Profile Menu */}
          <div className="relative pl-1 sm:pl-2 border-l border-[#D6D3D1]" ref={menuRef}>
            {currentUser ? (
              <div>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 p-1 rounded-lg hover:bg-[#F5F5F4] transition-colors cursor-pointer text-left"
                >
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold font-mono ${
                      isOwner
                        ? 'bg-[#C2410C]/10 border-[#C2410C]/30 text-[#C2410C]'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-700'
                    }`}
                  >
                    {getInitials(currentUser.name)}
                  </div>
                  <div className="hidden xl:block text-left pr-1">
                    <div className="text-xs font-semibold text-[#1C1917] leading-tight flex items-center space-x-1">
                      <span className="truncate max-w-[120px]">{currentUser.name}</span>
                      <ChevronDown className="w-3 h-3 text-[#78716C]" />
                    </div>
                    <div className="text-[10px] text-[#78716C] font-medium leading-tight flex items-center space-x-1 mt-0.5">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                          isOwner ? 'bg-[#C2410C]' : 'bg-amber-600'
                        }`}
                      />
                      <span>{isOwner ? 'Owner' : 'Cashier'}</span>
                    </div>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-[#D6D3D1] rounded-xl shadow-xl z-50 p-2 animate-fadeIn text-xs">
                    <div className="p-2 border-b border-[#E7E5E4] mb-1">
                      <div className="font-semibold text-sm text-[#1C1917]">{currentUser.name}</div>
                      <div className="text-[#78716C] text-[11px] truncate">{currentUser.email}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isOwner
                              ? 'bg-[#C2410C]/10 text-[#C2410C] border border-[#C2410C]/20'
                              : 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                          }`}
                        >
                          {isOwner ? (
                            <>
                              <ShieldCheck className="w-3 h-3" />
                              <span>Store Owner</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3" />
                              <span>Cashier Member</span>
                            </>
                          )}
                        </span>
                        {!isOwner && currentUser.permissions?.discountLimit && (
                          <span className="text-[10px] font-semibold text-[#57534E] bg-stone-100 px-1.5 py-0.5 rounded">
                            Max {currentUser.permissions.discountLimit}% Off
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenLogin();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-[#57534E] hover:text-[#1C1917] hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 text-[#C2410C]" />
                      <span>Switch Account (Owner / Cashier)</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-red-600 hover:bg-red-50 transition-colors cursor-pointer font-medium"
                    >
                      <LogOut className="w-4 h-4 text-red-600" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center space-x-1.5 h-9 px-3 rounded-lg bg-[#C2410C] text-white hover:bg-[#9A3412] text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (< 1024px) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAFAF9]/95 backdrop-blur-md border-t border-[#D6D3D1] flex items-center justify-around py-1.5 px-1 shadow-lg select-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isPosWithItems = item.id === 'pos' && cartItemCount > 0;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-all duration-150 cursor-pointer relative ${
                isActive
                  ? 'text-[#C2410C] font-semibold'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 text-[#C2410C]' : 'text-[#57534E]'
                  }`}
                />
                {isPosWithItems && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-[#C2410C] text-white font-bold text-[9px] flex items-center justify-center font-mono">
                    {cartItemCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-semibold text-[#C2410C]' : 'font-medium'}`}>
                {item.shortLabel}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-6 h-0.5 rounded-full bg-[#C2410C]" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
