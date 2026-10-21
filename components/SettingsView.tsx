'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Store, QrCode, Shield, Users, Save, Check, UserPlus, Trash2, AlertCircle, Lock, Percent, Tag, Printer } from 'lucide-react';
import { apiRequest, AuthUser } from '../lib/api';
import { ThermalPaperSize, getSavedThermalPaperSize, saveThermalPaperSize, printThermalReceipt } from '../lib/receipt';

interface SettingsViewProps {
  shopSettings?: any;
  refreshSettings: () => Promise<void>;
  currentUser?: AuthUser | null;
}

export default function SettingsView({ shopSettings, refreshSettings, currentUser }: SettingsViewProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  const [gstin, setGstin] = useState('');
  const [defaultTax, setDefaultTax] = useState('5');
  const [defaultDiscount, setDefaultDiscount] = useState('0');
  const [allowProductGstOverride, setAllowProductGstOverride] = useState(true);
  const [allowProductDiscount, setAllowProductDiscount] = useState(true);
  const [priceIncludesTax, setPriceIncludesTax] = useState(true);
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [roundOff, setRoundOff] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [thermalPaperSize, setThermalPaperSize] = useState<ThermalPaperSize>('58mm');

  useEffect(() => {
    setThermalPaperSize(getSavedThermalPaperSize());
  }, []);

  const handlePaperSizeSelect = (size: ThermalPaperSize) => {
    setThermalPaperSize(size);
    saveThermalPaperSize(size);
  };

  const handleTestPrint = () => {
    printThermalReceipt({
      shopName: name || 'Billo Retail Store',
      shopAddress: address || 'Shop 1, Main Road, Market Area',
      shopPhone: phone || '9820098200',
      gstin: gstin || '27AAAAA0000A1Z5',
      billNo: 101,
      date: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      cashierName: currentUser?.name || 'Owner',
      customerName: 'Test Customer',
      customerPhone: '9820098200',
      items: [
        { name: 'Tata Salt 1kg', qty: 1, pricePaise: 2800 },
        { name: 'Maggi Noodles 280g', qty: 2, pricePaise: 5500 },
        { name: 'Fortune Oil 1L', qty: 1, pricePaise: 16500 },
      ],
      subtotalPaise: 30300,
      discountPaise: 1500,
      taxPaise: 1440,
      totalPaise: 30240,
      priceIncludesTax: true,
      payments: [{ method: 'CASH', amountPaise: 30240, cashReceivedPaise: 35000, changeGivenPaise: 4760 }],
    }, thermalPaperSize);
  };

  // Team
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');

  const isOwner = currentUser?.role === 'OWNER';

  useEffect(() => {
    if (shopSettings) {
      setName(shopSettings.name || '');
      setPhone(shopSettings.phone || '');
      setAddress(shopSettings.address || '');
      setUpiId(shopSettings.upiId || '');
      setUpiName(shopSettings.upiName || '');
      setGstin(shopSettings.gstin || '');
      setDefaultTax(shopSettings.defaultTax?.toString() || '5');
      setDefaultDiscount(shopSettings.defaultDiscount?.toString() || '0');
      setAllowProductGstOverride(shopSettings.allowProductGstOverride ?? true);
      setAllowProductDiscount(shopSettings.allowProductDiscount ?? true);
      setPriceIncludesTax(shopSettings.priceIncludesTax ?? true);
      setInvoicePrefix(shopSettings.invoicePrefix || 'INV');
      setRoundOff(shopSettings.roundOff ?? true);
    }
    if (isOwner) {
      fetchTeam();
    }
  }, [shopSettings, isOwner]);

  const fetchTeam = async () => {
    const res = await apiRequest('/api/team');
    if (res.success && Array.isArray(res.data)) {
      setTeamMembers(res.data);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      alert('Only the shop owner can modify store settings.');
      return;
    }
    try {
      setIsSaving(true);
      const res = await apiRequest('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          upiId: upiId.trim() || null,
          upiName: upiName.trim() || null,
          gstin: gstin.trim() || null,
          defaultTax: parseFloat(defaultTax) || 0,
          defaultDiscount: Math.min(100, Math.max(0, parseFloat(defaultDiscount) || 0)),
          allowProductGstOverride,
          allowProductDiscount,
          priceIncludesTax,
          invoicePrefix: invoicePrefix.trim() || 'INV',
          roundOff,
        }),
      });

      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await refreshSettings();
      } else {
        alert(`Failed to save settings: ${res.error?.message}`);
      }
    } catch (e: any) {
      alert(`Error: ${e?.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName || !memberEmail || !memberPassword) return;

    const res = await apiRequest('/api/team', {
      method: 'POST',
      body: JSON.stringify({
        name: memberName.trim(),
        email: memberEmail.trim(),
        password: memberPassword,
      }),
    });

    if (res.success) {
      setIsAddMemberOpen(false);
      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
      await fetchTeam();
    } else {
      alert(`Failed to add cashier: ${res.error?.message}`);
    }
  };

  const handleDeleteMember = async (id: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove team member "${memberName}"?`)) return;

    const res = await apiRequest(`/api/team/${id}`, { method: 'DELETE' });
    if (res.success) {
      await fetchTeam();
    } else {
      alert(`Failed to remove member: ${res.error?.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-[#FAFAF9] text-[#1C1917] font-sans select-none space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917] flex items-center space-x-2.5">
          <Settings className="w-5 h-5 text-[#C2410C]" />
          <span>Shop Configuration & Multi-Tender Settings</span>
        </h1>
        <p className="text-sm text-[#57534E] mt-0.5">
          Configure shop identity, NPCI UPI VPA address, GST compliance & cashier team access
        </p>
      </div>

      {/* Staff Member Notice Banner (if not owner) */}
      {!isOwner && currentUser && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-semibold text-sm">
              Signed in as Cashier Staff Member ({currentUser.name})
            </p>
            <p className="text-amber-800">
              Store configuration (UPI ID, GSTIN, invoice prefixes) and team management can only be modified by the Store Owner.
            </p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
        {/* Store Profile */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 space-y-4">
          <h2 className="font-display text-sm font-bold text-[#1C1917] flex items-center space-x-2 pb-2 border-b border-[#D6D3D1]">
            <Store className="w-4 h-4 text-[#C2410C]" />
            <span>Store Profile & Tax Identity</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                Store / Business Name *
              </label>
              <input
                type="text"
                required
                disabled={!isOwner}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shree Ganesh Supermarket"
                className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                Store Contact Phone
              </label>
              <input
                type="tel"
                disabled={!isOwner}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9820098200"
                className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C] disabled:opacity-60"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                Store Physical Address
              </label>
              <input
                type="text"
                disabled={!isOwner}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Shop 4, MG Road, Mumbai, Maharashtra 400001"
                className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C] disabled:opacity-60"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                GSTIN / Tax ID (15 characters)
              </label>
              <input
                type="text"
                disabled={!isOwner}
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="e.g. 27AAAAA0000A1Z5"
                maxLength={15}
                className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C] disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Store Pricing, GST & Discount Privileges Card */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-[#D6D3D1]">
            <h2 className="font-display text-sm font-bold text-[#1C1917] flex items-center space-x-2">
              <Percent className="w-4 h-4 text-[#C2410C]" />
              <span>Store Pricing, GST & Discount Privileges</span>
            </h2>
            <span className="text-[11px] font-semibold text-[#57534E] bg-[#FAFAF9] px-2.5 py-1 rounded border border-[#D6D3D1]">
              Store & Product Level Rules
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Store-Level Default GST Rate */}
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                Store-Level Default GST Rate (%) *
              </label>
              <select
                disabled={!isOwner}
                value={defaultTax}
                onChange={(e) => setDefaultTax(e.target.value)}
                className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C] disabled:opacity-60"
              >
                <option value="0">0% (Nil / Exempt)</option>
                <option value="5">5% (Standard Groceries & Essentials)</option>
                <option value="12">12% (Packaged Goods & Dairy)</option>
                <option value="18">18% (Standard Retail & Goods)</option>
                <option value="28">28% (Luxury & Electronics)</option>
              </select>
              <p className="text-[11px] text-[#78716C] mt-1">
                Base tax slab applied to all sales and new catalog items.
              </p>
            </div>

            {/* Store-Level Default Discount */}
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                Store-Level Default Discount Offer (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  disabled={!isOwner}
                  value={defaultDiscount}
                  onChange={(e) => setDefaultDiscount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C] disabled:opacity-60 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#78716C]">%</span>
              </div>
              <p className="text-[11px] text-[#78716C] mt-1">
                Default store promotional discount; cashiers can apply it in 1-click in POS billing.
              </p>
            </div>
          </div>

          {/* Product-Level Privilege Toggles */}
          <div className="pt-2 border-t border-[#D6D3D1] space-y-3">
            <div className="text-xs font-semibold text-[#1C1917]">
              Product-Level Policy & Privilege Controls
            </div>

            <div className="flex items-start space-x-3 p-3.5 bg-[#FAFAF9] rounded-lg border border-[#D6D3D1]">
              <input
                type="checkbox"
                id="allowProductGstOverride"
                disabled={!isOwner}
                checked={allowProductGstOverride}
                onChange={(e) => setAllowProductGstOverride(e.target.checked)}
                className="w-4 h-4 text-[#C2410C] rounded bg-[#FAFAF9] border-[#D6D3D1] focus:ring-0 mt-0.5 cursor-pointer"
              />
              <div className="flex-1">
                <label htmlFor="allowProductGstOverride" className="text-xs font-semibold text-[#1C1917] cursor-pointer block">
                  Allow Product-Level GST Customization
                </label>
                <p className="text-[11px] text-[#57534E] mt-0.5 leading-relaxed">
                  {allowProductGstOverride
                    ? `Enabled: Each product in the inventory catalog can configure its own individual GST slab (0%, 5%, 12%, 18%, 28%).`
                    : `Disabled: All products are strictly locked to the store default GST rate (${defaultTax}%). Individual product tax customization is disabled.`}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3.5 bg-[#FAFAF9] rounded-lg border border-[#D6D3D1]">
              <input
                type="checkbox"
                id="allowProductDiscount"
                disabled={!isOwner}
                checked={allowProductDiscount}
                onChange={(e) => setAllowProductDiscount(e.target.checked)}
                className="w-4 h-4 text-[#C2410C] rounded bg-[#FAFAF9] border-[#D6D3D1] focus:ring-0 mt-0.5 cursor-pointer"
              />
              <div className="flex-1">
                <label htmlFor="allowProductDiscount" className="text-xs font-semibold text-[#1C1917] cursor-pointer block">
                  Allow Product-Level Discounts
                </label>
                <p className="text-[11px] text-[#57534E] mt-0.5 leading-relaxed">
                  {allowProductDiscount
                    ? `Enabled: Individual products can have custom promotional discount percentages configured in the inventory catalog.`
                    : `Disabled: Individual product discounts are restricted. Only store-level bill discounts can be granted at checkout.`}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3.5 bg-[#FAFAF9] rounded-lg border border-[#D6D3D1]">
              <input
                type="checkbox"
                id="priceIncludesTax"
                disabled={!isOwner}
                checked={priceIncludesTax}
                onChange={(e) => setPriceIncludesTax(e.target.checked)}
                className="w-4 h-4 text-[#C2410C] rounded bg-[#FAFAF9] border-[#D6D3D1] focus:ring-0 mt-0.5 cursor-pointer"
              />
              <div className="flex-1">
                <label htmlFor="priceIncludesTax" className="text-xs font-semibold text-[#1C1917] cursor-pointer block">
                  Product Catalog Prices Include GST (MRP / Retail Standard)
                </label>
                <p className="text-[11px] text-[#57534E] mt-0.5 leading-relaxed">
                  {priceIncludesTax
                    ? `Enabled: Prices in product catalog are retail prices (MRP) that already include GST. Tax is extracted from the price and customer pays the listed price.`
                    : `Disabled: Prices in product catalog are base prices (B2B / Wholesale). GST is calculated and added on top of the product price at checkout.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* UPI Soundbox / QR Configuration */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 space-y-4">
          <h2 className="font-display text-sm font-bold text-[#1C1917] flex items-center space-x-2 pb-2 border-b border-[#D6D3D1]">
            <QrCode className="w-4 h-4 text-[#C2410C]" />
            <span>Digital UPI QR & Soundbox VPA</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                Merchant UPI ID (VPA) *
              </label>
              <input
                type="text"
                disabled={!isOwner}
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. ganeshretail@okhdfcbank"
                className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C] disabled:opacity-60"
              />
              <p className="text-[11px] text-[#78716C] mt-1">
                Dynamic UPI intent QR codes will be generated directly to this VPA.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                UPI Payee Name (Shown on Customer App)
              </label>
              <input
                type="text"
                disabled={!isOwner}
                value={upiName}
                onChange={(e) => setUpiName(e.target.value)}
                placeholder="e.g. Shree Ganesh Retail"
                className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C] disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* POS Invoicing Rules */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 space-y-4">
          <h2 className="font-display text-sm font-bold text-[#1C1917] flex items-center space-x-2 pb-2 border-b border-[#D6D3D1]">
            <Shield className="w-4 h-4 text-[#C2410C]" />
            <span>POS Invoicing & Rounding Rules</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                Bill Prefix
              </label>
              <input
                type="text"
                disabled={!isOwner}
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C] disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <input
              type="checkbox"
              id="roundOff"
              disabled={!isOwner}
              checked={roundOff}
              onChange={(e) => setRoundOff(e.target.checked)}
              className="w-4 h-4 text-[#C2410C] rounded bg-[#FAFAF9] border-[#D6D3D1] focus:ring-0"
            />
            <label htmlFor="roundOff" className="text-xs text-[#57534E] font-medium cursor-pointer">
              Automatically round bill grand totals to nearest ₹1.00 (Cashier Ergonomics)
            </label>
          </div>
        </div>

        {/* Thermal Printer & Receipt Settings */}
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#D6D3D1]">
            <h2 className="font-display text-sm font-bold text-[#1C1917] flex items-center space-x-2">
              <Printer className="w-4 h-4 text-[#C2410C]" />
              <span>Thermal Receipt Printer Configuration</span>
            </h2>
            <span className="text-[11px] font-semibold text-[#57534E] bg-[#FAFAF9] px-2.5 py-1 rounded border border-[#D6D3D1]">
              Hardware POS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                Default Thermal Paper Roll Size *
              </label>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => handlePaperSizeSelect('58mm')}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    thermalPaperSize === '58mm'
                      ? 'bg-white border-[#C2410C] shadow-xs ring-1 ring-[#C2410C]'
                      : 'bg-[#FAFAF9] border-[#D6D3D1] hover:border-[#78716C]'
                  }`}
                >
                  <div className="font-bold text-xs text-[#1C1917] flex items-center justify-between">
                    <span>2" Roll (58mm)</span>
                    {thermalPaperSize === '58mm' && <Check className="w-3.5 h-3.5 text-[#C2410C]" />}
                  </div>
                  <div className="text-[10px] text-[#78716C] mt-1 leading-snug">
                    Seznik Veer, MPT-II, POS-58
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePaperSizeSelect('80mm')}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    thermalPaperSize === '80mm'
                      ? 'bg-white border-[#C2410C] shadow-xs ring-1 ring-[#C2410C]'
                      : 'bg-[#FAFAF9] border-[#D6D3D1] hover:border-[#78716C]'
                  }`}
                >
                  <div className="font-bold text-xs text-[#1C1917] flex items-center justify-between">
                    <span>3" Roll (80mm)</span>
                    {thermalPaperSize === '80mm' && <Check className="w-3.5 h-3.5 text-[#C2410C]" />}
                  </div>
                  <div className="text-[10px] text-[#78716C] mt-1 leading-snug">
                    Standard wider retail desktop printers
                  </div>
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                Test Print on Machine
              </label>
              <button
                type="button"
                onClick={handleTestPrint}
                className="h-10 px-4 bg-white hover:bg-stone-50 border border-[#D6D3D1] hover:border-[#C2410C] rounded-lg text-xs font-semibold text-[#1C1917] flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4 text-[#C2410C]" />
                <span>Test Print Sample Receipt ({thermalPaperSize === '58mm' ? '2" Roll' : '3" Roll'})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        {isOwner ? (
          <div className="flex items-center space-x-3">
            <button
              type="submit"
              disabled={isSaving}
              className="h-11 px-6 bg-[#C2410C] hover:bg-[#9A3412] disabled:opacity-50 text-white font-semibold text-sm rounded-lg flex items-center space-x-2 shadow-[0_4px_12px_rgba(194,65,12,0.25)] transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
            </button>
            {saveSuccess && (
              <span className="text-xs font-semibold text-[#16A34A] flex items-center space-x-1">
                <Check className="w-4 h-4" />
                <span>Settings saved successfully!</span>
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-xs text-[#78716C] bg-stone-100 p-3 rounded-lg border border-[#D6D3D1]">
            <Lock className="w-4 h-4 text-[#78716C]" />
            <span>Store settings are locked in Staff view. Contact the store owner to make modifications.</span>
          </div>
        )}
      </form>

      {/* Cashier Permissions Info / Team Management */}
      {!isOwner && currentUser ? (
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 space-y-4 max-w-4xl">
          <div className="pb-2 border-b border-[#D6D3D1]">
            <h2 className="font-display text-sm font-bold text-[#1C1917] flex items-center space-x-2">
              <Shield className="w-4 h-4 text-[#C2410C]" />
              <span>Your Assigned Staff Role & Authorization Limits</span>
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Role-Based Access Control (RBAC) enforced by store owner
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white border border-[#D6D3D1] rounded-lg">
              <div className="text-[#78716C] text-[11px] font-medium">Discount Authorization</div>
              <div className="text-sm font-bold text-[#1C1917] mt-0.5">
                Up to {currentUser.permissions?.discountLimit ?? 0}%
              </div>
              <div className="text-[10px] text-[#57534E] mt-1">Maximum bill discount percentage</div>
            </div>

            <div className="p-3 bg-white border border-[#D6D3D1] rounded-lg">
              <div className="text-[#78716C] text-[11px] font-medium">Stock Adjustments</div>
              <div className="text-sm font-bold text-green-700 mt-0.5">
                {currentUser.permissions?.stockAdjust ? 'Allowed' : 'Restricted'}
              </div>
              <div className="text-[10px] text-[#57534E] mt-1">Restock and manual inventory corrections</div>
            </div>

            <div className="p-3 bg-white border border-[#D6D3D1] rounded-lg">
              <div className="text-[#78716C] text-[11px] font-medium">Sales Analytics & Reports</div>
              <div className="text-sm font-bold text-[#1C1917] mt-0.5">
                {currentUser.permissions?.reports ? 'View Allowed' : 'Restricted'}
              </div>
              <div className="text-[10px] text-[#57534E] mt-1">Access to store sales reports</div>
            </div>

            <div className="p-3 bg-white border border-[#D6D3D1] rounded-lg">
              <div className="text-[#78716C] text-[11px] font-medium">Price Overrides</div>
              <div className="text-sm font-bold text-[#78716C] mt-0.5">
                {currentUser.permissions?.priceChange ? 'Allowed' : 'Restricted (Owner only)'}
              </div>
              <div className="text-[10px] text-[#57534E] mt-1">Changing catalog product pricing</div>
            </div>

            <div className="p-3 bg-white border border-[#D6D3D1] rounded-lg">
              <div className="text-[#78716C] text-[11px] font-medium">Paid Bill Cancellation</div>
              <div className="text-sm font-bold text-[#78716C] mt-0.5">
                {currentUser.permissions?.cancelBills ? 'Allowed' : 'Restricted (Owner only)'}
              </div>
              <div className="text-[10px] text-[#57534E] mt-1">Cancelling completed customer bills</div>
            </div>

            <div className="p-3 bg-white border border-[#D6D3D1] rounded-lg">
              <div className="text-[#78716C] text-[11px] font-medium">Delete / Archive Products</div>
              <div className="text-sm font-bold text-[#78716C] mt-0.5">
                {currentUser.permissions?.deleteProducts ? 'Allowed' : 'Restricted (Owner only)'}
              </div>
              <div className="text-[10px] text-[#57534E] mt-1">Removing products from store catalog</div>
            </div>

            <div className="p-3 bg-white border border-[#D6D3D1] rounded-lg">
              <div className="text-[#78716C] text-[11px] font-medium">Store Base GST</div>
              <div className="text-sm font-bold text-[#1C1917] mt-0.5">
                {shopSettings?.defaultTax ?? 5}% GST
              </div>
              <div className="text-[10px] text-[#57534E] mt-1">
                {shopSettings?.allowProductGstOverride ? 'Product override allowed' : 'Strictly locked across catalog'}
              </div>
            </div>

            <div className="p-3 bg-white border border-[#D6D3D1] rounded-lg">
              <div className="text-[#78716C] text-[11px] font-medium">Product-Level Discounts</div>
              <div className="text-sm font-bold text-[#1C1917] mt-0.5">
                {shopSettings?.allowProductDiscount ? 'Permitted' : 'Disabled by Store'}
              </div>
              <div className="text-[10px] text-[#57534E] mt-1">
                Store offer: {shopSettings?.defaultDiscount ?? 0}%
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Team Management (Owner Only) */
        <div className="bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl p-5 space-y-4 max-w-4xl">
          <div className="flex items-center justify-between pb-2 border-b border-[#D6D3D1]">
            <h2 className="font-display text-sm font-bold text-[#1C1917] flex items-center space-x-2">
              <Users className="w-4 h-4 text-[#C2410C]" />
              <span>Cashier & Staff Accounts ({teamMembers.length}/5)</span>
            </h2>

            <button
              onClick={() => setIsAddMemberOpen(true)}
              disabled={teamMembers.filter((m) => m.role === 'MEMBER').length >= 5}
              className="h-9 px-3 bg-transparent hover:bg-[#E7E5E4] disabled:opacity-40 text-[#1C1917] border border-[#D6D3D1] text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Cashier</span>
            </button>
          </div>

          <div className="divide-y divide-[#D6D3D1]">
            {teamMembers.map((member) => (
              <div key={member.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-[#1C1917] block">{member.name}</span>
                  <span className="text-[11px] text-[#78716C]">{member.email}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      member.role === 'OWNER'
                        ? 'bg-[#FFEDD5] text-[#C2410C] border border-[#C2410C]/20'
                        : 'bg-[#FAFAF9] text-[#57534E] border border-[#D6D3D1]'
                    }`}
                  >
                    {member.role}
                  </span>

                  {member.role !== 'OWNER' && (
                    <button
                      onClick={() => handleDeleteMember(member.id, member.name)}
                      className="text-[#78716C] hover:text-[#DC2626] transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Member Modal (Owner only) */}
      {isAddMemberOpen && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-4">
          <div className="bg-[#F5F5F4] border border-[#D6D3D1] w-full max-w-sm rounded-xl p-6 shadow-[0_24px_48px_rgba(28,25,23,0.12)]">
            <h3 className="font-display text-base font-bold text-[#1C1917] mb-4">Add Cashier / Member</h3>
            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Kumar"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. cashier@billdesk.local"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="h-9 px-3 bg-transparent hover:bg-[#E7E5E4] text-[#57534E] border border-[#D6D3D1] rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold rounded-lg text-xs shadow-xs"
                >
                  Create Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
