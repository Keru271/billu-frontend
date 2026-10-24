'use client';

import React, { useState } from 'react';
import { Package, Plus, Search, AlertTriangle, Trash2, FolderPlus, Image as ImageIcon, Edit2, Percent, Tag, Lock, Check, X, UploadCloud } from 'lucide-react';
import { Product, CategoryItem } from './POSBilling';
import { apiRequest, AuthUser } from '../lib/api';
import ImageUploader from './ImageUploader';

interface InventoryViewProps {
  products: Product[];
  categories: CategoryItem[];
  refreshData: () => Promise<void>;
  currentUser?: AuthUser | null;
  shopSettings?: any;
}

export default function InventoryView({
  products,
  categories,
  refreshData,
  currentUser,
  shopSettings,
}: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Store-level GST & Discount Privileges
  const allowProductGstOverride = shopSettings?.allowProductGstOverride ?? true;
  const allowProductDiscount = shopSettings?.allowProductDiscount ?? true;
  const storeDefaultTax = shopSettings?.defaultTax !== undefined ? Number(shopSettings.defaultTax) : 5;

  // Add Product Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priceRupees, setPriceRupees] = useState('');
  const [taxPct, setTaxPct] = useState(storeDefaultTax.toString());
  const [discountPct, setDiscountPct] = useState('0');
  const [stock, setStock] = useState('');
  const [barcode, setBarcode] = useState('');
  const [hsn, setHsn] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [imageUrl, setImageUrl] = useState('');

  // Edit Product Modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editPriceRupees, setEditPriceRupees] = useState('');
  const [editTaxPct, setEditTaxPct] = useState(storeDefaultTax.toString());
  const [editDiscountPct, setEditDiscountPct] = useState('0');
  const [editBarcode, setEditBarcode] = useState('');
  const [editHsn, setEditHsn] = useState('');
  const [editReorderLevel, setEditReorderLevel] = useState('5');
  const [editImageUrl, setEditImageUrl] = useState('');

  // Manage Categories Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryImageUrl, setNewCategoryImageUrl] = useState('');

  // Edit Category State
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryImageUrl, setEditCategoryImageUrl] = useState('');

  // Restock Modal
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockReason, setRestockReason] = useState<'RESTOCK' | 'ADJUST'>('RESTOCK');

  const isOwner = currentUser?.role === 'OWNER';
  const canDelete = isOwner || Boolean(currentUser?.permissions?.deleteProducts);
  const canRestock = isOwner || Boolean(currentUser?.permissions?.stockAdjust);
  const canEdit = isOwner || Boolean(currentUser?.permissions?.priceChange);

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditCategoryId(p.categoryId || '');
    setEditPriceRupees((p.pricePaise / 100).toFixed(2));
    setEditTaxPct((p.taxPct ?? storeDefaultTax).toString());
    setEditDiscountPct((p.discountPct || 0).toString());
    setEditBarcode(p.barcode || '');
    setEditHsn(p.hsn || '');
    setEditReorderLevel((p.reorderLevel ?? 5).toString());
    setEditImageUrl(p.imageUrl || '');
  };

  const filtered = products.filter((p) => {
    const matchCat = filterCat === 'all' || p.categoryId === filterCat;
    const matchQ =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search) ||
      p.hsn?.includes(search);
    const matchLow = !lowStockOnly || p.stock <= p.reorderLevel;
    return matchCat && matchQ && matchLow;
  });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !priceRupees) {
      alert('Product name and price are required.');
      return;
    }

    const effectiveTaxPct = allowProductGstOverride
      ? (parseFloat(taxPct) || 0)
      : storeDefaultTax;
    const effectiveDiscountPct = allowProductDiscount
      ? Math.min(100, Math.max(0, parseFloat(discountPct) || 0))
      : 0;

    const res = await apiRequest('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        categoryId: categoryId || null,
        pricePaise: Math.round(parseFloat(priceRupees) * 100),
        taxPct: effectiveTaxPct,
        discountPct: effectiveDiscountPct,
        stock: parseInt(stock, 10) || 0,
        barcode: barcode.trim() || null,
        hsn: hsn.trim() || null,
        reorderLevel: parseInt(reorderLevel, 10) || 5,
        imageUrl: imageUrl.trim() || null,
      }),
    });

    if (res.success) {
      setIsAddOpen(false);
      setName('');
      setPriceRupees('');
      setTaxPct(storeDefaultTax.toString());
      setDiscountPct('0');
      setStock('');
      setBarcode('');
      setHsn('');
      setImageUrl('');
      await refreshData();
    } else {
      alert(`Failed to add product: ${res.error?.message}`);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editName.trim() || !editPriceRupees) {
      alert('Product name and price are required.');
      return;
    }

    const effectiveTaxPct = allowProductGstOverride
      ? (parseFloat(editTaxPct) || 0)
      : storeDefaultTax;
    const effectiveDiscountPct = allowProductDiscount
      ? Math.min(100, Math.max(0, parseFloat(editDiscountPct) || 0))
      : 0;

    const res = await apiRequest(`/api/products/${editingProduct.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editName.trim(),
        categoryId: editCategoryId || null,
        pricePaise: Math.round(parseFloat(editPriceRupees) * 100),
        taxPct: effectiveTaxPct,
        discountPct: effectiveDiscountPct,
        barcode: editBarcode.trim() || null,
        hsn: editHsn.trim() || null,
        reorderLevel: parseInt(editReorderLevel, 10) || 5,
        imageUrl: editImageUrl.trim() || null,
      }),
    });

    if (res.success) {
      setEditingProduct(null);
      await refreshData();
    } else {
      alert(`Failed to update product: ${res.error?.message}`);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const res = await apiRequest('/api/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: newCategoryName.trim(),
        imageUrl: newCategoryImageUrl.trim() || null,
      }),
    });

    if (res.success) {
      setNewCategoryName('');
      setNewCategoryImageUrl('');
      await refreshData();
    } else {
      alert(`Failed to add category: ${res.error?.message}`);
    }
  };

  const openEditCategory = (c: CategoryItem) => {
    setEditingCategory(c);
    setEditCategoryName(c.name);
    setEditCategoryImageUrl(c.imageUrl || '');
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCategoryName.trim()) return;

    const res = await apiRequest(`/api/categories/${editingCategory.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editCategoryName.trim(),
        imageUrl: editCategoryImageUrl.trim() || null,
      }),
    });

    if (res.success) {
      setEditingCategory(null);
      await refreshData();
    } else {
      alert(`Failed to update category: ${res.error?.message}`);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete category "${name}"? Products in this category will become General.`
      )
    ) {
      return;
    }
    const res = await apiRequest(`/api/categories/${id}`, {
      method: 'DELETE',
    });
    if (res.success) {
      if (editingCategory?.id === id) setEditingCategory(null);
      await refreshData();
    } else {
      alert(`Failed to delete category: ${res.error?.message}`);
    }
  };

  const handleRestock = async () => {
    if (!restockProduct || !restockQty) return;
    const qtyChange = parseInt(restockQty, 10);
    if (isNaN(qtyChange)) return;

    const res = await apiRequest(`/api/products/${restockProduct.id}/restock`, {
      method: 'POST',
      body: JSON.stringify({
        qtyChange,
        reason: restockReason,
      }),
    });

    if (res.success) {
      setRestockProduct(null);
      setRestockQty('');
      await refreshData();
    } else {
      alert(`Restock failed: ${res.error?.message}`);
    }
  };

  const handleDeleteProduct = async (id: string, prodName: string) => {
    if (!confirm(`Are you sure you want to archive "${prodName}"?`)) return;
    const res = await apiRequest(`/api/products/${id}`, { method: 'DELETE' });
    if (res.success) {
      await refreshData();
    } else {
      alert(`Delete failed: ${res.error?.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden bg-[#FAFAF9] text-[#1C1917] font-sans select-none">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917] flex items-center space-x-2.5">
            <Package className="w-5 h-5 text-[#C2410C] shrink-0" />
            <span>Product Catalog & Stock Management</span>
          </h1>
          <p className="text-sm text-[#57534E] mt-0.5">
            Manage store inventory, product images, categories, barcodes, and restock logs
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex-1 sm:flex-none h-10 px-3.5 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#1C1917] font-semibold text-xs rounded-lg flex items-center justify-center space-x-1.5 border border-[#D6D3D1] transition-all cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-[#C2410C]" />
            <span>Categories ({categories.length})</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            className="flex-1 sm:flex-none h-10 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold text-sm rounded-lg flex items-center justify-center space-x-1.5 shadow-[0_4px_12px_rgba(194,65,12,0.25)] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 bg-[#F5F5F4] rounded-xl border border-[#D6D3D1] mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
          <input
            type="text"
            placeholder="Search by name, barcode, or HSN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#C2410C] focus:ring-3 focus:ring-[#C2410C]/15"
          />
        </div>

        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
        >
          <option value="all">All Categories ({products.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            lowStockOnly
              ? 'bg-[#FFEDD5] border border-[#C2410C]/30 text-[#C2410C]'
              : 'bg-[#FAFAF9] border border-[#D6D3D1] text-[#57534E] hover:text-[#1C1917] hover:bg-[#E7E5E4]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
          <span>Low Stock Only</span>
        </button>
      </div>

      {/* Products Table */}
      <div className="flex-1 overflow-auto bg-[#F5F5F4] rounded-xl border border-[#D6D3D1]">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-[#E7E5E4] text-[#57534E] font-semibold border-b border-[#D6D3D1] sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4">Product Name & Image</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Barcode / HSN</th>
              <th className="py-3 px-4 text-right">Price & Offer</th>
              <th className="py-3 px-4 text-right">GST Slab</th>
              <th className="py-3 px-4 text-center">Stock Level</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D6D3D1] text-[#1C1917]">
            {filtered.map((p) => {
              const isLow = p.stock <= p.reorderLevel;
              const hasDiscount = Boolean(p.discountPct && p.discountPct > 0);
              const effectivePriceRupees = hasDiscount
                ? (p.pricePaise * (1 - (p.discountPct || 0) / 100)) / 100
                : p.pricePaise / 100;

              return (
                <tr key={p.id} className="hover:bg-[#E7E5E4]/50 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-[#1C1917]">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-[#FAFAF9] border border-[#D6D3D1] p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        <img
                          src={p.imageUrl || '/images/products/default-product.svg'}
                          alt={p.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as any).src = '/images/products/default-product.svg';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="truncate block font-semibold text-[#1C1917]">{p.name}</span>
                        {isLow && (
                          <span className="text-[10px] bg-amber-50 text-[#D97706] px-1.5 py-0.2 rounded border border-amber-200 font-semibold inline-block mt-0.5">
                            Low Stock
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#57534E] text-xs">
                    <span className="bg-[#FAFAF9] px-2 py-1 rounded border border-[#D6D3D1]">
                      {p.categoryName || 'General'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[#57534E]">
                    {p.barcode || '—'} {p.hsn ? `(HSN: ${p.hsn})` : ''}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {hasDiscount ? (
                      <div>
                        <div className="font-semibold text-emerald-700">
                          ₹{effectivePriceRupees.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-[#A8A29E] line-through">
                          ₹{(p.pricePaise / 100).toFixed(2)}
                        </div>
                        <span className="inline-block mt-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded">
                          {p.discountPct}% OFF
                        </span>
                      </div>
                    ) : (
                      <div className="font-semibold text-[#1C1917]">
                        ₹{(p.pricePaise / 100).toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-xs font-mono tabular-nums">
                    <span className="bg-[#FAFAF9] border border-[#D6D3D1] px-2 py-0.5 rounded text-[#1C1917] font-semibold inline-block">
                      {p.taxPct}%
                    </span>
                    {p.taxPct !== storeDefaultTax ? (
                      <span className="block text-[10px] text-[#C2410C] font-sans mt-0.5 font-medium">Custom</span>
                    ) : (
                      <span className="block text-[10px] text-[#78716C] font-sans mt-0.5 font-normal">Default</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold tabular-nums">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isLow ? 'bg-amber-50 text-[#D97706] border border-amber-200' : 'bg-[#FAFAF9] text-[#57534E] border border-[#D6D3D1]'
                      }`}
                    >
                      {p.stock} units
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    {canEdit && (
                      <button
                        onClick={() => openEditModal(p)}
                        className="px-2.5 py-1 bg-[#FAFAF9] hover:bg-[#E7E5E4] text-[#1C1917] border border-[#D6D3D1] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="Edit product, GST & discount"
                      >
                        Edit
                      </button>
                    )}
                    {canRestock && (
                      <button
                        onClick={() => {
                          setRestockProduct(p);
                          setRestockQty('');
                        }}
                        className="px-2.5 py-1 bg-[#FAFAF9] hover:bg-[#E7E5E4] text-[#C2410C] border border-[#D6D3D1] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="Restock or Adjust"
                      >
                        Restock
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteProduct(p.id, p.name)}
                        className="p-1 hover:text-[#DC2626] text-[#78716C] transition-colors cursor-pointer"
                        title="Archive product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Product Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-4">
          <div className="bg-[#F5F5F4] border border-[#D6D3D1] w-full max-w-lg rounded-xl p-6 shadow-[0_24px_48px_rgba(28,25,23,0.12)] max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-lg font-bold text-[#1C1917] mb-4">Add Product to Store Catalog</h3>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata Salt 1kg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              {/* Product Image Upload with Cloudinary */}
              <ImageUploader
                value={imageUrl}
                onChange={setImageUrl}
                folder="products"
                label="Product Image (Upload via Cloudinary)"
                defaultFallbackImage="/images/products/default-product.svg"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                  >
                    <option value="">General / None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 28.00"
                    value={priceRupees}
                    onChange={(e) => setPriceRupees(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">Initial Stock (Units)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">Low Stock Alert Level</label>
                  <input
                    type="number"
                    placeholder="5"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
              </div>

              {/* Product GST & Discount Privileges Card */}
              <div className="p-3.5 bg-[#FAFAF9] rounded-xl border border-[#D6D3D1] space-y-3">
                <div className="text-xs font-semibold text-[#1C1917] flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Percent className="w-3.5 h-3.5 text-[#C2410C]" />
                    <span>Product GST & Discount Privileges</span>
                  </div>
                  {!allowProductGstOverride && (
                    <span className="text-[10px] text-[#C2410C] bg-[#FFEDD5] px-1.5 py-0.5 rounded font-mono">
                      Store GST Locked ({storeDefaultTax}%)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                      GST Tax Slab (%)
                    </label>
                    {allowProductGstOverride ? (
                      <select
                        value={taxPct}
                        onChange={(e) => setTaxPct(e.target.value)}
                        className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                      >
                        <option value="0">0% (Nil / Exempt)</option>
                        <option value="5">5% (Standard Groceries)</option>
                        <option value="12">12% (Packaged Foods)</option>
                        <option value="18">18% (General Retail)</option>
                        <option value="28">28% (Luxury / Electronics)</option>
                      </select>
                    ) : (
                      <div className="w-full bg-[#E7E5E4] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#57534E] flex items-center justify-between">
                        <span>{storeDefaultTax}% (Store Default)</span>
                        <Lock className="w-3.5 h-3.5 text-[#78716C]" />
                      </div>
                    )}
                    <span className="text-[10px] text-[#78716C] mt-1 block">
                      {allowProductGstOverride ? 'Product-level override permitted' : 'Inherits store-level policy'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Product Discount (%)
                    </label>
                    {allowProductDiscount ? (
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="0"
                          value={discountPct}
                          onChange={(e) => setDiscountPct(e.target.value)}
                          className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C] pr-7"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#78716C] font-semibold">%</span>
                      </div>
                    ) : (
                      <div className="w-full bg-[#E7E5E4] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#57534E] flex items-center justify-between">
                        <span>0% (Disabled)</span>
                        <Lock className="w-3.5 h-3.5 text-[#78716C]" />
                      </div>
                    )}
                    <span className="text-[10px] text-[#78716C] mt-1 block">
                      {allowProductDiscount ? 'Direct product catalog discount' : 'Disabled by store policy'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">Barcode</label>
                  <input
                    type="text"
                    placeholder="e.g. 890103000001"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">HSN Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 2501"
                    value={hsn}
                    onChange={(e) => setHsn(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#D6D3D1]">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="h-10 px-4 bg-transparent hover:bg-[#E7E5E4] text-[#57534E] rounded-lg text-xs font-semibold border border-[#D6D3D1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold rounded-lg text-xs shadow-[0_4px_12px_rgba(194,65,12,0.25)]"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-4">
          <div className="bg-[#F5F5F4] border border-[#D6D3D1] w-full max-w-lg rounded-xl p-6 shadow-[0_24px_48px_rgba(28,25,23,0.12)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#D6D3D1]">
              <h3 className="font-display text-lg font-bold text-[#1C1917]">
                Edit Product, GST & Discount
              </h3>
              <span className="text-xs font-mono text-[#78716C] bg-[#E7E5E4] px-2 py-0.5 rounded">
                ID: {editingProduct.id.slice(0, 8)}
              </span>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata Salt 1kg"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              {/* Product Image Upload with Cloudinary */}
              <ImageUploader
                value={editImageUrl}
                onChange={setEditImageUrl}
                folder="products"
                label="Product Image (Upload via Cloudinary)"
                defaultFallbackImage="/images/products/default-product.svg"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">Category</label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                  >
                    <option value="">General / None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 28.00"
                    value={editPriceRupees}
                    onChange={(e) => setEditPriceRupees(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
              </div>

              {/* Product GST & Discount Privileges Card */}
              <div className="p-3.5 bg-[#FAFAF9] rounded-xl border border-[#D6D3D1] space-y-3">
                <div className="text-xs font-semibold text-[#1C1917] flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Percent className="w-3.5 h-3.5 text-[#C2410C]" />
                    <span>Product GST & Discount Privileges</span>
                  </div>
                  {!allowProductGstOverride && (
                    <span className="text-[10px] text-[#C2410C] bg-[#FFEDD5] px-1.5 py-0.5 rounded font-mono">
                      Store GST Locked ({storeDefaultTax}%)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                      GST Tax Slab (%)
                    </label>
                    {allowProductGstOverride ? (
                      <select
                        value={editTaxPct}
                        onChange={(e) => setEditTaxPct(e.target.value)}
                        className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                      >
                        <option value="0">0% (Nil / Exempt)</option>
                        <option value="5">5% (Standard Groceries)</option>
                        <option value="12">12% (Packaged Foods)</option>
                        <option value="18">18% (General Retail)</option>
                        <option value="28">28% (Luxury / Electronics)</option>
                      </select>
                    ) : (
                      <div className="w-full bg-[#E7E5E4] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#57534E] flex items-center justify-between">
                        <span>{storeDefaultTax}% (Store Default)</span>
                        <Lock className="w-3.5 h-3.5 text-[#78716C]" />
                      </div>
                    )}
                    <span className="text-[10px] text-[#78716C] mt-1 block">
                      {allowProductGstOverride ? 'Product-level override permitted' : 'Inherits store-level policy'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Product Discount (%)
                    </label>
                    {allowProductDiscount ? (
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="0"
                          value={editDiscountPct}
                          onChange={(e) => setEditDiscountPct(e.target.value)}
                          className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C] pr-7"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#78716C] font-semibold">%</span>
                      </div>
                    ) : (
                      <div className="w-full bg-[#E7E5E4] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#57534E] flex items-center justify-between">
                        <span>0% (Disabled)</span>
                        <Lock className="w-3.5 h-3.5 text-[#78716C]" />
                      </div>
                    )}
                    <span className="text-[10px] text-[#78716C] mt-1 block">
                      {allowProductDiscount ? 'Direct product catalog discount' : 'Disabled by store policy'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">Barcode</label>
                  <input
                    type="text"
                    placeholder="e.g. 890103000001"
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">HSN Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 2501"
                    value={editHsn}
                    onChange={(e) => setEditHsn(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Low Stock Alert Level</label>
                <input
                  type="number"
                  placeholder="5"
                  value={editReorderLevel}
                  onChange={(e) => setEditReorderLevel(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#D6D3D1]">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="h-10 px-4 bg-transparent hover:bg-[#E7E5E4] text-[#57534E] rounded-lg text-xs font-semibold border border-[#D6D3D1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold rounded-lg text-xs shadow-[0_4px_12px_rgba(194,65,12,0.25)]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn">
          <div className="bg-[#F5F5F4] border border-[#D6D3D1] w-full max-w-lg rounded-xl p-4 sm:p-6 shadow-[0_24px_48px_rgba(28,25,23,0.12)] max-h-[90vh] sm:max-h-[85vh] flex flex-col">
            <h3 className="font-display text-lg font-bold text-[#1C1917] mb-1">Store Categories & Icons</h3>
            <p className="text-xs text-[#57534E] mb-4">
              Categories help organize your catalog chips and filter reports
            </p>

            {/* Quick Add Category with Cloudinary Image Upload */}
            <form onSubmit={handleCreateCategory} className="bg-[#FAFAF9] p-3 rounded-lg border border-[#D6D3D1] mb-4 space-y-2.5">
              <span className="text-xs font-semibold text-[#1C1917] block">Add New Category</span>
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  placeholder="Category Name (e.g. Frozen Foods, Dairy, Snacks)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full bg-[#F5F5F4] border border-[#D6D3D1] rounded-lg px-3 py-2 text-xs text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
                <ImageUploader
                  value={newCategoryImageUrl}
                  onChange={setNewCategoryImageUrl}
                  folder="categories"
                  label="Category Icon (Upload via Cloudinary)"
                  compact={true}
                  defaultFallbackImage="/images/categories/default-category.svg"
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="h-8.5 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold text-xs rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Category</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Existing Categories List with Edit and Cloudinary Icon support */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
              {categories.map((c) => {
                const isEditing = editingCategory?.id === c.id;

                if (isEditing) {
                  return (
                    <form
                      key={c.id}
                      onSubmit={handleUpdateCategory}
                      className="p-3 bg-white rounded-xl border-2 border-[#C2410C] space-y-2.5 shadow-sm animate-fadeIn"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1C1917]">
                          Edit Category: {c.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          className="text-[#78716C] hover:text-[#1C1917]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        placeholder="Category Name"
                        className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-1.5 text-xs text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                      />
                      <ImageUploader
                        value={editCategoryImageUrl}
                        onChange={setEditCategoryImageUrl}
                        folder="categories"
                        label="Category Icon (Upload via Cloudinary)"
                        compact={true}
                        defaultFallbackImage="/images/categories/default-category.svg"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          className="h-7 px-3 bg-transparent hover:bg-[#E7E5E4] border border-[#D6D3D1] text-[#57534E] rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="h-7 px-3.5 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={c.id}
                    className="p-2.5 sm:p-3 bg-[#FAFAF9] rounded-xl border border-[#D6D3D1] flex items-center justify-between gap-2 hover:border-[#A8A29E] transition-colors"
                  >
                    <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white border border-[#D6D3D1] p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        <img
                          src={c.imageUrl || '/images/categories/default-category.svg'}
                          alt={c.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as any).src = '/images/categories/default-category.svg';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs sm:text-sm text-[#1C1917] truncate flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.imageUrl &&
                            (c.imageUrl.includes('cloudinary.com') ||
                              c.imageUrl.includes('res.cloudinary.com')) && (
                              <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-mono">
                                Cloudinary
                              </span>
                            )}
                        </div>
                        <div className="text-[10px] sm:text-xs text-[#78716C] font-mono">
                          {c.productCount ?? 0} active products
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditCategory(c)}
                        className="h-7 px-2.5 bg-white hover:bg-[#F5F5F4] border border-[#D6D3D1] text-[#1C1917] rounded-lg text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                        title="Edit Category & Icon"
                      >
                        <Edit2 className="w-3 h-3 text-[#C2410C]" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(c.id, c.name)}
                        className="w-7 h-7 flex items-center justify-center text-[#78716C] hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="mt-4 w-full h-10 bg-transparent hover:bg-[#E7E5E4] border border-[#D6D3D1] text-[#57534E] rounded-lg text-xs font-semibold cursor-pointer shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-4">
          <div className="bg-[#F5F5F4] border border-[#D6D3D1] w-full max-w-sm rounded-xl p-6 shadow-[0_24px_48px_rgba(28,25,23,0.12)]">
            <h3 className="font-display text-base font-bold text-[#1C1917] mb-1">Restock / Adjust Stock</h3>
            <p className="text-xs text-[#57534E] mb-4">{restockProduct.name}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Stock Change Qty</label>
                <input
                  type="number"
                  placeholder="e.g. 20 (or -5 for damage/loss)"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Reason</label>
                <select
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value as any)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                >
                  <option value="RESTOCK">Supplier Restock</option>
                  <option value="ADJUST">Inventory Audit / Adjustment</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  onClick={() => setRestockProduct(null)}
                  className="h-9 px-3 bg-transparent hover:bg-[#E7E5E4] text-[#57534E] border border-[#D6D3D1] rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestock}
                  className="h-9 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold rounded-lg text-xs shadow-xs"
                >
                  Save Stock Movement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
