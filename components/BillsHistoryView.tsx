'use client';

import React, { useState, useEffect } from 'react';
import { Receipt, Printer, Search, RefreshCw } from 'lucide-react';
import { apiRequest, AuthUser } from '../lib/api';
import ReceiptModal from './ReceiptModal';
import { BillReceiptData } from '../lib/receipt';

interface BillsHistoryViewProps {
  shopSettings?: any;
  currentUser?: AuthUser | null;
}

export default function BillsHistoryView({ shopSettings, currentUser }: BillsHistoryViewProps) {
  const [bills, setBills] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReceiptData, setSelectedReceiptData] = useState<BillReceiptData | null>(null);

  const fetchBills = async () => {
    try {
      setIsLoading(true);
      const query = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await apiRequest(`/api/bills${query}`);
      if (res.success && Array.isArray(res.data)) {
        setBills(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [statusFilter]);

  const handleConfirmUpi = async (billId: string) => {
    const utr = prompt('Enter UTR / Soundbox confirmation reference:');
    const res = await apiRequest(`/api/bills/${billId}/confirm-upi`, {
      method: 'POST',
      body: JSON.stringify({ upiRef: utr }),
    });
    if (res.success) {
      await fetchBills();
    } else {
      alert(`Confirmation failed: ${res.error?.message}`);
    }
  };

  const handleCancelBill = async (billId: string) => {
    if (!confirm('Cancel this bill? Stock will be restored.')) return;
    const res = await apiRequest(`/api/bills/${billId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.success) {
      await fetchBills();
    } else {
      alert(`Cancel failed: ${res.error?.message}`);
    }
  };

  const openReprint = (bill: any) => {
    const data: BillReceiptData = {
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
      customerName: bill.customerName,
      customerPhone: bill.phone,
      items: (bill.items || []).map((i: any) => ({
        name: i.name,
        qty: i.qty,
        pricePaise: i.pricePaise,
        taxPct: Number(i.taxPct),
      })),
      subtotalPaise: bill.subtotalPaise,
      discountPaise: bill.discountPaise,
      taxPaise: bill.taxPaise,
      cgstPaise: bill.cgstPaise,
      sgstPaise: bill.sgstPaise,
      roundOffPaise: bill.roundOffPaise,
      totalPaise: bill.totalPaise,
      priceIncludesTax: shopSettings?.priceIncludesTax ?? true,
      payments: bill.payments || [],
    };

    setSelectedReceiptData(data);
  };

  const filtered = bills.filter(
    (b) =>
      b.billNo.toString().includes(search) ||
      b.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      b.phone?.includes(search)
  );

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden bg-[#FAFAF9] text-[#1C1917] font-sans select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917] flex items-center space-x-2.5">
            <Receipt className="w-5 h-5 text-[#C2410C] shrink-0" />
            <span>Bill Transactions History & Thermal Reprints</span>
          </h1>
          <p className="text-sm text-[#57534E] mt-0.5">
            Audit past bills, reprint receipts, confirm pending UPI payments, and manage cancellations
          </p>
        </div>

        <button
          onClick={fetchBills}
          className="w-full sm:w-auto h-10 px-3.5 bg-transparent hover:bg-[#E7E5E4] text-[#1C1917] border border-[#D6D3D1] text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 bg-[#F5F5F4] rounded-xl border border-[#D6D3D1] mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
          <input
            type="text"
            placeholder="Search by Bill No, Customer or Phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#C2410C] focus:ring-3 focus:ring-[#C2410C]/15"
          />
        </div>

        <div className="flex items-center space-x-1 bg-[#FAFAF9] p-1 rounded-lg border border-[#D6D3D1] overflow-x-auto scrollbar-none w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Bills' },
            { id: 'PAID', label: 'Paid' },
            { id: 'PENDING_PAYMENT', label: 'Pending UPI' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#C2410C] text-white shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#E7E5E4]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Table */}
      <div className="flex-1 overflow-auto bg-[#F5F5F4] rounded-xl border border-[#D6D3D1]">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-[#E7E5E4] text-[#57534E] font-semibold border-b border-[#D6D3D1] sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4">Bill No</th>
              <th className="py-3 px-4">Date & Time</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Payment Method</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D6D3D1] text-[#1C1917]">
            {filtered.map((b) => {
              const isPaid = b.status === 'PAID';
              const isPending = b.status === 'PENDING_PAYMENT';

              return (
                <tr key={b.id} className="hover:bg-[#E7E5E4]/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#1C1917] font-mono">#{b.billNo}</td>
                  <td className="py-3 px-4 text-[#57534E] text-xs">
                    {new Date(b.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 text-[#1C1917]">
                    {b.customerName || 'Walk-in'} {b.phone ? `(${b.phone})` : ''}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-1.5">
                      {b.payments?.map((p: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FAFAF9] text-[#1C1917] border border-[#D6D3D1]"
                        >
                          {p.method}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-semibold tracking-wider ${
                        isPaid
                          ? 'bg-green-50 text-[#16A34A] border border-green-200'
                          : isPending
                          ? 'bg-[#FFEDD5] text-[#C2410C] border border-[#C2410C]/20 animate-pulse'
                          : 'bg-red-50 text-[#DC2626] border border-red-200'
                      }`}
                    >
                      {b.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-[#1C1917] font-mono tabular-nums">
                    ₹{(b.totalPaise / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleConfirmUpi(b.id)}
                          className="h-8 px-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                        >
                          Confirm UPI
                        </button>
                        <button
                          onClick={() => handleCancelBill(b.id)}
                          className="h-8 px-2.5 bg-transparent hover:bg-red-50 text-[#57534E] hover:text-[#DC2626] border border-[#D6D3D1] rounded-lg text-xs font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {isPaid && (
                      <button
                        onClick={() => openReprint(b)}
                        className="h-8 px-2.5 bg-[#FAFAF9] hover:bg-[#E7E5E4] text-[#C2410C] border border-[#D6D3D1] rounded-lg text-xs font-semibold transition-colors inline-flex items-center space-x-1"
                        title="Reprint 80mm Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ReceiptModal
        isOpen={Boolean(selectedReceiptData)}
        onClose={() => setSelectedReceiptData(null)}
        data={selectedReceiptData}
      />
    </div>
  );
}
