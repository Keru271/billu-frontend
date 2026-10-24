'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  PackageSearch,
  Search,
  X,
  RefreshCw,
  Download,
  ArrowUpDown,
  Clock,
  Receipt,
  Eye,
  CheckCircle2,
  ArrowRight,
  Layers,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { apiRequest } from '../lib/api';

interface DashboardViewProps {
  currentUser?: import('../lib/api').AuthUser | null;
}

interface ProductTransaction {
  billId: string;
  billNo: number;
  invoiceNo: string | null;
  createdAt: string;
  customerName: string | null;
  phone: string | null;
  qty: number;
  pricePaise: number;
  totalPaise: number;
  paymentMethod: string;
}

interface ProductSalesItem {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  categoryId: string | null;
  categoryName: string;
  stock: number;
  reorderLevel: number;
  pricePaise: number;
  qtySold: number;
  revenuePaise: number;
  billCount: number;
  avgPricePaise: number;
  lastSoldAt: string | null;
  recentTransactions: ProductTransaction[];
}

interface ProductSalesData {
  period: string;
  summary: {
    totalProducts: number;
    totalUnitsSold: number;
    totalRevenuePaise: number;
    productsWithSalesCount: number;
    topProduct: {
      id: string;
      name: string;
      qtySold: number;
      revenuePaise: number;
    } | null;
  };
  products: ProductSalesItem[];
}

export default function DashboardView({ currentUser }: DashboardViewProps = {}) {
  // View mode: 'all' (default, displays both overview & product-level sales), 'overview', or 'product-sales'
  const [viewFilter, setViewFilter] = useState<'all' | 'overview' | 'product-sales'>('all');

  // Overview Data State
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Product-Level Sales State
  const [productSalesData, setProductSalesData] = useState<ProductSalesData | null>(null);
  const [isProductSalesLoading, setIsProductSalesLoading] = useState(false);
  const [productSalesError, setProductSalesError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<
    'today' | 'yesterday' | '7days' | 'month' | 'year' | 'all' | 'custom'
  >('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'units_desc' | 'revenue_desc' | 'name_asc' | 'stock_asc'>('units_desc');
  const [selectedProduct, setSelectedProduct] = useState<ProductSalesItem | null>(null);

  const productSectionRef = useRef<HTMLDivElement>(null);

  const isOwner = currentUser?.role === 'OWNER';
  const canReports = isOwner || Boolean(currentUser?.permissions?.reports);

  // Fetch Store Overview
  const fetchOverview = async () => {
    if (currentUser && !canReports) {
      setIsOverviewLoading(false);
      setOverviewError('You do not have permission to view sales reports. Contact store owner.');
      return;
    }
    try {
      setIsOverviewLoading(true);
      setOverviewError(null);
      const res = await apiRequest('/api/reports/dashboard');
      if (res.success && res.data) {
        setOverviewData(res.data);
      } else {
        setOverviewError(res.error?.message || 'Could not load sales dashboard.');
      }
    } catch (e: any) {
      console.error(e);
      setOverviewError(e?.message || 'Failed to fetch dashboard data.');
    } finally {
      setIsOverviewLoading(false);
    }
  };

  // Fetch Product-Level Sales Data
  const fetchProductSales = async (periodOverride?: string) => {
    if (currentUser && !canReports) return;
    try {
      setIsProductSalesLoading(true);
      setProductSalesError(null);

      const period = periodOverride || selectedPeriod;
      let url = `/api/reports/product-sales?period=${encodeURIComponent(period)}`;
      if (period === 'custom') {
        if (customStartDate) url += `&startDate=${encodeURIComponent(customStartDate)}`;
        if (customEndDate) url += `&endDate=${encodeURIComponent(customEndDate)}`;
      }

      const res = await apiRequest(url);
      if (res.success && res.data) {
        setProductSalesData(res.data);
        if (selectedProduct) {
          const fresh = res.data.products?.find((p: ProductSalesItem) => p.id === selectedProduct.id);
          if (fresh) setSelectedProduct(fresh);
        }
      } else {
        setProductSalesError(res.error?.message || 'Could not load product sales.');
      }
    } catch (e: any) {
      console.error(e);
      setProductSalesError(e?.message || 'Failed to fetch product sales.');
    } finally {
      setIsProductSalesLoading(false);
    }
  };

  const overviewFetchedRef = useRef(false);
  const lastFetchedSalesKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (overviewFetchedRef.current) return;
    if (currentUser && !canReports) return;
    overviewFetchedRef.current = true;
    fetchOverview();
  }, [currentUser, canReports]);

  useEffect(() => {
    if (currentUser && !canReports) return;
    const key = `${selectedPeriod}_${customStartDate}_${customEndDate}`;
    if (lastFetchedSalesKeyRef.current === key) return;
    lastFetchedSalesKeyRef.current = key;
    fetchProductSales();
  }, [selectedPeriod, customStartDate, customEndDate, currentUser, canReports]);

  // Handle clicking a product from top products or chips
  const handleInspectProduct = (productNameOrId: string) => {
    if (productSalesData?.products) {
      const match = productSalesData.products.find(
        (p) =>
          p.id === productNameOrId ||
          p.name.toLowerCase() === productNameOrId.toLowerCase() ||
          p.name.toLowerCase().includes(productNameOrId.toLowerCase())
      );
      if (match) {
        setSelectedProduct(match);
        setSearchQuery(match.name);
      } else {
        setSearchQuery(productNameOrId);
      }
    } else {
      setSearchQuery(productNameOrId);
    }

    if (viewFilter === 'overview') {
      setViewFilter('all');
    }

    // Smooth scroll down to the product section
    setTimeout(() => {
      productSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Categories list derived from products
  const categoryOptions = useMemo(() => {
    if (!productSalesData?.products) return [];
    const set = new Set<string>();
    productSalesData.products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set).sort();
  }, [productSalesData]);

  // Filtered & sorted product list
  const filteredProducts = useMemo(() => {
    if (!productSalesData?.products) return [];
    let list = [...productSalesData.products];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (selectedCategory !== 'ALL') {
      list = list.filter((p) => p.categoryName === selectedCategory);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'units_desc') {
        if (b.qtySold !== a.qtySold) return b.qtySold - a.qtySold;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'revenue_desc') {
        if (b.revenuePaise !== a.revenuePaise) return b.revenuePaise - a.revenuePaise;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'stock_asc') {
        return a.stock - b.stock;
      }
      return 0;
    });

    return list;
  }, [productSalesData, searchQuery, selectedCategory, sortBy]);

  // Max sold units for relative bar chart width
  const maxUnitsSold = useMemo(() => {
    if (!filteredProducts.length) return 1;
    return Math.max(...filteredProducts.map((p) => p.qtySold), 1);
  }, [filteredProducts]);

  // CSV Export
  const exportToCsv = () => {
    if (!filteredProducts.length) return;
    const headers = [
      'Product Name',
      'Category',
      'Barcode / SKU',
      'Current Stock',
      'Units Sold',
      'Gross Revenue (INR)',
      'Total Bills',
      'Avg Selling Price (INR)',
    ];

    const rows = filteredProducts.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.categoryName || 'General'}"`,
      `"${p.barcode || p.sku || ''}"`,
      p.stock,
      p.qtySold,
      (p.revenuePaise / 100).toFixed(2),
      p.billCount,
      (p.avgPricePaise / 100).toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `billo-product-sales-${selectedPeriod}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isOverviewLoading && !overviewData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FAFAF9] text-[#78716C] text-sm font-sans">
        <div className="flex items-center space-x-2.5">
          <RefreshCw className="w-4 h-4 animate-spin text-[#C2410C]" />
          <span>Loading POS sales & retail analytics...</span>
        </div>
      </div>
    );
  }

  if (overviewError && !overviewData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#FAFAF9] text-[#1C1917] font-sans text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#1C1917]">Dashboard Access Restricted</h3>
        <p className="text-xs text-[#78716C] mt-1 max-w-sm">{overviewError}</p>
      </div>
    );
  }

  const { today, month, customers, inventory, topProducts } = overviewData || {
    today: { billCount: 0, pendingCount: 0, salesPaise: 0, cashPaise: 0, upiPaise: 0 },
    month: { billCount: 0, salesPaise: 0 },
    customers: { totalCount: 0 },
    inventory: { totalProducts: 0, lowStockCount: 0, lowStockItems: [] },
    topProducts: [],
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-[#FAFAF9] text-[#1C1917] font-sans select-none space-y-6">
      {/* Top Header & View Filter Options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6D3D1]">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917] flex items-center space-x-2.5">
            <BarChart3 className="w-5 h-5 text-[#C2410C]" />
            <span>Retail Analytics & Sales Intelligence</span>
          </h1>
          <p className="text-sm text-[#57534E] mt-0.5">
            Live shop performance, tender collection splits, and product-level sales breakdown
          </p>
        </div>

        {/* View Options Toggle */}
        <div className="flex items-center space-x-1.5 bg-[#E7E5E4] p-1 rounded-xl self-start sm:self-auto border border-[#D6D3D1]">
          <button
            onClick={() => setViewFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewFilter === 'all'
                ? 'bg-[#C2410C] text-white shadow-sm'
                : 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#F5F5F4]'
            }`}
          >
            All Analytics
          </button>
          <button
            onClick={() => setViewFilter('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewFilter === 'overview'
                ? 'bg-[#C2410C] text-white shadow-sm'
                : 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#F5F5F4]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => {
              setViewFilter('product-sales');
              productSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewFilter === 'product-sales'
                ? 'bg-[#C2410C] text-white shadow-sm'
                : 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#F5F5F4]'
            }`}
          >
            <PackageSearch className="w-3.5 h-3.5" />
            <span>Product Sales</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                viewFilter === 'product-sales'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#C2410C]/10 text-[#C2410C]'
              }`}
            >
              New
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: STORE OVERVIEW (Visible when 'all' or 'overview') */}
      {/* ========================================================================= */}
      {(viewFilter === 'all' || viewFilter === 'overview') && (
        <div className="space-y-6">
          {/* Top KPI Cards Grid */}
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#C2410C]" />
                  <span>Top Selling Products This Month</span>
                </h3>
                <button
                  onClick={() => {
                    productSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-xs font-semibold text-[#C2410C] hover:underline flex items-center space-x-1"
                >
                  <span>Detailed Analysis ↓</span>
                </button>
              </div>

              <div className="flex-1 space-y-2">
                {topProducts.length === 0 ? (
                  <p className="text-xs text-[#78716C] py-6 text-center">No sales recorded yet this month.</p>
                ) : (
                  topProducts.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => handleInspectProduct(item.name)}
                      className="p-3 bg-[#FAFAF9] rounded-xl border border-[#D6D3D1] hover:border-[#C2410C] hover:bg-[#FFEDD5]/20 flex items-center justify-between text-xs cursor-pointer transition-all group"
                      title={`Click to inspect sales for ${item.name}`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="w-5 text-center font-semibold text-[#78716C] font-mono">
                          #{idx + 1}
                        </span>
                        <div>
                          <span className="font-semibold text-[#1C1917] group-hover:text-[#C2410C] transition-colors block">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-[#78716C]">Click to view exact sales breakdown</span>
                        </div>
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
                      onClick={() => handleInspectProduct(item.name)}
                      className="p-3 bg-[#FAFAF9] rounded-xl border border-[#D6D3D1] hover:border-[#D97706] hover:bg-amber-50/40 flex items-center justify-between text-xs cursor-pointer transition-all"
                      title={`Click to view sales and stock for ${item.name}`}
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
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: DEDICATED PRODUCT-LEVEL SALES SECTION (Always visible or in 'product-sales') */}
      {/* ========================================================================= */}
      {(viewFilter === 'all' || viewFilter === 'product-sales') && (
        <div ref={productSectionRef} className="space-y-6 pt-4 border-t-2 border-[#D6D3D1]">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-1 bg-[#FFEDD5] text-[#C2410C] rounded-lg border border-[#C2410C]/20">
                  <PackageSearch className="w-4 h-4" />
                </span>
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#1C1917]">
                  Product-Level Sales & Demand Intelligence
                </h2>
                <span className="px-2 py-0.5 bg-[#C2410C] text-white text-[11px] font-semibold rounded-full">
                  New Feature
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#57534E] mt-1">
                View exact quantities sold (e.g. <strong>Tata Salt</strong>), gross turnover, stock on hand, and invoice history
              </p>
            </div>

            {/* Quick Chips for Popular Products */}
            <div className="flex items-center space-x-2 text-xs flex-wrap gap-y-1">
              <span className="text-[11px] text-[#78716C] font-semibold">Quick inspect:</span>
              {['Tata Salt', 'Rice 1kg'].map((item) => (
                <button
                  key={item}
                  onClick={() => handleInspectProduct(item)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    searchQuery.toLowerCase() === item.toLowerCase() || selectedProduct?.name === item
                      ? 'bg-[#C2410C] text-white border-[#C2410C]'
                      : 'bg-white hover:bg-[#FFEDD5] text-[#1C1917] border-[#D6D3D1] hover:border-[#C2410C]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Bar: Periods, Search, Filters */}
          <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
            {/* Top row: Period Selector Chips + Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                <span className="text-xs font-semibold text-[#57534E] mr-1 shrink-0 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-[#C2410C]" />
                  <span>Time Period:</span>
                </span>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: 'month', label: 'This Month' },
                  { id: 'year', label: 'This Year' },
                  { id: 'all', label: 'All Time' },
                  { id: 'custom', label: 'Custom' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriod(p.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                      selectedPeriod === p.id
                        ? 'bg-[#C2410C] text-white shadow-sm'
                        : 'bg-white border border-[#D6D3D1] text-[#57534E] hover:text-[#1C1917] hover:bg-[#FAFAF9]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons: Refresh & Export */}
              <div className="flex items-center space-x-2 self-end lg:self-auto shrink-0">
                <button
                  onClick={() => fetchProductSales()}
                  disabled={isProductSalesLoading}
                  className="px-3 py-1.5 bg-white border border-[#D6D3D1] hover:bg-[#FAFAF9] text-[#1C1917] rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  title="Refresh Sales Data"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-[#C2410C] ${isProductSalesLoading ? 'animate-spin' : ''}`}
                  />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={exportToCsv}
                  disabled={filteredProducts.length === 0}
                  className="px-3 py-1.5 bg-white border border-[#D6D3D1] hover:bg-[#FAFAF9] text-[#1C1917] rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  title="Export Product Sales as CSV Spreadsheet"
                >
                  <Download className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {selectedPeriod === 'custom' && (
              <div className="p-3 bg-white border border-[#D6D3D1] rounded-lg flex flex-wrap items-center gap-3 text-xs animate-fadeIn">
                <span className="font-semibold text-[#57534E]">Select Date Range:</span>
                <div className="flex items-center space-x-2">
                  <label className="text-[#78716C]">From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="border border-[#D6D3D1] rounded-lg px-2.5 py-1 text-xs text-[#1C1917] bg-[#FAFAF9] focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-[#78716C]">To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="border border-[#D6D3D1] rounded-lg px-2.5 py-1 text-xs text-[#1C1917] bg-[#FAFAF9] focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
                <button
                  onClick={() => fetchProductSales()}
                  className="px-3 py-1 bg-[#C2410C] text-white rounded-lg font-semibold hover:bg-[#9A3412]"
                >
                  Apply Dates
                </button>
              </div>
            )}

            {/* Second row: Search & Category Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 border-t border-[#D6D3D1]/60">
              {/* Search Product */}
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type product name (e.g. Tata Salt), barcode, SKU..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-[#D6D3D1] rounded-lg text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#C2410C] focus:ring-2 focus:ring-[#C2410C]/15"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedProduct(null);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full py-2 px-3 text-xs bg-white border border-[#D6D3D1] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                >
                  <option value="ALL">All Categories</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div className="sm:col-span-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full py-2 px-3 text-xs bg-white border border-[#D6D3D1] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                >
                  <option value="units_desc">Units Sold (High to Low)</option>
                  <option value="revenue_desc">Revenue (High to Low)</option>
                  <option value="name_asc">Product Name (A to Z)</option>
                  <option value="stock_asc">Stock Level (Low to High)</option>
                </select>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards for Product Sales */}
          {productSalesData?.summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6">
              {/* Total Units Sold */}
              <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)] transition-all">
                <div className="flex items-center justify-between text-xs text-[#57534E] font-semibold mb-2">
                  <span>Total Units Sold</span>
                  <span className="p-1.5 bg-[#FFEDD5] text-[#C2410C] rounded-lg border border-[#C2410C]/20">
                    <Package className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-3xl font-bold font-mono text-[#C2410C] tabular-nums tracking-tight">
                  {productSalesData.summary.totalUnitsSold}{' '}
                  <span className="text-sm font-sans font-normal text-[#78716C]">units</span>
                </div>
                <div className="text-xs text-[#78716C] mt-2">
                  Across {productSalesData.summary.productsWithSalesCount} products sold in period
                </div>
              </div>

              {/* Gross Product Revenue */}
              <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)] transition-all">
                <div className="flex items-center justify-between text-xs text-[#57534E] font-semibold mb-2">
                  <span>Product Sales Revenue</span>
                  <span className="p-1.5 bg-[#DCFCE7] text-[#16A34A] rounded-lg border border-[#16A34A]/20">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-3xl font-bold font-mono text-[#1C1917] tabular-nums tracking-tight">
                  ₹{(productSalesData.summary.totalRevenuePaise / 100).toFixed(2)}
                </div>
                <div className="text-xs text-[#78716C] mt-2">Total gross turnover from product sales</div>
              </div>

              {/* Catalog Coverage */}
              <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)] transition-all">
                <div className="flex items-center justify-between text-xs text-[#57534E] font-semibold mb-2">
                  <span>Catalog Selling Ratio</span>
                  <span className="p-1.5 bg-[#E7E5E4] text-[#57534E] rounded-lg border border-[#D6D3D1]">
                    <Layers className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-3xl font-bold font-mono text-[#1C1917] tabular-nums tracking-tight">
                  {productSalesData.summary.productsWithSalesCount}{' '}
                  <span className="text-sm font-sans font-normal text-[#78716C]">
                    / {productSalesData.summary.totalProducts} items
                  </span>
                </div>
                <div className="text-xs text-[#78716C] mt-2">Products with recorded customer sales</div>
              </div>

              {/* Best Seller in Period */}
              <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)] transition-all">
                <div className="flex items-center justify-between text-xs text-[#57534E] font-semibold mb-2">
                  <span>#1 Best Seller</span>
                  <span className="p-1.5 bg-[#FEF3C7] text-[#D97706] rounded-lg border border-[#D97706]/20">
                    <Sparkles className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-xl font-bold font-sans text-[#1C1917] truncate tracking-tight">
                  {productSalesData.summary.topProduct?.name || 'No sales yet'}
                </div>
                <div className="text-xs text-[#C2410C] font-mono font-semibold mt-2 tabular-nums">
                  {productSalesData.summary.topProduct
                    ? `${productSalesData.summary.topProduct.qtySold} sold • ₹${(productSalesData.summary.topProduct.revenuePaise / 100).toFixed(0)}`
                    : 'N/A'}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PRODUCT SPOTLIGHT / DEEP-DIVE PANEL (e.g. for Tata Salt) */}
          {/* ========================================================================= */}
          {selectedProduct && (
            <div className="bg-white border-2 border-[#C2410C] rounded-xl p-5 shadow-lg relative animate-fadeIn">
              {/* Spotlight Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D6D3D1]">
                <div className="flex items-start sm:items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-[#FFEDD5] text-[#C2410C] border border-[#C2410C]/20 flex items-center justify-center font-bold text-base">
                    {selectedProduct.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="font-display text-lg sm:text-xl font-bold text-[#1C1917]">
                        {selectedProduct.name}
                      </h2>
                      <span className="px-2 py-0.5 bg-[#F5F5F4] text-[#57534E] rounded text-[11px] font-semibold border border-[#D6D3D1]">
                        {selectedProduct.categoryName || 'General'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-[#78716C] mt-0.5">
                      {selectedProduct.barcode && <span>Barcode: {selectedProduct.barcode}</span>}
                      {selectedProduct.sku && <span>SKU: {selectedProduct.sku}</span>}
                      <span>Catalog Price: ₹{(selectedProduct.pricePaise / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="px-3 py-1.5 bg-[#F5F5F4] hover:bg-[#E7E5E4] border border-[#D6D3D1] text-[#57534E] hover:text-[#1C1917] rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Close Spotlight</span>
                  </button>
                </div>
              </div>

              {/* Key Metrics Grid for Selected Product */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 my-4">
                {/* Total Units Sold */}
                <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] tracking-wider block">
                    Quantity Sold
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#C2410C] mt-1 tabular-nums">
                    {selectedProduct.qtySold}
                  </div>
                  <span className="text-[10px] text-[#57534E]">packets / units</span>
                </div>

                {/* Gross Revenue */}
                <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] tracking-wider block">
                    Gross Revenue
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#1C1917] mt-1 tabular-nums">
                    ₹{(selectedProduct.revenuePaise / 100).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-[#57534E]">total sales in period</span>
                </div>

                {/* Bills Count */}
                <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] tracking-wider block">
                    Invoices / Orders
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#1C1917] mt-1 tabular-nums">
                    {selectedProduct.billCount}
                  </div>
                  <span className="text-[10px] text-[#57534E]">bills featuring item</span>
                </div>

                {/* Avg Selling Price */}
                <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] tracking-wider block">
                    Avg Selling Price
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#1C1917] mt-1 tabular-nums">
                    ₹{(selectedProduct.avgPricePaise / 100).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-[#57534E]">effective rate / unit</span>
                </div>

                {/* Current Stock */}
                <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] tracking-wider block">
                    Inventory Stock
                  </span>
                  <div
                    className={`text-2xl font-bold font-mono mt-1 tabular-nums ${
                      selectedProduct.stock <= 0
                        ? 'text-[#DC2626]'
                        : selectedProduct.stock <= selectedProduct.reorderLevel
                        ? 'text-[#D97706]'
                        : 'text-[#16A34A]'
                    }`}
                  >
                    {selectedProduct.stock}
                  </div>
                  <span className="text-[10px] text-[#57534E]">
                    {selectedProduct.stock <= 0
                      ? 'Out of stock'
                      : selectedProduct.stock <= selectedProduct.reorderLevel
                      ? 'Low stock alert'
                      : 'In stock'}
                  </span>
                </div>

                {/* Last Sold Date */}
                <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] tracking-wider block">
                    Last Sold Date
                  </span>
                  <div className="text-xs font-bold font-sans text-[#1C1917] mt-1">
                    {selectedProduct.lastSoldAt
                      ? new Date(selectedProduct.lastSoldAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Never'}
                  </div>
                  <span className="text-[10px] text-[#78716C]">
                    {selectedProduct.lastSoldAt
                      ? new Date(selectedProduct.lastSoldAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'No sales recorded'}
                  </span>
                </div>
              </div>

              {/* Transactions History for Selected Product */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#1C1917] uppercase tracking-wider flex items-center space-x-1.5">
                    <Receipt className="w-3.5 h-3.5 text-[#C2410C]" />
                    <span>Transaction Sales Log ({selectedProduct.recentTransactions.length} bills recorded)</span>
                  </h4>
                  <span className="text-[11px] text-[#78716C]">Exact bill-by-bill history of {selectedProduct.name}</span>
                </div>

                {selectedProduct.recentTransactions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#78716C] bg-[#FAFAF9] rounded-xl border border-[#D6D3D1]">
                    No sales recorded for {selectedProduct.name} in the selected period ({selectedPeriod}).
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#D6D3D1] rounded-xl bg-white max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs text-[#1C1917]">
                      <thead className="bg-[#F5F5F4] text-[#57534E] font-semibold sticky top-0 border-b border-[#D6D3D1]">
                        <tr>
                          <th className="py-2.5 px-3">Bill #</th>
                          <th className="py-2.5 px-3">Date & Time</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3 text-center">Qty Purchased</th>
                          <th className="py-2.5 px-3 text-right">Unit Price</th>
                          <th className="py-2.5 px-3 text-right">Total Amount</th>
                          <th className="py-2.5 px-3 text-center">Tender</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D6D3D1]/60 font-sans">
                        {selectedProduct.recentTransactions.map((tx, idx) => (
                          <tr key={idx} className="hover:bg-[#FAFAF9] transition-colors">
                            <td className="py-2 px-3 font-mono font-bold text-[#C2410C]">
                              #{tx.billNo}
                              {tx.invoiceNo && (
                                <span className="block text-[10px] text-[#78716C] font-normal">{tx.invoiceNo}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-[#57534E]">
                              {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}{' '}
                              <span className="text-[10px] text-[#78716C]">
                                {new Date(tx.createdAt).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-[#1C1917]">
                              {tx.customerName || 'Walk-in Customer'}
                              {tx.phone && (
                                <span className="block text-[10px] text-[#78716C] font-mono">{tx.phone}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-[#1C1917]">
                              {tx.qty} {tx.qty === 1 ? 'unit' : 'units'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-[#57534E]">
                              ₹{(tx.pricePaise / 100).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-[#1C1917] tabular-nums">
                              ₹{(tx.totalPaise / 100).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  tx.paymentMethod === 'CASH'
                                    ? 'bg-[#DCFCE7] text-[#16A34A] border-[#16A34A]/30'
                                    : 'bg-[#FFEDD5] text-[#C2410C] border-[#C2410C]/30'
                                }`}
                              >
                                {tx.paymentMethod}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ALL-PRODUCTS SALES BREAKDOWN TABLE */}
          {/* ========================================================================= */}
          <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 flex flex-col shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center space-x-2">
                  <Package className="w-4 h-4 text-[#C2410C]" />
                  <span>
                    Product Sales Table ({filteredProducts.length}{' '}
                    {filteredProducts.length === 1 ? 'item' : 'items'})
                  </span>
                </h3>
                <p className="text-xs text-[#78716C] mt-0.5">
                  Click any product row or &quot;Details&quot; to inspect exact bills and transactions
                </p>
              </div>

              {searchQuery && (
                <div className="flex items-center space-x-2 text-xs text-[#57534E]">
                  <span>
                    Filtered by: <strong className="text-[#1C1917]">&quot;{searchQuery}&quot;</strong>
                  </span>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedProduct(null);
                    }}
                    className="text-[#C2410C] hover:underline font-semibold"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            {isProductSalesLoading && !productSalesData ? (
              <div className="py-12 flex items-center justify-center text-xs text-[#78716C] space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#C2410C]" />
                <span>Loading product sales records...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#78716C] bg-[#FAFAF9] rounded-xl border border-[#D6D3D1]">
                <PackageSearch className="w-8 h-8 text-[#78716C]/60 mx-auto mb-2" />
                <p className="font-semibold text-[#1C1917]">No products found</p>
                <p className="mt-1">
                  {searchQuery
                    ? `No product sales match "${searchQuery}". Try a different keyword.`
                    : 'No products are recorded for this store.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedProduct(null);
                    }}
                    className="mt-3 px-3 py-1 bg-white border border-[#D6D3D1] text-[#C2410C] rounded-lg text-xs font-semibold hover:bg-[#FAFAF9]"
                  >
                    Reset Search
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#D6D3D1] rounded-xl bg-white">
                <table className="w-full text-left text-xs text-[#1C1917]">
                  <thead className="bg-[#F5F5F4] text-[#57534E] font-semibold border-b border-[#D6D3D1]">
                    <tr>
                      <th className="py-3 px-3.5">Product Name & Category</th>
                      <th className="py-3 px-3">Price</th>
                      <th className="py-3 px-3 text-center">Stock Status</th>
                      <th className="py-3 px-4 min-w-[180px]">Units Sold</th>
                      <th className="py-3 px-3 text-right">Total Revenue</th>
                      <th className="py-3 px-3 text-center">Bills</th>
                      <th className="py-3 px-3 text-right">Avg Rate</th>
                      <th className="py-3 px-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D6D3D1]/60 font-sans">
                    {filteredProducts.map((p) => {
                      const isSelected = selectedProduct?.id === p.id;
                      const percentage = Math.round((p.qtySold / maxUnitsSold) * 100);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedProduct(p)}
                          className={`hover:bg-[#FFEDD5]/20 cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#FFEDD5]/30 border-l-4 border-l-[#C2410C]' : ''
                          }`}
                        >
                          {/* Product Name */}
                          <td className="py-3 px-3.5">
                            <div className="font-semibold text-[#1C1917] flex items-center space-x-1.5">
                              <span>{p.name}</span>
                              {p.qtySold > 0 && (
                                <span className="px-1.5 py-0.2 bg-[#FFEDD5] text-[#C2410C] rounded text-[10px] font-mono font-bold">
                                  {p.qtySold} sold
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-[11px] text-[#78716C] mt-0.5">
                              <span className="bg-[#F5F5F4] px-1.5 py-0.2 rounded border border-[#D6D3D1]">
                                {p.categoryName || 'General'}
                              </span>
                              {p.barcode && <span>• Barcode: {p.barcode}</span>}
                              {p.sku && <span>• SKU: {p.sku}</span>}
                            </div>
                          </td>

                          {/* Price */}
                          <td className="py-3 px-3 font-mono tabular-nums text-[#57534E]">
                            ₹{(p.pricePaise / 100).toFixed(2)}
                          </td>

                          {/* Stock Status */}
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border tabular-nums ${
                                p.stock <= 0
                                  ? 'bg-rose-50 text-[#DC2626] border-rose-200'
                                  : p.stock <= p.reorderLevel
                                  ? 'bg-amber-50 text-[#D97706] border-amber-200'
                                  : 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                              }`}
                            >
                              {p.stock <= 0 ? 'Out of stock' : `${p.stock} in stock`}
                            </span>
                          </td>

                          {/* Units Sold with Relative Progress Bar */}
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-mono font-bold text-[#1C1917] tabular-nums">
                                {p.qtySold}{' '}
                                <span className="text-[10px] font-sans font-normal text-[#78716C]">
                                  {p.qtySold === 1 ? 'unit' : 'units'}
                                </span>
                              </span>
                              {p.qtySold > 0 && (
                                <span className="text-[10px] font-mono text-[#78716C]">{percentage}%</span>
                              )}
                            </div>
                            <div className="w-full h-1.5 bg-[#E7E5E4] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#C2410C] rounded-full transition-all duration-300"
                                style={{ width: `${p.qtySold > 0 ? percentage : 0}%` }}
                              />
                            </div>
                          </td>

                          {/* Total Revenue */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-[#1C1917] tabular-nums">
                            ₹{(p.revenuePaise / 100).toFixed(2)}
                          </td>

                          {/* Bills Count */}
                          <td className="py-3 px-3 text-center font-mono tabular-nums text-[#57534E]">
                            {p.billCount}
                          </td>

                          {/* Avg Rate */}
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-[#57534E]">
                            ₹{(p.avgPricePaise / 100).toFixed(2)}
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedProduct(p)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 mx-auto transition-colors ${
                                isSelected
                                  ? 'bg-[#C2410C] text-white'
                                  : 'bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#1C1917] border border-[#D6D3D1]'
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              <span>{isSelected ? 'Viewing' : 'Details'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
