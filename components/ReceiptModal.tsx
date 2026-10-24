'use client';

import React, { useState, useEffect } from 'react';
import { X, Printer, Share2, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  BillReceiptData,
  printThermalReceipt,
  printViaBluetooth,
  downloadThermalPdf,
  buildWhatsAppLink,
  ThermalPaperSize,
  getSavedThermalPaperSize,
  saveThermalPaperSize,
} from '../lib/receipt';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BillReceiptData | null;
}

export default function ReceiptModal({ isOpen, onClose, data }: ReceiptModalProps) {
  const [paperSize, setPaperSize] = useState<ThermalPaperSize>('58mm');
  const [btStatus, setBtStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBtPrinting, setIsBtPrinting] = useState(false);

  useEffect(() => {
    setPaperSize(getSavedThermalPaperSize());
    setBtStatus(null);
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    printThermalReceipt(data, paperSize);
  };

  const handleBluetoothPrint = async () => {
    setIsBtPrinting(true);
    setBtStatus(null);
    try {
      const result = await printViaBluetooth(data, paperSize);
      setBtStatus({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
      if (!result.success) {
        handlePrint();
      }
    } catch (e: any) {
      setBtStatus({
        type: 'error',
        text: e?.message || 'Bluetooth connection error.',
      });
      handlePrint();
    } finally {
      setIsBtPrinting(false);
    }
  };

  const handleDownloadPdf = () => {
    downloadThermalPdf(data, paperSize);
  };

  const handleShareWhatsApp = () => {
    const phone = data.customerPhone || prompt('Enter customer WhatsApp phone number:');
    if (!phone) return;
    const url = buildWhatsAppLink(phone, data);
    window.open(url, '_blank');
  };

  const is58mm = paperSize === '58mm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150 font-sans">
      <div className={`relative my-6 w-full transition-all duration-200 mx-auto ${is58mm ? 'max-w-[320px]' : 'max-w-sm'}`}>
        {/* Close Button top right */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/90 hover:text-white flex items-center space-x-1 text-xs font-semibold cursor-pointer"
        >
          <span>Close</span>
          <X className="w-4 h-4" />
        </button>

        {/* Thermal Receipt Simulator */}
        <div className={`thermal-receipt transition-all rounded-sm shadow-[0_24px_48px_rgba(28,25,23,0.12)] text-[#1C1917] font-mono select-text ${is58mm ? 'p-3.5 text-[11px]' : 'p-6 text-xs'}`}>
          {/* Header */}
          <div className="text-center mb-3">
            <h2 className="font-bold text-base uppercase tracking-tight">{data.shopName}</h2>
            {data.shopAddress && <p className="text-[11px] text-[#57534E] mt-0.5">{data.shopAddress}</p>}
            {data.shopPhone && <p className="text-[11px] text-[#57534E]">Ph: {data.shopPhone}</p>}
            {data.gstin && <p className="text-[11px] text-[#57534E] font-semibold">GSTIN: {data.gstin}</p>}
          </div>

          <div className="border-t border-dashed border-[#D6D3D1] my-2" />

          {/* Meta Info */}
          <div className="flex justify-between text-[11px] text-[#57534E]">
            <span>Bill: #{data.billNo}</span>
            <span>{data.date}</span>
          </div>
          {data.customerName && (
            <div className="text-[11px] text-[#57534E] mt-0.5">
              Customer: {data.customerName} {data.customerPhone ? `(${data.customerPhone})` : ''}
            </div>
          )}

          <div className="border-t border-dashed border-[#D6D3D1] my-2" />

          {/* Table Headers */}
          <div className="flex justify-between font-bold text-[11px] uppercase pb-1 text-[#1C1917]">
            <span className="w-1/2">Item</span>
            <span className="w-1/6 text-center">Qty</span>
            <span className="w-1/6 text-right">Price</span>
            <span className="w-1/6 text-right">Amt</span>
          </div>

          <div className="border-t border-dashed border-[#D6D3D1] mb-1" />

          {/* Items */}
          <div className="space-y-1.5 py-1">
            {data.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px] leading-tight">
                <span className="w-1/2 truncate pr-1">{item.name}</span>
                <span className="w-1/6 text-center">{item.qty}</span>
                <span className="w-1/6 text-right tabular-nums">
                  {(item.pricePaise / 100).toFixed(2)}
                </span>
                <span className="w-1/6 text-right tabular-nums font-semibold">
                  {((item.qty * item.pricePaise) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-[#D6D3D1] my-2" />

          {/* Summary Breakdown */}
          <div className="space-y-1 text-[11px] text-[#57534E]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="tabular-nums">₹{(data.subtotalPaise / 100).toFixed(2)}</span>
            </div>
            {data.discountPaise > 0 && (
              <div className="flex justify-between text-[#C2410C] font-semibold">
                <span>Discount:</span>
                <span className="tabular-nums">-₹{(data.discountPaise / 100).toFixed(2)}</span>
              </div>
            )}
            {data.taxPaise > 0 && (
              <div className="flex justify-between text-[#78716C]">
                <span>GST (CGST+SGST):</span>
                <span className="tabular-nums">
                  {data.priceIncludesTax ? '(Incl.) ' : '+'}₹{(data.taxPaise / 100).toFixed(2)}
                </span>
              </div>
            )}
            {data.roundOffPaise && data.roundOffPaise !== 0 ? (
              <div className="flex justify-between text-[#78716C]">
                <span>Round-off:</span>
                <span className="tabular-nums">
                  {data.roundOffPaise > 0 ? '+' : ''}₹{(data.roundOffPaise / 100).toFixed(2)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="border-t-2 border-[#1C1917] my-2" />

          {/* Grand Total */}
          <div className="flex justify-between items-center text-sm font-bold my-2 text-[#1C1917]">
            <span>GRAND TOTAL:</span>
            <span className="text-base tabular-nums">₹{(data.totalPaise / 100).toFixed(2)}</span>
          </div>

          <div className="border-t border-dashed border-[#D6D3D1] my-2" />

          {/* Payment Details */}
          <div className="text-[11px] space-y-1 text-[#57534E]">
            <span className="font-bold uppercase text-[10px] text-[#78716C] block">Payment:</span>
            {data.payments.map((p, i) => (
              <div key={i} className="flex justify-between">
                <span>Paid by {p.method}:</span>
                <span className="font-semibold tabular-nums text-[#1C1917]">₹{(p.amountPaise / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-[#D6D3D1] my-3" />

          <div className="text-center text-[11px] font-medium text-[#78716C] my-2 space-y-0.5">
            <div className="font-semibold text-[#1C1917]">Instagram: @thecaramelpan</div>
            <div>Thank you! visit us again.</div>
          </div>
        </div>

        {/* Bluetooth status feedback if present */}
        {btStatus && (
          <div
            className={`mt-2.5 p-2.5 rounded-lg text-xs flex items-center space-x-2 animate-fadeIn ${btStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
          >
            {btStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            )}
            <span className="leading-snug">{btStatus.text}</span>
          </div>
        )}

        {/* Action Controls below receipt: 8px radius per DESIGN.md */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBluetoothPrint}
              disabled={isBtPrinting}
              className="flex-1 h-11 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
              title="Print Receipt"
            >
              {isBtPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>{isBtPrinting ? 'Printing...' : 'Print'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="h-11 px-3 rounded-lg bg-[#FAFAF9] hover:bg-[#E7E5E4] text-[#57534E] hover:text-[#1C1917] border border-[#D6D3D1] font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              title="Open System Print Dialog"
            >
              <span>System</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="flex-1 h-9 px-3 rounded-lg bg-[#FAFAF9] hover:bg-[#E7E5E4] text-[#1C1917] border border-[#D6D3D1] font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[#C2410C]" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="h-9 px-3 rounded-lg bg-[#FAFAF9] hover:bg-[#E7E5E4] text-[#57534E] hover:text-[#1C1917] border border-[#D6D3D1] font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              title="Download Receipt PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
