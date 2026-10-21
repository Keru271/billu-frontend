'use client';

import React, { useState } from 'react';
import { Users, UserPlus, Search, Phone, MapPin, Building } from 'lucide-react';
import { Customer } from './POSBilling';
import { apiRequest } from '../lib/api';

interface CustomersViewProps {
  customers: Customer[];
  refreshData: () => Promise<void>;
  shopName: string;
}

export default function CustomersView({ customers, refreshData, shopName }: CustomersViewProps) {
  const [search, setSearch] = useState('');

  // Add Customer modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const res = await apiRequest('/api/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
        gstin: gstin.trim() || null,
      }),
    });

    if (res.success) {
      setIsAddOpen(false);
      setName('');
      setPhone('');
      setAddress('');
      setGstin('');
      await refreshData();
    } else {
      alert(`Failed to add customer: ${res.error?.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden bg-[#FAFAF9] text-[#1C1917] font-sans select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917] flex items-center space-x-2.5">
            <Users className="w-5 h-5 text-[#C2410C] shrink-0" />
            <span>Customer Directory</span>
          </h1>
          <p className="text-sm text-[#57534E] mt-0.5">
            Manage customer contact records, addresses, and details for billing and receipts
          </p>
        </div>

        {/* Primary CTA (frontend/DESIGN.md: One primary CTA per view) */}
        <button
          onClick={() => setIsAddOpen(true)}
          className="w-full sm:w-auto h-10 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold text-sm rounded-lg flex items-center justify-center space-x-1.5 shadow-[0_4px_12px_rgba(194,65,12,0.25)] transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 bg-[#F5F5F4] rounded-xl border border-[#D6D3D1] mb-4 max-w-md relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
        <input
          type="text"
          placeholder="Search by customer name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#C2410C] focus:ring-3 focus:ring-[#C2410C]/15"
        />
      </div>

      {/* Customer Directory Table */}
      <div className="flex-1 overflow-auto bg-[#F5F5F4] rounded-xl border border-[#D6D3D1]">
        <table className="w-full min-w-[580px] text-left text-sm">
          <thead className="bg-[#E7E5E4] text-[#57534E] font-semibold border-b border-[#D6D3D1] sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4">Customer Name</th>
              <th className="py-3 px-4">Phone Number</th>
              <th className="py-3 px-4">Address / Area</th>
              <th className="py-3 px-4">GSTIN</th>
              <th className="py-3 px-4 text-right">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D6D3D1] text-[#1C1917]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#78716C]">
                  No customers found matching your search.
                </td>
              </tr>
            ) : (
              filtered.map((c: any) => {
                return (
                  <tr key={c.id} className="hover:bg-[#E7E5E4]/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#1C1917]">{c.name}</td>
                    <td className="py-3 px-4 text-[#57534E] font-mono text-xs">
                      <div className="flex items-center space-x-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#78716C]" />
                        <span>{c.phone}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#57534E] text-xs">
                      {c.address ? (
                        <div className="flex items-center space-x-1 max-w-xs truncate">
                          <MapPin className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </div>
                      ) : (
                        <span className="text-[#A8A29E]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#57534E] text-xs font-mono">
                      {c.gstin ? (
                        <div className="flex items-center space-x-1">
                          <Building className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                          <span>{c.gstin}</span>
                        </div>
                      ) : (
                        <span className="text-[#A8A29E]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`tel:${c.phone}`}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#FAFAF9] hover:bg-[#E7E5E4] text-[#C2410C] font-semibold rounded-lg text-xs transition-colors border border-[#D6D3D1]"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Customer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-4">
          <div className="bg-[#F5F5F4] border border-[#D6D3D1] w-full max-w-sm rounded-xl p-6 shadow-[0_24px_48px_rgba(28,25,23,0.12)]">
            <h3 className="font-display text-base font-bold text-[#1C1917] mb-4">Add Customer Record</h3>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Bhai"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Phone Number (10 digits) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9820098200"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">Address / Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. Shop 4, Station Road"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 24AAAAA0000A1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] uppercase font-mono focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="h-10 px-3 bg-transparent hover:bg-[#E7E5E4] border border-[#D6D3D1] text-[#57534E] rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold rounded-lg text-xs shadow-xs"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
