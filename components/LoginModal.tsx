'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Mail,
  Lock,
  AlertCircle,
  ArrowRight,
  Loader2,
  Store,
  User,
  Phone,
  CheckCircle2,
} from 'lucide-react';
import { login, register, AuthUser } from '../lib/api';

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: (user: AuthUser) => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export default function LoginModal({ isOpen, onSuccess, onClose, canDismiss = false }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form State
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Login submission
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await login(loginEmail, loginPassword);
      if (res.success && res.data?.user) {
        onSuccess(res.data.user);
      } else {
        setErrorMsg(res.error?.message || 'Invalid email or password.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Login request failed.');
    } finally {
      setIsLoading(false);
    }
  };


  // Handle Register submission
  const handleRegisterSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!shopName.trim() || !ownerName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await register({
        shopName: shopName.trim(),
        name: ownerName.trim(),
        phone: regPhone.trim() || undefined,
        email: regEmail.trim(),
        password: regPassword,
      });

      if (res.success && res.data?.user) {
        onSuccess(res.data.user);
      } else {
        setErrorMsg(res.error?.message || 'Store registration failed.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Registration request failed.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-[#FAFAF9] border border-[#D6D3D1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Segmented Mode Switcher */}
        <div className="p-5 sm:p-6 bg-white border-b border-[#E7E5E4] text-center shrink-0">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#C2410C]/10 border border-[#C2410C]/25 flex items-center justify-center text-[#C2410C] mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold font-display text-[#1C1917] tracking-tight">
            {mode === 'login' ? 'Sign in to BillDesk POS' : 'Register Your Retail Store'}
          </h2>
          <p className="text-xs text-[#78716C] mt-1">
            {mode === 'login'
              ? 'Superfast Indian retail billing, GST compliance & multi-tender POS'
              : 'Launch your store with 14-day trial, multi-tender POS & 5 pre-configured categories'}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="mt-4 flex bg-[#F5F5F4] p-1 rounded-xl border border-[#D6D3D1] max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#C2410C] shadow-xs'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#C2410C] text-white shadow-xs'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              Register Store
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-red-700 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {mode === 'login' && (
            <div className="space-y-4">
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. owner@store.com"
                      className="w-full h-10 pl-9 pr-3 text-xs bg-white border border-[#D6D3D1] rounded-lg text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-9 pr-3 text-xs bg-white border border-[#D6D3D1] rounded-lg text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 mt-2 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold text-xs rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-[#C2410C] hover:underline font-medium"
                >
                  New business owner? Register your store here →
                </button>
              </div>
            </div>
          )}

          {/* MODE 2: REGISTER STORE */}
          {mode === 'register' && (
            <div className="space-y-4">

              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                    Store / Business Name *
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Balaji Supermarket & Kirana"
                      className="w-full h-10 pl-9 pr-3 text-xs bg-white border border-[#D6D3D1] rounded-lg text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Owner Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="e.g. Rajesh Sharma"
                        className="w-full h-10 pl-9 pr-3 text-xs bg-white border border-[#D6D3D1] rounded-lg text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Contact Phone (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="e.g. 9820098200"
                        className="w-full h-10 pl-9 pr-3 text-xs bg-white border border-[#D6D3D1] rounded-lg text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                    Owner Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. rajesh@balajimart.in"
                      className="w-full h-10 pl-9 pr-3 text-xs bg-white border border-[#D6D3D1] rounded-lg text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                    Password (Min 6 characters) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-9 pr-3 text-xs bg-white border border-[#D6D3D1] rounded-lg text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]"
                    />
                  </div>
                </div>

                {/* Trial & Inclusion Notice */}
                <div className="p-3 bg-[#F5F5F4] border border-[#D6D3D1] rounded-xl text-[11px] text-[#57534E] space-y-1">
                  <div className="flex items-center space-x-1.5 font-medium text-[#1C1917]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Instant Retail Setup Included</span>
                  </div>
                  <p className="text-[10px] text-[#78716C] leading-relaxed">
                    14-day free trial • 5 pre-seeded Indian retail categories • Multi-tender cashier desk • No credit card required.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 mt-2 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold text-xs rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Store Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Store & Launch POS</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-[#57534E] hover:text-[#C2410C] font-medium"
                >
                  Already have a store account? <span className="text-[#C2410C] underline">Sign In</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {canDismiss && onClose && (
          <div className="px-6 py-3 bg-[#F5F5F4] border-t border-[#E7E5E4] text-center shrink-0">
            <button
              onClick={onClose}
              className="text-xs text-[#78716C] hover:text-[#1C1917] font-medium transition-colors cursor-pointer"
            >
              Continue without signing in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
