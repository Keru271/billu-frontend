'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Printer, ArrowRight, Banknote, AlertCircle, Loader2 } from 'lucide-react';
import { calculateDenominations } from '../lib/denominations';
import {
  ThermalPaperSize,
  getSavedThermalPaperSize,
  BillReceiptData,
  printViaBluetooth,
} from '../lib/receipt';

interface ReturnChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  billNo: number;
  totalPaise: number;
  cashReceivedPaise: number;
  changeGivenPaise: number;
  onPrint: () => void;
  receiptData?: BillReceiptData | null;
}

export default function ReturnChangeModal({
  isOpen,
  onClose,
  billNo,
  totalPaise,
  cashReceivedPaise,
  changeGivenPaise,
  onPrint,
  receiptData,
}: ReturnChangeModalProps) {
  const [btStatus, setBtStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (isPrinting) return;
    if (receiptData) {
      setIsPrinting(true);
      setBtStatus(null);
      try {
        const paperSize = getSavedThermalPaperSize();
        const result = await printViaBluetooth(receiptData, paperSize);
        setBtStatus({
          type: result.success ? 'success' : 'error',
          text: result.message,
        });
        if (!result.success && onPrint) {
          onPrint();
        }
      } catch (e: any) {
        setBtStatus({
          type: 'error',
          text: e?.message || 'Bluetooth connection error.',
        });
        if (onPrint) onPrint();
      } finally {
        setIsPrinting(false);
      }
    } else if (onPrint) {
      onPrint();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setBtStatus(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, receiptData, onPrint, isPrinting]);

  if (!isOpen) return null;

  const changeRupees = changeGivenPaise / 100;
  const denominations = calculateDenominations(changeRupees);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[#F5F5F4] border border-[#D6D3D1] w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl p-6 sm:p-8 shadow-[0_24px_48px_rgba(28,25,23,0.12)] text-center relative font-sans">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-[#16A34A]">
          <CheckCircle2 className="w-6 h-6" />
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider text-[#C2410C] mb-1">
          Bill #{billNo} Saved Successfully
        </div>
        <h2 className="font-display text-2xl font-bold text-[#1C1917] mb-6">
          Return Change to Customer
        </h2>

        {/* Change Display Hero */}
        <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-6 mb-6">
          <div className="text-xs text-[#78716C] uppercase tracking-wider font-semibold mb-2">
            Change Amount to Return
          </div>
          <div className="text-4xl sm:text-5xl font-bold font-mono text-[#16A34A] tabular-nums tracking-tight">
            ₹{changeRupees.toFixed(2)}
          </div>
          <div className="flex justify-between items-center text-xs text-[#57534E] mt-4 pt-3 border-t border-[#E7E5E4]">
            <span>Total Bill: ₹{(totalPaise / 100).toFixed(2)}</span>
            <span>Tendered: ₹{(cashReceivedPaise / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Denominations Helper */}
        {changeRupees > 0 ? (
          <div className="mb-6 text-left">
            <div className="text-xs font-semibold text-[#57534E] mb-2 flex items-center space-x-1">
              <Banknote className="w-3.5 h-3.5" />
              <span>Suggested Currency Notes & Coins</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {denominations.map((d) => (
                <div
                  key={d.value}
                  className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 flex items-center justify-between"
                >
                  <span className="text-xs font-medium text-[#57534E]">{d.label}</span>
                  <span className="font-bold text-xs text-[#1C1917] font-mono tabular-nums bg-white border border-[#D6D3D1] px-2 py-0.5 rounded shadow-2xs">
                    {d.count}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-6 text-xs text-[#57534E] bg-[#FAFAF9] p-3 rounded-lg border border-[#D6D3D1]">
            Exact cash tendered. Zero change required.
          </div>
        )}

        {/* Print Status Feedback */}
        {btStatus && (
          <div
            className={`mb-3 p-2.5 rounded-lg text-xs flex items-center space-x-2 animate-fadeIn text-left ${
              btStatus.type === 'success'
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

        {/* Action Buttons: Clean single Print action + Next Bill */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="w-full sm:flex-1 h-11 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
            title="Print Receipt"
          >
            {isPrinting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>{isPrinting ? 'Printing...' : 'Print'}</span>
            <kbd className="text-[10px] bg-indigo-800/60 border border-indigo-400/40 px-1.5 py-0.5 rounded text-white font-mono">
              P
            </kbd>
          </button>

          <button
            onClick={onClose}
            className="w-full sm:flex-1 h-11 px-4 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 shadow-[0_4px_12px_rgba(194,65,12,0.25)] transition-all duration-150 cursor-pointer"
          >
            <span>Next Bill</span>
            <ArrowRight className="w-4 h-4" />
            <kbd className="text-[10px] bg-[#9A3412] text-white px-1.5 py-0.5 rounded font-mono font-semibold">
              Enter
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
