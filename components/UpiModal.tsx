'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, CheckCircle2, X, Volume2 } from 'lucide-react';

interface UpiModalProps {
  isOpen: boolean;
  onClose: () => void;
  billId: string;
  billNo: number;
  totalPaise: number;
  upiUri: string | null;
  upiId?: string;
  payeeName?: string;
  onConfirm: (billId: string, utr?: string) => Promise<void>;
  onCancelBill: (billId: string) => Promise<void>;
}

export default function UpiModal({
  isOpen,
  onClose,
  billId,
  billNo,
  totalPaise,
  upiUri,
  upiId = 'shop@okhdfcbank',
  payeeName = 'Store Owner',
  onConfirm,
  onCancelBill,
}: UpiModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [utr, setUtr] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const uriToEncode =
      upiUri ||
      `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
        payeeName
      )}&am=${(totalPaise / 100).toFixed(2)}&cu=INR&tn=BILL${billNo}`;

    QRCode.toDataURL(uriToEncode, {
      width: 260,
      margin: 1.5,
      color: {
        dark: '#1c1917',
        light: '#fafaf9',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate UPI QR:', err));
  }, [isOpen, upiUri, upiId, payeeName, totalPaise, billNo]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      await onConfirm(billId, utr);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this pending UPI bill? Reserved stock will be restored.')) {
      return;
    }
    try {
      setIsCancelling(true);
      await onCancelBill(billId);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[#F5F5F4] border border-[#D6D3D1] w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl p-5 sm:p-7 shadow-[0_24px_48px_rgba(28,25,23,0.12)] relative font-sans">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C2410C]/10 border border-[#C2410C]/20 flex items-center justify-center text-[#C2410C]">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#1C1917]">Dynamic UPI Payment</h3>
              <p className="text-xs text-[#78716C]">Bill #{billNo} • Pending Cashier Confirmation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#78716C] hover:text-[#1C1917] p-1 rounded-lg hover:bg-[#E7E5E4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Display Area */}
        <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-5 mb-5 text-center flex flex-col items-center">
          <div className="text-xs text-[#78716C] font-semibold mb-1 uppercase tracking-wider">
            Customer Scan Amount
          </div>
          <div className="text-3xl font-bold font-mono text-[#C2410C] tabular-nums tracking-tight mb-4">
            ₹ {(totalPaise / 100).toFixed(2)}
          </div>

          <div className="p-3 bg-[#FAFAF9] rounded-xl shadow-[0_4px_16px_rgba(28,25,23,0.06)] inline-block border border-[#D6D3D1] mb-3 relative">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="UPI QR" className="w-48 h-48 block rounded-md" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-[#78716C]">
                Generating QR...
              </div>
            )}
          </div>

          <div className="flex items-center justify-center space-x-1.5 text-xs text-[#C2410C] font-semibold bg-[#FFEDD5] border border-[#C2410C]/20 px-3 py-1 rounded-full">
            <Volume2 className="w-3.5 h-3.5 animate-bounce" />
            <span>Waiting for Soundbox / UPI App Notification</span>
          </div>
        </div>

        {/* Soundbox / UTR Reference input */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
            UTR / Reference No. <span className="text-[#78716C] font-normal">(Optional for audit)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. 412345678901 or last 4 digits"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3.5 py-2.5 text-base text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#C2410C] focus:ring-3 focus:ring-[#C2410C]/15 font-mono transition-all duration-150"
          />
        </div>

        {/* Action Buttons: 8px radius per DESIGN.md */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="w-1/3 h-10 px-3 rounded-lg bg-transparent hover:bg-red-50 hover:border-red-300 border border-[#D6D3D1] text-[#57534E] hover:text-[#DC2626] text-xs font-semibold transition-colors cursor-pointer"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel Bill'}
          </button>

          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="w-2/3 h-10 px-4 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold flex items-center justify-center space-x-2 shadow-[0_4px_12px_rgba(194,65,12,0.25)] transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isConfirming ? 'Confirming...' : 'Mark as Paid (Enter)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
