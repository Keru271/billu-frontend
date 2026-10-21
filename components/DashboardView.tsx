'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Banknote,
  QrCode,
  Users,
  AlertTriangle,
  Package,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../lib/api';

interface DashboardViewProps {
  currentUser?: import('../lib/api').AuthUser | null;
}

export default function DashboardView({ currentUser }: DashboardViewProps = {}) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOwner = currentUser?.role === 'OWNER';
  const canReports = isOwner || Boolean(currentUser?.permissions?.reports);

  const fetchDashboard = async () => {
    if (currentUser && !canReports) {
      setIsLoading(false);
      setErrorMessage('You do not have permission to view sales reports. Contact store owner.');
      return;
    }
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await apiRequest('/api/reports/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setErrorMessage(res.error?.message || 'Could not load sales dashboard.');
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e?.message || 'Failed to fetch dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FAFAF9] text-[#78716C] text-sm font-sans">
        Loading POS sales dashboard...
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#FAFAF9] text-[#1C1917] font-sans text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#1C1917]">Dashboard Access Restricted</h3>
        <p className="text-xs text-[#78716C] mt-1 max-w-sm">
          {errorMessage || 'You lack authorization to access sales data.'}
        </p>
      </div>
    );
  }

  const { today, month, customers, inventory, topProducts } = data;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-[#FAFAF9] text-[#1C1917] font-sans select-none space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917] flex items-center space-x-2.5">
          <BarChart3 className="w-5 h-5 text-[#C2410C]" />
          <span>Real-time Retail Analytics & Financial Health</span>
        </h1>
        <p className="text-sm text-[#57534E] mt-0.5">
          Live daily sales, multi-tender collection splits, customer directory, and inventory alerts
        </p>
      </div>

      {/* KPI Cards Grid (4px spacing grid, 12px radius, 16px/24px gaps per DESIGN.md) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6">
        {/* Today Total Sales */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)] transition-all">
          <div className="flex items-center justify-between text-xs text-[#57534E] font-semibold mb-2">
            <span>Today Sales ({today.billCount} bills)</span>
            <span className="p-1.5 bg-[#FFEDD5] text-[#C2410C] rounded-lg border border-[#C2410C]/20">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold font-mono text-[#1C1917] tabular-nums tracking-tight">
            ₹{(today.salesPaise / 100).toFixed(2)}
          </div>
          {today.pendingCount > 0 && (
            <div className="text-xs text-[#C2410C] font-semibold mt-2 animate-pulse">
              • {today.pendingCount} pending UPI confirmation
            </div>
          )}
        </div>

        {/* This Month Total */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)] transition-all">
          <div className="flex items-center justify-between text-xs text-[#57534E] font-semibold mb-2">
            <span>This Month ({month.billCount} bills)</span>
            <span className="p-1.5 bg-[#E7E5E4] text-[#57534E] rounded-lg border border-[#D6D3D1]">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold font-mono text-[#1C1917] tabular-nums tracking-tight">
            ₹{(month.salesPaise / 100).toFixed(2)}
          </div>
          <div className="text-xs text-[#78716C] mt-2">Gross retail sales in current month</div>
        </div>

        {/* Registered Customers */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)] transition-all">
          <div className="flex items-center justify-between text-xs text-[#57534E] font-semibold mb-2">
            <span>Registered Customers</span>
            <span className="p-1.5 bg-[#FFEDD5] text-[#C2410C] rounded-lg border border-[#C2410C]/20">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold font-mono text-[#1C1917] tabular-nums tracking-tight">
            {customers?.totalCount ?? 0}
          </div>
          <div className="text-xs text-[#78716C] mt-2">Profiles in customer directory</div>
        </div>

        {/* Catalog Items & Low Stock */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)] transition-all">
          <div className="flex items-center justify-between text-xs text-[#57534E] font-semibold mb-2">
            <span>Catalog Items ({inventory.totalProducts})</span>
            <span className="p-1.5 bg-[#E7E5E4] text-[#57534E] rounded-lg border border-[#D6D3D1]">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold font-mono text-[#1C1917] tabular-nums tracking-tight">
            {inventory.lowStockCount}{' '}
            <span className="text-sm font-semibold text-[#D97706]">Low Stock</span>
          </div>
          <div className="text-xs text-[#78716C] mt-2">Items below reorder safety threshold</div>
        </div>
      </div>

      {/* Tender Breakdown Cards */}
      <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-4">
          Today Multi-Tender Payment Split
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cash */}
          <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5 text-xs text-[#57534E] font-semibold">
                <Banknote className="w-4 h-4 text-[#16A34A]" />
                <span>Cash Received</span>
              </div>
              <span className="text-xs font-semibold text-[#16A34A] bg-[#F5F5F4] border border-[#D6D3D1] px-2 py-0.5 rounded font-mono">
                {today.salesPaise > 0
                  ? `${((today.cashPaise / today.salesPaise) * 100).toFixed(0)}%`
                  : '0%'}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-[#1C1917] tabular-nums">
              ₹{(today.cashPaise / 100).toFixed(2)}
            </div>
            {/* Progress Bar (4px height, stone-200 track, terracotta fill per DESIGN.md) */}
            <div className="w-full h-1 bg-[#E7E5E4] rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-[#16A34A] transition-all duration-300 ease-out"
                style={{
                  width: `${today.salesPaise > 0 ? (today.cashPaise / today.salesPaise) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* UPI */}
          <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5 text-xs text-[#57534E] font-semibold">
                <QrCode className="w-4 h-4 text-[#C2410C]" />
                <span>UPI Digital Payments</span>
              </div>
              <span className="text-xs font-semibold text-[#C2410C] bg-[#F5F5F4] border border-[#D6D3D1] px-2 py-0.5 rounded font-mono">
                {today.salesPaise > 0
                  ? `${((today.upiPaise / today.salesPaise) * 100).toFixed(0)}%`
                  : '0%'}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-[#1C1917] tabular-nums">
              ₹{(today.upiPaise / 100).toFixed(2)}
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1 bg-[#E7E5E4] rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-[#C2410C] transition-all duration-300 ease-out"
                style={{
                  width: `${today.salesPaise > 0 ? (today.upiPaise / today.salesPaise) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section: Top Products & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-6">
        {/* Top Selling Products */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 flex flex-col">
          <h3 className="font-display text-base font-bold text-[#1C1917] mb-3 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#C2410C]" />
            <span>Top Selling Products This Month</span>
          </h3>

          <div className="flex-1 space-y-2">
            {topProducts.length === 0 ? (
              <p className="text-xs text-[#78716C] py-6 text-center">No sales recorded yet this month.</p>
            ) : (
              topProducts.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-[#FAFAF9] rounded-xl border border-[#D6D3D1] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="w-5 text-center font-semibold text-[#78716C] font-mono">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-[#1C1917]">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-[#1C1917] font-mono tabular-nums block">
                      {item.qty} units sold
                    </span>
                    <span className="text-[10px] text-[#78716C] font-mono tabular-nums">
                      ₹{(item.revenuePaise / 100).toFixed(0)} revenue
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Watchlist */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 flex flex-col">
          <h3 className="font-display text-base font-bold text-[#1C1917] mb-3 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#D97706]" />
            <span>Low Stock Watchlist ({inventory.lowStockCount})</span>
          </h3>

          <div className="flex-1 space-y-2">
            {inventory.lowStockItems.length === 0 ? (
              <p className="text-xs text-[#16A34A] py-6 text-center font-medium">
                All inventory levels are above reorder safety limits!
              </p>
            ) : (
              inventory.lowStockItems.map((item: any) => (
                <div
                  key={item.id}
                  className="p-3 bg-[#FAFAF9] rounded-xl border border-[#D6D3D1] flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-[#1C1917] block">{item.name}</span>
                    <span className="text-[10px] text-[#78716C]">
                      Reorder Threshold: {item.reorderLevel} units
                    </span>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-50 text-[#D97706] font-semibold rounded border border-amber-200 tabular-nums">
                    {item.stock} left
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
