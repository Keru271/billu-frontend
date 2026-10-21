'use client';

import React, { useState } from 'react';
import { X, Play, Trash2, PauseCircle, Plus } from 'lucide-react';

interface HeldCartItem {
  id: string;
  label?: string | null;
  items: any[];
  createdAt: string;
}

interface HeldCartsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  heldCarts: HeldCartItem[];
  onParkCurrentCart: (label?: string) => Promise<void>;
  onResumeCart: (cartId: string) => Promise<void>;
  onDiscardCart: (cartId: string) => Promise<void>;
  hasItemsInCart: boolean;
}

export default function HeldCartsDrawer({
  isOpen,
  onClose,
  heldCarts,
  onParkCurrentCart,
  onResumeCart,
  onDiscardCart,
  hasItemsInCart,
}: HeldCartsDrawerProps) {
  const [parkLabel, setParkLabel] = useState('');
  const [isParking, setIsParking] = useState(false);

  if (!isOpen) return null;

  const handlePark = async () => {
    if (!hasItemsInCart) return;
    try {
      setIsParking(true);
      await onParkCurrentCart(parkLabel.trim() || undefined);
      setParkLabel('');
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsParking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#1C1917]/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full sm:max-w-md bg-[#FAFAF9] border-l border-[#D6D3D1] h-full flex flex-col p-4 sm:p-6 shadow-[0_24px_48px_rgba(28,25,23,0.12)] animate-in slide-in-from-right duration-200 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D6D3D1]">
          <div className="flex items-center space-x-2">
            <PauseCircle className="w-5 h-5 text-[#C2410C]" />
            <h2 className="font-display text-base font-bold text-[#1C1917]">Parked Carts (Hold & Resume)</h2>
            <span className="text-xs bg-[#FFEDD5] text-[#C2410C] font-semibold px-2 py-0.5 rounded-full border border-[#C2410C]/20 font-mono">
              {heldCarts.length}/10
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#78716C] hover:text-[#1C1917] p-1 rounded-lg hover:bg-[#E7E5E4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Park Current Cart Form */}
        <div className="my-5 p-4 rounded-xl bg-[#F5F5F4] border border-[#D6D3D1]">
          <div className="text-xs font-semibold text-[#1C1917] mb-2">Park Current Cart (F4)</div>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="e.g. Waiting for Milk / Customer in Red Shirt"
              value={parkLabel}
              onChange={(e) => setParkLabel(e.target.value)}
              disabled={!hasItemsInCart}
              className="flex-1 bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#C2410C] focus:ring-3 focus:ring-[#C2410C]/15 disabled:opacity-50"
            />
            <button
              onClick={handlePark}
              disabled={!hasItemsInCart || isParking || heldCarts.length >= 10}
              className="h-9 px-3.5 bg-[#C2410C] hover:bg-[#9A3412] disabled:bg-[#E7E5E4] disabled:text-[#78716C] text-white rounded-lg font-semibold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isParking ? 'Parking...' : 'Hold'}</span>
            </button>
          </div>
          {!hasItemsInCart && (
            <p className="text-[11px] text-[#78716C] mt-2">
              Add items to active cart first to park it.
            </p>
          )}
        </div>

        {/* Held Carts List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {heldCarts.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-[#78716C] text-xs">
              <PauseCircle className="w-8 h-8 text-[#D6D3D1] mb-2 stroke-1" />
              <p className="text-[#1C1917] font-semibold">No parked carts currently.</p>
              <p className="text-[#78716C] mt-0.5">Press F4 while billing to hold an active customer cart.</p>
            </div>
          ) : (
            heldCarts.map((c) => {
              const itemCount = Array.isArray(c.items) ? c.items.length : 0;
              const cartTotalPaise = Array.isArray(c.items)
                ? c.items.reduce((acc, curr) => acc + (curr.pricePaise || 0) * (curr.qty || 1), 0)
                : 0;

              return (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-[#F5F5F4] border border-[#D6D3D1] hover:shadow-[0_4px_16px_rgba(28,25,23,0.06)] transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-[#1C1917]">
                        {c.label || 'Parked Cart'}
                      </h4>
                      <div className="text-[11px] text-[#57534E] mt-0.5 font-mono">
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {itemCount} items
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-[#C2410C] font-mono tabular-nums">
                        ₹{(cartTotalPaise / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#D6D3D1]">
                    <button
                      onClick={() => onDiscardCart(c.id)}
                      className="px-2.5 py-1.5 text-xs text-[#78716C] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Discard</span>
                    </button>
                    <button
                      onClick={() => {
                        onResumeCart(c.id);
                        onClose();
                      }}
                      className="h-8 px-3 text-xs bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold rounded-lg transition-all flex items-center space-x-1.5 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume Cart</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
