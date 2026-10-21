'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  UserPlus,
  CreditCard,
  QrCode,
  Banknote,
  Percent,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { apiRequest, AuthUser } from '../lib/api';
import { calculateDenominations } from '../lib/denominations';
import ReturnChangeModal from './ReturnChangeModal';
import UpiModal from './UpiModal';
import ReceiptModal from './ReceiptModal';
import { BillReceiptData, printThermalReceipt } from '../lib/receipt';
import { createAndQueueOfflineBill } from '../lib/offlineSync';

export interface Product {
  id: string;
  name: string;
  categoryId?: string | null;
  categoryName?: string;
  pricePaise: number;
  taxPct: number;
  discountPct?: number;
  stock: number;
  barcode?: string | null;
  hsn?: string | null;
  reorderLevel: number;
  imageUrl?: string | null;
  isLowStock?: boolean;
}

export interface CategoryItem {
  id: string;
  name: string;
  imageUrl?: string | null;
  productCount?: number;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balancePaise?: number;
  creditLimitPaise?: number;
}

interface POSBillingProps {
  products: Product[];
  categories: CategoryItem[];
  customers: Customer[];
  refreshData: () => Promise<void>;
  onParkCart: (labelOrItems?: any) => void;
  activeCartItems: CartItem[];
  setActiveCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  shopSettings?: any;
  currentUser?: AuthUser | null;
}

export default function POSBilling({
  products,
  categories,
  customers,
  refreshData,
  onParkCart,
  activeCartItems,
  setActiveCartItems,
  shopSettings,
  currentUser,
}: POSBillingProps) {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Active Checkout state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [discountPaise, setDiscountPaise] = useState<number>(0);
  const [discountInput, setDiscountInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'SPLIT'>('CASH');
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // Cash Tender calculator
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');
  const [splitCashInput, setSplitCashInput] = useState<string>('');
  const [splitUpiInput, setSplitUpiInput] = useState<string>('');

  // Modals
  const [returnChangeData, setReturnChangeData] = useState<{
    isOpen: boolean;
    billNo: number;
    totalPaise: number;
    cashReceivedPaise: number;
    changeGivenPaise: number;
    receiptData: BillReceiptData | null;
  }>({
    isOpen: false,
    billNo: 0,
    totalPaise: 0,
    cashReceivedPaise: 0,
    changeGivenPaise: 0,
    receiptData: null,
  });

  const [upiModalData, setUpiModalData] = useState<{
    isOpen: boolean;
    billId: string;
    billNo: number;
    totalPaise: number;
    upiUri: string | null;
    receiptData: BillReceiptData | null;
  }>({
    isOpen: false,
    billId: '',
    billNo: 0,
    totalPaise: 0,
    upiUri: null,
    receiptData: null,
  });

  const [receiptModalData, setReceiptModalData] = useState<{
    isOpen: boolean;
    data: BillReceiptData | null;
  }>({
    isOpen: false,
    data: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // 1. Calculations: Subtotal, GST, Roundoff, Grand Total
  const priceIncludesTax = shopSettings?.priceIncludesTax ?? true;

  const { subtotalPaise, totalTaxPaise, cgstPaise, sgstPaise, roundOffPaise, grandTotalPaise } =
    useMemo(() => {
      let sub = 0;
      let rawTax = 0;

      for (const item of activeCartItems) {
        const prodDiscountPct = item.product.discountPct || 0;
        const unitDiscountPaise = Math.round((item.product.pricePaise * prodDiscountPct) / 100);
        const effectiveUnitPrice = item.product.pricePaise - unitDiscountPaise;
        const linePrice = effectiveUnitPrice * item.qty;
        sub += linePrice;

        const allowOverride = shopSettings?.allowProductGstOverride ?? true;
        const storeDefaultTax = Number(shopSettings?.defaultTax ?? 0);
        const itemTaxPct = allowOverride
          ? (item.product.taxPct !== undefined && item.product.taxPct !== null ? Number(item.product.taxPct) : storeDefaultTax)
          : storeDefaultTax;

        if (priceIncludesTax) {
          // Extract GST from price (MRP inclusive)
          const lineTax = itemTaxPct > 0 ? linePrice - Math.round((linePrice * 100) / (100 + itemTaxPct)) : 0;
          rawTax += lineTax;
        } else {
          // GST added on top (wholesale exclusive)
          const lineTax = itemTaxPct > 0 ? Math.round((linePrice * itemTaxPct) / 100) : 0;
          rawTax += lineTax;
        }
      }

      const netPaise = Math.max(0, sub - discountPaise);
      // Scale tax if bill-level discount is applied
      const effectiveTaxPaise = sub > 0 ? Math.round((rawTax * netPaise) / sub) : 0;

      let gross = 0;
      if (priceIncludesTax) {
        gross = netPaise;
      } else {
        gross = netPaise + effectiveTaxPaise;
      }

      let round = 0;
      let finalTotal = gross;
      if (shopSettings?.roundOff) {
        const remainder = gross % 100;
        if (remainder >= 50) {
          round = 100 - remainder;
          finalTotal = gross + round;
        } else if (remainder > 0) {
          round = -remainder;
          finalTotal = gross + round;
        }
      }

      const halfTax = Math.floor(effectiveTaxPaise / 2);
      return {
        subtotalPaise: sub,
        totalTaxPaise: effectiveTaxPaise,
        cgstPaise: halfTax,
        sgstPaise: effectiveTaxPaise - halfTax,
        roundOffPaise: round,
        grandTotalPaise: finalTotal,
      };
    }, [activeCartItems, discountPaise, shopSettings, priceIncludesTax]);

  // Cash Tender figures
  const grandTotalRupees = grandTotalPaise / 100;
  const cashReceivedRupees = parseFloat(cashReceivedInput) || 0;
  const cashReceivedPaise = Math.round(cashReceivedRupees * 100);

  const changeGivenPaise =
    paymentMethod === 'CASH'
      ? Math.max(0, cashReceivedPaise - grandTotalPaise)
      : paymentMethod === 'SPLIT'
      ? Math.max(0, cashReceivedPaise - Math.round((parseFloat(splitCashInput) || 0) * 100))
      : 0;

  const isCashShort =
    paymentMethod === 'CASH' && cashReceivedInput !== '' && cashReceivedPaise < grandTotalPaise;
  const cashShortAmount = isCashShort ? (grandTotalPaise - cashReceivedPaise) / 100 : 0;

  const liveDenominations = calculateDenominations(changeGivenPaise / 100);

  // Keyboard Shortcuts (F2, F4, F6, F8, F9, Enter, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside an open modal
      if (returnChangeData.isOpen || upiModalData.isOpen || receiptModalData.isOpen) return;

      if (e.key === 'F2' || e.key === '/') {
        if ((e.target as HTMLElement)?.tagName !== 'INPUT') {
          e.preventDefault();
          barcodeInputRef.current?.focus();
        }
      } else if (e.key === 'F6') {
        e.preventDefault();
        setIsCustomerModalOpen(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setPaymentMethod('CASH');
      } else if (e.key === 'F9') {
        e.preventDefault();
        setPaymentMethod('UPI');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [returnChangeData.isOpen, upiModalData.isOpen, receiptModalData.isOpen]);

  // Audio feedback for barcode scanning & additions (DESIGN.md 5.1)
  const playBarcodeBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1050, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  };

  // Smart Cash Suggestions (DESIGN.md 5.2: Exact, +10, +50, +100, +500)
  const smartCashSuggestions = useMemo(() => {
    const total = grandTotalRupees;
    if (total <= 0) return [100, 200, 500];
    const list: number[] = [];

    // Exact amount
    list.push(total);

    const ceilTotal = Math.ceil(total);
    if (ceilTotal > total && !list.includes(ceilTotal)) {
      list.push(ceilTotal);
    }

    const next10 = Math.ceil(ceilTotal / 10) * 10;
    if (next10 > ceilTotal && !list.includes(next10)) list.push(next10);

    const next50 = Math.ceil(ceilTotal / 50) * 50;
    if (next50 > ceilTotal && !list.includes(next50)) list.push(next50);

    const next100 = Math.ceil(ceilTotal / 100) * 100;
    if (next100 > ceilTotal && !list.includes(next100)) list.push(next100);

    const next500 = Math.ceil(ceilTotal / 500) * 500;
    if (next500 > ceilTotal && !list.includes(next500)) list.push(next500);

    [100, 200, 500, 1000].forEach((n) => {
      if (n > ceilTotal && !list.includes(n)) list.push(n);
    });

    return list.slice(0, 6);
  }, [grandTotalRupees]);

  // Barcode / Catalog Quick Add
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim().toLowerCase();
    // 1. Try exact barcode match
    let matched = products.find((p) => p.barcode?.toLowerCase() === query);
    // 2. Try exact name match
    if (!matched) {
      matched = products.find((p) => p.name.toLowerCase() === query);
    }
    // 3. Try partial name match
    if (!matched) {
      matched = products.find((p) => p.name.toLowerCase().includes(query));
    }

    if (matched) {
      playBarcodeBeep();
      addToCart(matched);
      setSearchQuery('');
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert(`"${product.name}" is out of stock!`);
      return;
    }

    playBarcodeBeep();

    setActiveCartItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        if (prev[idx].qty >= product.stock) {
          alert(`Cannot add more than available stock (${product.stock} units).`);
          return prev;
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return updated;
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setActiveCartItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.qty + delta;
            if (newQty > item.product.stock) {
              alert(`Cannot exceed available stock of ${item.product.stock} units.`);
              return item;
            }
            return { ...item, qty: newQty };
          }
          return item;
        })
        .filter((item) => item.qty > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setActiveCartItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    if (activeCartItems.length === 0) return;
    if (confirm('Clear active cart?')) {
      setActiveCartItems([]);
      setDiscountPaise(0);
      setDiscountInput('');
      setCashReceivedInput('');
      setMobileTab('catalog');
    }
  };

  // Quick Cash Chips
  const setQuickCash = (amount: number) => {
    setCashReceivedInput(amount.toString());
  };

  // Save & Checkout
  const handleCheckout = async () => {
    if (activeCartItems.length === 0) {
      alert('Cart is empty. Add products to proceed.');
      return;
    }

    if (isCashShort) {
      alert(`Customer cash is short by ₹${cashShortAmount.toFixed(2)}.`);
      return;
    }

    // Enforce cashier discount limit (Role-Based Access Control)
    if (discountPaise > 0 && currentUser?.role !== 'OWNER' && currentUser?.permissions?.discountLimit !== undefined) {
      const maxDiscountPct = currentUser.permissions.discountLimit;
      const maxDiscountPaise = Math.round((subtotalPaise * maxDiscountPct) / 100);
      if (discountPaise > maxDiscountPaise) {
        alert(
          `Discount ₹${(discountPaise / 100).toFixed(2)} exceeds your authorized ${maxDiscountPct}% cashier limit (Max: ₹${(maxDiscountPaise / 100).toFixed(2)}).`
        );
        return;
      }
    }

    // Prepare payments
    const paymentsPayload: any[] = [];
    if (paymentMethod === 'CASH') {
      const received = cashReceivedPaise > 0 ? cashReceivedPaise : grandTotalPaise;
      paymentsPayload.push({
        method: 'CASH',
        amountPaise: grandTotalPaise,
        cashReceivedPaise: received,
      });
    } else if (paymentMethod === 'UPI') {
      paymentsPayload.push({
        method: 'UPI',
        amountPaise: grandTotalPaise,
      });
    } else if (paymentMethod === 'SPLIT') {
      const splitCashPaise = Math.round((parseFloat(splitCashInput) || 0) * 100);
      const splitUpiPaise = Math.round((parseFloat(splitUpiInput) || 0) * 100);

      if (splitCashPaise + splitUpiPaise !== grandTotalPaise) {
        alert(`Split amounts (₹${splitCashPaise / 100} + ₹${splitUpiPaise / 100}) must equal grand total ₹${grandTotalRupees}.`);
        return;
      }

      paymentsPayload.push({
        method: 'CASH',
        amountPaise: splitCashPaise,
        cashReceivedPaise: cashReceivedPaise > 0 ? cashReceivedPaise : splitCashPaise,
      });
      paymentsPayload.push({
        method: 'UPI',
        amountPaise: splitUpiPaise,
      });
    }

    try {
      setIsSubmitting(true);
      const payload = {
        items: activeCartItems.map((i) => ({
          productId: i.product.id,
          qty: i.qty,
        })),
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || null,
        phone: selectedCustomer?.phone || null,
        discountPaise,
        payments: paymentsPayload,
      };

      let bill: any = null;
      let isOfflineSale = false;

      // If browser is already offline, queue immediately without waiting for timeout
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        bill = createAndQueueOfflineBill(payload, {
          subtotalPaise,
          discountPaise,
          totalTaxPaise,
          grandTotalPaise,
          cartItems: activeCartItems,
        });
        isOfflineSale = true;
      } else {
        const res = await apiRequest('/api/bills', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (res.success && res.data) {
          bill = res.data;
        } else {
          // If network error occurred, seamlessly store offline
          const isNetworkErr =
            typeof navigator !== 'undefined' &&
            (!navigator.onLine || /network|failed to fetch|abort|connection/i.test(res.error?.message || ''));

          if (isNetworkErr) {
            bill = createAndQueueOfflineBill(payload, {
              subtotalPaise,
              discountPaise,
              totalTaxPaise,
              grandTotalPaise,
              cartItems: activeCartItems,
            });
            isOfflineSale = true;
          } else {
            alert(`Checkout Error: ${res.error?.message || 'Transaction failed'}`);
            return;
          }
        }
      }

      // Construct Receipt Data
      const receiptData: BillReceiptData = {
        shopName: shopSettings?.name || 'Shree Ganesh Supermarket',
        shopAddress: shopSettings?.address,
        shopPhone: shopSettings?.phone,
        gstin: shopSettings?.gstin,
        billNo: bill.billNo,
        date: new Date(bill.createdAt).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        cashierName: currentUser?.name || 'Counter 01',
        customerName: selectedCustomer?.name || null,
        customerPhone: selectedCustomer?.phone || null,
        items: activeCartItems.map((i) => {
          const prodDiscountPct = i.product.discountPct || 0;
          const unitDiscountPaise = Math.round((i.product.pricePaise * prodDiscountPct) / 100);
          const effectiveUnitPrice = i.product.pricePaise - unitDiscountPaise;
          const allowOverride = shopSettings?.allowProductGstOverride ?? true;
          const storeDefaultTax = Number(shopSettings?.defaultTax ?? 0);
          const effectiveTaxPct = allowOverride
            ? (i.product.taxPct !== undefined && i.product.taxPct !== null ? Number(i.product.taxPct) : storeDefaultTax)
            : storeDefaultTax;
          return {
            name: i.product.name,
            qty: i.qty,
            pricePaise: effectiveUnitPrice,
            taxPct: effectiveTaxPct,
          };
        }),
        subtotalPaise,
        discountPaise,
        taxPaise: totalTaxPaise,
        cgstPaise,
        sgstPaise,
        roundOffPaise,
        totalPaise: grandTotalPaise,
        priceIncludesTax,
        payments: bill.payments || paymentsPayload,
      };

      // Reset cart
      setActiveCartItems([]);
      setDiscountPaise(0);
      setDiscountInput('');
      setCashReceivedInput('');
      setSelectedCustomer(null);
      setMobileTab('catalog');
      await refreshData();

      // Branch to appropriate modal based on payment type
      if (paymentMethod === 'CASH') {
        const cashPayment = bill.payments?.find((p: any) => p.method === 'CASH');
        setReturnChangeData({
          isOpen: true,
          billNo: bill.billNo,
          totalPaise: grandTotalPaise,
          cashReceivedPaise: cashPayment?.cashReceivedPaise || cashReceivedPaise,
          changeGivenPaise: cashPayment?.changeGivenPaise || changeGivenPaise,
          receiptData,
        });
      } else if (paymentMethod === 'UPI' || bill.status === 'PENDING_PAYMENT') {
        setUpiModalData({
          isOpen: true,
          billId: bill.id,
          billNo: bill.billNo,
          totalPaise: grandTotalPaise,
          upiUri: bill.upiUri,
          receiptData,
        });
      } else {
        // Split or completed sale
        setReceiptModalData({
          isOpen: true,
          data: receiptData,
        });
      }
    } catch (e: any) {
      alert(`Checkout failed: ${e?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm UPI callback
  const handleConfirmUpi = async (billId: string, utr?: string) => {
    const res = await apiRequest(`/api/bills/${billId}/confirm-upi`, {
      method: 'POST',
      body: JSON.stringify({ upiRef: utr }),
    });
    if (res.success) {
      await refreshData();
      if (upiModalData.receiptData) {
        setReceiptModalData({
          isOpen: true,
          data: upiModalData.receiptData,
        });
      }
    } else {
      alert(`UPI confirmation failed: ${res.error?.message}`);
    }
  };

  // Cancel Bill callback
  const handleCancelBill = async (billId: string) => {
    const res = await apiRequest(`/api/bills/${billId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.success) {
      await refreshData();
      alert('Pending bill cancelled. Reserved stock restored.');
    } else {
      alert(`Cancel failed: ${res.error?.message}`);
    }
  };

  // Quick Customer Creation
  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      alert('Name and phone are required.');
      return;
    }
    const res = await apiRequest('/api/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
      }),
    });
    if (res.success && res.data) {
      setSelectedCustomer(res.data);
      setIsCustomerModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      await refreshData();
    }
  };

  // Filtered Products Catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'all' ||
        p.categoryId === selectedCategory ||
        p.categoryName?.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchQ =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.includes(searchQuery);
      return matchCat && matchQ;
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#FAFAF9] text-[#1C1917] font-sans select-none">
      {/* ============================================================== */}
      {/* LEFT PANE: PRODUCT CATALOG & BARCODE SCAN (60% Desktop)         */}
      {/* ============================================================== */}
      <div
        className={`flex-1 lg:w-[60%] flex flex-col border-r border-[#D6D3D1] overflow-hidden bg-[#FAFAF9] relative ${
          mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {/* Top Scan & Search Bar (Desktop only: hidden on mobile) */}
        <div className="hidden md:block p-4 sm:p-6 border-b border-[#D6D3D1] bg-[#FAFAF9]">
          <form onSubmit={handleBarcodeSubmit} className="relative flex items-center">
            <div className="absolute left-3.5 text-[#78716C] flex items-center space-x-1.5 pointer-events-none">
              <Barcode className="w-5 h-5 text-[#C2410C]" />
            </div>
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan Barcode or Search Products (F2 or /)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-14 sm:pr-16 py-3 bg-[#F5F5F4] border border-[#D6D3D1] rounded-lg text-sm font-normal text-[#1C1917] placeholder:text-[#78716C] focus:bg-[#FAFAF9] focus:border-[#C2410C] focus:ring-3 focus:ring-[#C2410C]/15 outline-none transition-all duration-150"
            />
            <kbd className="absolute right-3.5 text-[10px] font-mono bg-[#E7E5E4] text-[#57534E] px-2 py-0.5 rounded border border-[#D6D3D1]">
              F2
            </kbd>
          </form>

          {/* Category Chips (Desktop) */}
          <div className="flex items-center space-x-2 overflow-x-auto mt-3 pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center space-x-2 shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-[#C2410C] text-white shadow-xs'
                  : 'bg-[#F5F5F4] text-[#57534E] border border-[#D6D3D1] hover:bg-[#E7E5E4] hover:text-[#1C1917]'
              }`}
            >
              <img
                src="/images/categories/default-category.svg"
                alt="All"
                className="w-4 h-4 rounded-full object-cover shrink-0"
              />
              <span>All Items ({products.length})</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center space-x-2 shrink-0 ${
                  selectedCategory === c.id
                    ? 'bg-[#C2410C] text-white shadow-xs'
                    : 'bg-[#F5F5F4] text-[#57534E] border border-[#D6D3D1] hover:bg-[#E7E5E4] hover:text-[#1C1917]'
                }`}
              >
                <img
                  src={c.imageUrl || '/images/categories/default-category.svg'}
                  alt={c.name}
                  className="w-4 h-4 rounded-full object-cover shrink-0 bg-white"
                  onError={(e) => {
                    (e.target as any).src = '/images/categories/default-category.svg';
                  }}
                />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Catalog Body: Split on mobile (Left categories, Right products) / Full width on desktop */}
        <div className="flex-1 flex overflow-hidden">
          {/* Mobile Left Sidebar: Categories */}
          <div className="md:hidden w-16 sm:w-20 shrink-0 bg-[#F5F5F4] border-r border-[#D6D3D1] overflow-y-auto flex flex-col py-1.5 select-none scrollbar-none space-y-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`p-1.5 sm:p-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer border-l-2 ${
                selectedCategory === 'all'
                  ? 'bg-[#FAFAF9] text-[#C2410C] font-bold border-[#C2410C] shadow-xs'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917] hover:bg-[#E7E5E4]'
              }`}
            >
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center p-1 sm:p-1.5 mb-1 ${
                  selectedCategory === 'all' ? 'bg-[#FFEDD5]' : 'bg-[#E7E5E4]'
                }`}
              >
                <img
                  src="/images/categories/default-category.svg"
                  alt="All"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[10px] leading-tight line-clamp-2">All Items</span>
              <span className="text-[9px] font-mono text-[#78716C]">({products.length})</span>
            </button>

            {categories.map((c) => {
              const isSelected = selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`p-1.5 sm:p-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer border-l-2 ${
                    isSelected
                      ? 'bg-[#FAFAF9] text-[#C2410C] font-bold border-[#C2410C] shadow-xs'
                      : 'border-transparent text-[#57534E] hover:text-[#1C1917] hover:bg-[#E7E5E4]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center p-1 sm:p-1.5 mb-1 overflow-hidden ${
                      isSelected ? 'bg-[#FFEDD5]' : 'bg-[#E7E5E4]'
                    }`}
                  >
                    <img
                      src={c.imageUrl || '/images/categories/default-category.svg'}
                      alt={c.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as any).src = '/images/categories/default-category.svg';
                      }}
                    />
                  </div>
                  <span className="text-[9px] sm:text-[10px] leading-tight line-clamp-2">{c.name}</span>
                </button>
              );
            })}
          </div>

          {/* Right Area: Products Grid (fills right side on mobile, full width on desktop) */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 bg-[#FAFAF9]">
            {/* Mobile Category Active Heading */}
            <div className="md:hidden flex items-center justify-between pb-1.5 mb-2 border-b border-[#D6D3D1]">
              <span className="text-xs font-bold text-[#1C1917] truncate">
                {selectedCategory === 'all'
                  ? 'All Products'
                  : categories.find((c) => c.id === selectedCategory)?.name || 'Category'}
              </span>
              <span className="text-[10px] font-mono text-[#78716C]">
                {filteredProducts.length} items
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4 xl:gap-6">
              {filteredProducts.map((product) => {
                const inCart = activeCartItems.find((i) => i.product.id === product.id);
                const isLow = product.stock <= product.reorderLevel;
                const hasDiscount = Boolean(product.discountPct && product.discountPct > 0);
                const effectivePriceRupees = hasDiscount
                  ? (product.pricePaise * (1 - (product.discountPct || 0) / 100)) / 100
                  : product.pricePaise / 100;

                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`relative p-2 sm:p-2.5 md:p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between group active:scale-[0.98] ${
                      inCart
                        ? 'bg-[#F5F5F4] border-[#D6D3D1] border-l-2 border-l-[#C2410C] shadow-[0_4px_16px_rgba(28,25,23,0.06)] -translate-y-0.5'
                        : 'bg-[#F5F5F4] border-[#D6D3D1] hover:border-[#78716C] hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)] hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Product Image Showcase */}
                    <div className="w-full h-20 sm:h-28 md:h-32 mb-1.5 sm:mb-2 rounded-lg bg-[#FAFAF9] border border-[#E7E5E4] flex items-center justify-center overflow-hidden p-1 sm:p-1.5 relative group-hover:scale-[1.02] transition-transform">
                      <img
                        src={product.imageUrl || '/images/products/default-product.svg'}
                        alt={product.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as any).src = '/images/products/default-product.svg';
                        }}
                      />
                      {/* Discount Badge */}
                      {hasDiscount && (
                        <div className="absolute top-1 left-1 sm:top-1.5 sm:left-1.5 bg-emerald-600 text-white px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold shadow-xs">
                          {product.discountPct}% OFF
                        </div>
                      )}
                      {/* Low Stock Warning Chip */}
                      {isLow && (
                        <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 flex items-center space-x-0.5 sm:space-x-1 bg-amber-50 text-[#D97706] border border-amber-200 px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold shadow-xs">
                          <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#D97706]" />
                          <span>Low</span>
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] sm:text-[10px] md:text-[11px] font-semibold text-[#78716C] uppercase tracking-wider block mb-0.5 truncate">
                          {product.categoryName || 'General'}
                        </span>
                        <h3 className="text-[11px] sm:text-xs md:text-sm font-semibold text-[#1C1917] line-clamp-2 leading-tight sm:leading-snug group-hover:text-[#C2410C] transition-colors">
                          {product.name}
                        </h3>
                      </div>

                      <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-[#D6D3D1] flex items-center justify-between gap-1">
                        <div>
                          {/* Price in Fira Code */}
                          {hasDiscount ? (
                            <div className="flex items-baseline space-x-1">
                              <span className="text-[11px] sm:text-xs md:text-base font-semibold text-emerald-700 font-mono tabular-nums tracking-tight">
                                ₹{effectivePriceRupees % 1 === 0 ? effectivePriceRupees.toFixed(0) : effectivePriceRupees.toFixed(2)}
                              </span>
                              <span className="text-[9px] sm:text-[10px] md:text-[11px] text-[#A8A29E] line-through font-mono tabular-nums">
                                ₹{(product.pricePaise / 100) % 1 === 0 ? (product.pricePaise / 100).toFixed(0) : (product.pricePaise / 100).toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] sm:text-xs md:text-base font-semibold text-[#1C1917] font-mono tabular-nums tracking-tight">
                              ₹{(product.pricePaise / 100) % 1 === 0 ? (product.pricePaise / 100).toFixed(0) : (product.pricePaise / 100).toFixed(2)}
                            </span>
                          )}
                          <span className="text-[9px] sm:text-[10px] md:text-[11px] text-[#78716C] block font-mono tabular-nums">
                            Stock: {product.stock}
                          </span>
                        </div>

                        {inCart ? (
                          <div
                            className="flex items-center bg-[#FAFAF9] border border-[#C2410C]/40 rounded-md sm:rounded-lg overflow-hidden shadow-xs z-10 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQty(product.id, -1);
                              }}
                              className="w-5 h-5 sm:w-6 sm:h-7 md:w-7 md:h-7 flex items-center justify-center text-[#C2410C] hover:bg-[#FFEDD5] active:scale-95 transition-all cursor-pointer"
                              title="Decrease quantity"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5" />
                            </button>
                            <span className="w-4 sm:w-5 md:w-7 text-center text-[10px] sm:text-xs font-bold text-[#C2410C] font-mono tabular-nums select-none">
                              {inCart.qty}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQty(product.id, 1);
                              }}
                              className="w-5 h-5 sm:w-6 sm:h-7 md:w-7 md:h-7 flex items-center justify-center text-[#C2410C] hover:bg-[#FFEDD5] active:scale-95 transition-all cursor-pointer"
                              title="Increase quantity"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-5 h-5 sm:w-6 sm:h-7 md:w-7 md:h-7 rounded-md sm:rounded-lg bg-[#E7E5E4] group-hover:bg-[#C2410C] text-[#57534E] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                            <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="h-64 flex flex-col items-center justify-center text-center text-[#78716C]">
                <Search className="w-10 h-10 text-[#D6D3D1] mb-2 stroke-1" />
                <p className="text-sm font-semibold text-[#1C1917]">No products in this category.</p>
                <p className="text-xs text-[#78716C] mt-1">Select another category from the sidebar.</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Sticky Floating Cart Bar */}
        {activeCartItems.length > 0 && (
          <div className="lg:hidden p-3 bg-gradient-to-t from-[#FAFAF9] via-[#FAFAF9]/95 to-transparent sticky bottom-0 z-20 border-t border-[#D6D3D1]">
            <button
              onClick={() => setMobileTab('cart')}
              className="w-full h-12 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg font-semibold text-sm flex items-center justify-between shadow-[0_4px_12px_rgba(194,65,12,0.25)] transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <span className="bg-[#9A3412] px-2 py-0.5 rounded font-mono text-xs">
                  {activeCartItems.reduce((acc, i) => acc + i.qty, 0)} items
                </span>
                <span className="font-mono text-base font-semibold">
                  ₹{grandTotalRupees.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center space-x-1 font-semibold">
                <span>View Cart & Pay</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* RIGHT PANE: ACTIVE CART & CHECKOUT (40% Desktop)               */}
      {/* ============================================================== */}
      <div
        className={`flex-1 lg:w-[40%] flex flex-col bg-[#F5F5F4] border-l border-[#D6D3D1] overflow-hidden ${
          mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {/* Customer Header */}
        <div className="p-3 sm:p-4 border-b border-[#D6D3D1] bg-[#FAFAF9] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            {/* Mobile Back to Catalog Button */}
            <button
              onClick={() => setMobileTab('catalog')}
              className="lg:hidden h-8 px-2.5 rounded-lg bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#1C1917] text-xs font-semibold flex items-center space-x-1 cursor-pointer border border-[#D6D3D1]"
            >
              <RotateCcw className="w-3 h-3 text-[#C2410C]" />
              <span>Catalog</span>
            </button>

            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="h-8 px-3 rounded-lg bg-[#F5F5F4] hover:bg-[#E7E5E4] border border-[#D6D3D1] text-xs font-semibold text-[#1C1917] flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#C2410C]" />
              <span className="truncate max-w-[120px] sm:max-w-none">
                {selectedCustomer ? selectedCustomer.name : 'Select Customer (F6)'}
              </span>
            </button>
            {selectedCustomer && (
              <span className="text-[11px] text-[#57534E] font-medium bg-[#E7E5E4] px-2 py-0.5 rounded font-mono">
                {selectedCustomer.phone}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onParkCart(activeCartItems)}
              disabled={activeCartItems.length === 0}
              className="text-xs font-semibold text-[#D97706] hover:text-[#B45309] disabled:opacity-40 transition-colors cursor-pointer"
              title="Park Cart (F4)"
            >
              Hold (F4)
            </button>
            <span className="text-[#D6D3D1]">|</span>
            <button
              onClick={clearCart}
              disabled={activeCartItems.length === 0}
              className="text-xs font-semibold text-[#78716C] hover:text-[#DC2626] disabled:opacity-40 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Cart Items Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#FAFAF9]/50">
          {activeCartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#78716C] p-6">
              <Barcode className="w-12 h-12 text-[#D6D3D1] mb-3 stroke-1" />
              <p className="text-base font-semibold text-[#1C1917]">Cart is empty</p>
              <p className="text-xs text-[#78716C] mt-1 max-w-xs">
                Scan barcode or click items from the catalog on the left to start billing.
              </p>
            </div>
          ) : (
            activeCartItems.map((item, idx) => {
              const hasDiscount = Boolean(item.product.discountPct && item.product.discountPct > 0);
              const unitDiscountPaise = hasDiscount
                ? Math.round((item.product.pricePaise * (item.product.discountPct || 0)) / 100)
                : 0;
              const effectiveUnitPricePaise = item.product.pricePaise - unitDiscountPaise;
              const lineTotalPaise = effectiveUnitPricePaise * item.qty;

              return (
                <div
                  key={item.product.id}
                  className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-3 flex items-center justify-between transition-all duration-150 hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)]"
                >
                  <div className="flex items-center space-x-2.5 max-w-[55%]">
                    <span className="w-4 text-center text-xs font-semibold text-[#78716C] font-mono">
                      {idx + 1}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-[#FAFAF9] border border-[#D6D3D1] p-0.5 shrink-0 overflow-hidden flex items-center justify-center">
                      <img
                        src={item.product.imageUrl || '/images/products/default-product.svg'}
                        alt={item.product.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as any).src = '/images/products/default-product.svg';
                        }}
                      />
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-semibold text-[#1C1917] truncate">{item.product.name}</h4>
                      <div className="text-[11px] font-mono tabular-nums flex items-center space-x-1.5 mt-0.5">
                        {hasDiscount ? (
                          <>
                            <span className="text-emerald-700 font-semibold">
                              ₹{(effectiveUnitPricePaise / 100).toFixed(2)}
                            </span>
                            <span className="text-[#A8A29E] line-through text-[10px]">
                              ₹{(item.product.pricePaise / 100).toFixed(2)}
                            </span>
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1 rounded font-bold">
                              {item.product.discountPct}% OFF
                            </span>
                          </>
                        ) : (
                          <span className="text-[#78716C]">
                            ₹{(item.product.pricePaise / 100).toFixed(2)} / unit
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Quantity Stepper */}
                    <div className="flex items-center bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQty(item.product.id, -1)}
                        className="w-7 h-7 flex items-center justify-center text-[#57534E] hover:text-[#1C1917] hover:bg-[#E7E5E4] transition-colors cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-semibold text-[#1C1917] font-mono tabular-nums">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.product.id, 1)}
                        className="w-7 h-7 flex items-center justify-center text-[#57534E] hover:text-[#1C1917] hover:bg-[#E7E5E4] transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Total in Fira Code */}
                    <span className="w-16 text-right text-sm font-semibold text-[#1C1917] font-mono tabular-nums">
                      ₹{(lineTotalPaise / 100).toFixed(2)}
                    </span>

                  {/* Delete Item */}
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-[#78716C] hover:text-[#DC2626] p-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

        {/* Calculation Summary Footer */}
        <div className="border-t border-[#D6D3D1] bg-[#FAFAF9] p-4 sm:p-5">
          <div className="space-y-1.5 text-xs text-[#57534E] pb-3 border-b border-[#D6D3D1]">
            <div className="flex justify-between">
              <span>Subtotal ({activeCartItems.reduce((acc, i) => acc + i.qty, 0)} items):</span>
              <span className="font-mono tabular-nums font-semibold text-[#1C1917]">
                ₹{(subtotalPaise / 100).toFixed(2)}
              </span>
            </div>

            {/* Discount Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-[#57534E]">
                <Percent className="w-3 h-3 text-[#C2410C]" />
                <span>Discount (₹):</span>
                {currentUser?.role !== 'OWNER' && currentUser?.permissions?.discountLimit !== undefined && (
                  <span className="text-[10px] text-[#78716C] bg-stone-100 px-1 py-0.2 rounded font-mono">
                    Max {currentUser.permissions.discountLimit}%
                  </span>
                )}
                {Number(shopSettings?.defaultDiscount || 0) > 0 && subtotalPaise > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const defPct = Number(shopSettings.defaultDiscount);
                      const disc = Math.round((subtotalPaise * defPct) / 100);
                      setDiscountPaise(disc);
                      setDiscountInput((disc / 100).toFixed(2));
                    }}
                    className="text-[10px] bg-[#FFEDD5] hover:bg-[#FED7AA] text-[#C2410C] font-semibold px-1.5 py-0.5 rounded border border-[#C2410C]/20 transition-colors cursor-pointer"
                    title={`Apply Store Default Discount of ${shopSettings.defaultDiscount}%`}
                  >
                    Apply Store {shopSettings.defaultDiscount}%
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  placeholder="0"
                  value={discountInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDiscountInput(val);
                    setDiscountPaise(Math.round((parseFloat(val) || 0) * 100));
                  }}
                  className={`w-20 bg-[#F5F5F4] border rounded-lg px-2 py-0.5 text-right text-xs font-mono font-semibold focus:outline-none focus:bg-[#FAFAF9] ${
                    currentUser?.role !== 'OWNER' &&
                    currentUser?.permissions?.discountLimit !== undefined &&
                    discountPaise > Math.round((subtotalPaise * currentUser.permissions.discountLimit) / 100)
                      ? 'border-red-500 text-red-600 focus:border-red-600'
                      : 'border-[#D6D3D1] text-[#C2410C] focus:border-[#C2410C]'
                  }`}
                />
              </div>
            </div>

            {totalTaxPaise > 0 ? (
              <div className="flex justify-between text-[#78716C]">
                <span>GST Split (CGST + SGST):</span>
                <span className="font-mono tabular-nums text-[#57534E]">
                  {priceIncludesTax ? '(Incl.) ' : '+'}₹{(totalTaxPaise / 100).toFixed(2)}
                </span>
              </div>
            ) : (
              <div className="flex justify-between text-[#78716C]">
                <span>GST ({Number(shopSettings?.defaultTax ?? 0)}%):</span>
                <span className="font-mono tabular-nums text-[#16A34A] font-medium">
                  ₹0.00 (No Tax)
                </span>
              </div>
            )}

            {roundOffPaise !== 0 && (
              <div className="flex justify-between text-[#78716C]">
                <span>Round-off:</span>
                <span className="font-mono tabular-nums text-[#57534E]">
                  {roundOffPaise > 0 ? '+' : ''}₹{(roundOffPaise / 100).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Grand Total Hero Display (38px bold per typography & design system) */}
          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#78716C] font-semibold block">
                Total Amount Due
              </span>
              <span className="text-[11px] text-[#57534E] font-normal">
                {totalTaxPaise === 0
                  ? '0% GST / Tax Exempt'
                  : priceIncludesTax
                  ? 'Inclusive of all taxes'
                  : 'Exclusive of taxes (+GST)'}
              </span>
            </div>
            <div className="text-[38px] leading-tight font-bold font-mono tabular-nums text-[#1C1917] tracking-tight">
              ₹ {grandTotalRupees.toFixed(2)}
            </div>
          </div>

          {/* Multi-Tender Selector Chips (Pill-shaped 9999px radius per DESIGN.md) */}
          <div className="grid grid-cols-3 gap-2 my-2">
            <button
              onClick={() => setPaymentMethod('CASH')}
              className={`py-2 px-2 rounded-full text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                paymentMethod === 'CASH'
                  ? 'bg-[#C2410C] text-white shadow-xs'
                  : 'bg-[#F5F5F4] text-[#57534E] border border-[#D6D3D1] hover:bg-[#E7E5E4] hover:text-[#1C1917]'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Banknote className="w-3.5 h-3.5" />
                <span>CASH</span>
              </div>
              <span className="text-[9px] font-mono opacity-80">F8</span>
            </button>

            <button
              onClick={() => setPaymentMethod('UPI')}
              className={`py-2 px-2 rounded-full text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                paymentMethod === 'UPI'
                  ? 'bg-[#C2410C] text-white shadow-xs'
                  : 'bg-[#F5F5F4] text-[#57534E] border border-[#D6D3D1] hover:bg-[#E7E5E4] hover:text-[#1C1917]'
              }`}
            >
              <div className="flex items-center space-x-1">
                <QrCode className="w-3.5 h-3.5" />
                <span>UPI QR</span>
              </div>
              <span className="text-[9px] font-mono opacity-80">F9</span>
            </button>

            <button
              onClick={() => setPaymentMethod('SPLIT')}
              className={`py-2 px-2 rounded-full text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                paymentMethod === 'SPLIT'
                  ? 'bg-[#C2410C] text-white shadow-xs'
                  : 'bg-[#F5F5F4] text-[#57534E] border border-[#D6D3D1] hover:bg-[#E7E5E4] hover:text-[#1C1917]'
              }`}
            >
              <span>SPLIT</span>
              <span className="text-[9px] opacity-80">Cash + UPI</span>
            </button>
          </div>

          {/* CASH TENDER & CHANGE CALCULATOR */}
          {paymentMethod === 'CASH' && (
            <div className="bg-[#F5F5F4] p-3 rounded-xl border border-[#D6D3D1] mb-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#57534E] font-semibold">Cash Given by Customer:</span>
                <input
                  type="number"
                  placeholder={`Exact ₹${grandTotalRupees.toFixed(2)}`}
                  value={cashReceivedInput}
                  onChange={(e) => setCashReceivedInput(e.target.value)}
                  className="w-32 bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-2.5 py-1 text-right text-sm font-semibold font-mono text-[#1C1917] tabular-nums focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              {/* Quick Cash Suggestions */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {smartCashSuggestions.map((amt) => {
                  const isExact = amt === grandTotalRupees;
                  return (
                    <button
                      key={amt}
                      onClick={() => setQuickCash(amt % 1 === 0 ? amt : Number(amt.toFixed(2)))}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums transition-colors cursor-pointer ${
                        isExact
                          ? 'bg-[#FFEDD5] border border-[#C2410C]/40 text-[#C2410C] font-semibold'
                          : 'bg-[#FAFAF9] hover:bg-[#E7E5E4] text-[#57534E] font-medium border border-[#D6D3D1]'
                      }`}
                    >
                      {isExact ? `Exact ₹${amt.toFixed(amt % 1 === 0 ? 0 : 2)}` : `₹${amt}`}
                    </button>
                  );
                })}
              </div>

              {/* Live Change Feedback */}
              {isCashShort ? (
                <div className="text-xs font-semibold text-[#DC2626] bg-red-50 p-2.5 rounded-lg border border-red-200 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
                    <span>Customer short by:</span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold">₹{cashShortAmount.toFixed(2)}</span>
                </div>
              ) : cashReceivedPaise > grandTotalPaise ? (
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#16A34A]">
                    <span>Change to Return:</span>
                    <span className="text-base font-semibold font-mono tabular-nums text-[#16A34A]">
                      ₹{(changeGivenPaise / 100).toFixed(2)}
                    </span>
                  </div>
                  {liveDenominations.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-emerald-200">
                      {liveDenominations.map((d) => (
                        <span
                          key={d.value}
                          className="text-[10px] bg-white text-[#16A34A] px-1.5 py-0.5 rounded font-mono font-semibold border border-emerald-200 shadow-xs"
                        >
                          {d.count} x {d.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* SPLIT TENDER INPUTS */}
          {paymentMethod === 'SPLIT' && (
            <div className="bg-[#F5F5F4] p-3 rounded-xl border border-[#D6D3D1] mb-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#57534E]">Cash Part (₹):</span>
                <input
                  type="number"
                  placeholder="0"
                  value={splitCashInput}
                  onChange={(e) => setSplitCashInput(e.target.value)}
                  className="w-28 bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-2 py-1 text-right font-semibold font-mono text-[#1C1917] tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#57534E]">UPI Part (₹):</span>
                <input
                  type="number"
                  placeholder="0"
                  value={splitUpiInput}
                  onChange={(e) => setSplitUpiInput(e.target.value)}
                  className="w-28 bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-2 py-1 text-right font-semibold font-mono text-[#C2410C] tabular-nums"
                />
              </div>
            </div>
          )}

          {/* Single Primary Action Button per view (frontend/DESIGN.md: One primary CTA per view) */}
          <button
            onClick={handleCheckout}
            disabled={isSubmitting || activeCartItems.length === 0 || isCashShort}
            className="w-full h-12 rounded-lg text-sm font-semibold flex items-center justify-center space-x-2 bg-[#C2410C] hover:bg-[#9A3412] text-white shadow-[0_4px_12px_rgba(194,65,12,0.25)] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <span className="font-mono">
              {isSubmitting
                ? 'Processing...'
                : paymentMethod === 'UPI'
                ? `GENERATE UPI QR • ₹${grandTotalRupees.toFixed(2)}`
                : `PAY & PRINT RECEIPT • ₹${grandTotalRupees.toFixed(2)}`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Customer Selection Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-4">
          <div className="bg-[#F5F5F4] border border-[#D6D3D1] w-full max-w-md rounded-xl p-6 shadow-[0_24px_48px_rgba(28,25,23,0.12)]">
            <h3 className="font-display text-lg font-bold text-[#1C1917] mb-3">Select or Add Customer</h3>

            {/* Quick Add Form */}
            <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#D6D3D1] mb-4 space-y-2">
              <div className="text-xs font-semibold text-[#57534E]">New Customer Quick Add</div>
              <input
                type="text"
                placeholder="Customer Name (e.g. Ramesh Bhai)"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full bg-[#F5F5F4] border border-[#D6D3D1] rounded-lg px-3 py-2 text-xs text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#C2410C]"
              />
              <input
                type="text"
                placeholder="Phone Number (10 digits)"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="w-full bg-[#F5F5F4] border border-[#D6D3D1] rounded-lg px-3 py-2 text-xs text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#C2410C]"
              />
              <button
                onClick={handleCreateCustomer}
                className="w-full h-9 bg-[#C2410C] text-white font-semibold text-xs rounded-lg hover:bg-[#9A3412] transition-colors shadow-xs"
              >
                Save & Select Customer
              </button>
            </div>

            {/* Existing Customers List */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 mb-4">
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setIsCustomerModalOpen(false);
                }}
                className="w-full p-2.5 rounded-lg text-left text-xs bg-[#FAFAF9] hover:bg-[#E7E5E4] text-[#57534E] font-medium border border-[#D6D3D1]"
              >
                Walk-in Customer
              </button>
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomer(c);
                    setIsCustomerModalOpen(false);
                  }}
                  className="w-full p-2.5 rounded-lg text-left text-xs bg-[#FAFAF9] hover:bg-[#E7E5E4] border border-[#D6D3D1] text-[#1C1917] flex justify-between items-center transition-colors"
                >
                  <div>
                    <span className="font-semibold block text-[#1C1917]">{c.name}</span>
                    <span className="text-[10px] text-[#78716C]">{c.phone}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsCustomerModalOpen(false)}
              className="w-full h-9 bg-transparent hover:bg-[#E7E5E4] text-[#57534E] border border-[#D6D3D1] rounded-lg text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <ReturnChangeModal
        isOpen={returnChangeData.isOpen}
        onClose={() => setReturnChangeData((prev) => ({ ...prev, isOpen: false }))}
        billNo={returnChangeData.billNo}
        totalPaise={returnChangeData.totalPaise}
        cashReceivedPaise={returnChangeData.cashReceivedPaise}
        changeGivenPaise={returnChangeData.changeGivenPaise}
        receiptData={returnChangeData.receiptData}
        onPrint={() => {
          if (returnChangeData.receiptData) {
            printThermalReceipt(returnChangeData.receiptData);
          }
        }}
      />

      <UpiModal
        isOpen={upiModalData.isOpen}
        onClose={() => setUpiModalData((prev) => ({ ...prev, isOpen: false }))}
        billId={upiModalData.billId}
        billNo={upiModalData.billNo}
        totalPaise={upiModalData.totalPaise}
        upiUri={upiModalData.upiUri}
        upiId={shopSettings?.upiId || 'ganeshretail@okhdfcbank'}
        payeeName={shopSettings?.upiName || shopSettings?.name}
        onConfirm={handleConfirmUpi}
        onCancelBill={handleCancelBill}
      />

      <ReceiptModal
        isOpen={receiptModalData.isOpen}
        onClose={() => setReceiptModalData({ isOpen: false, data: null })}
        data={receiptModalData.data}
      />
    </div>
  );
}
