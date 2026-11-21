import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Lock, ArrowRight, UserCheck, AlertCircle, QrCode } from 'lucide-react';
import { TipperTruckIcon } from '../common/TipperTruckIcon';
import { AllAccessQRModal } from '../common/AllAccessQRModal';

export const LoginView = () => {
  const { login, loginAsDemoUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both your authorized email and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-10 relative overflow-hidden">
      
      {/* Background Subtle Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md z-10">
        
        {/* App Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-xl shadow-emerald-950/80 border border-emerald-500/40 mb-4">
            <TipperTruckIcon className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight flex items-center justify-center">
            FLEET <span className="ml-1.5 text-emerald-400">GATE</span>
          </h1>
          <div className="inline-flex items-center space-x-1 mt-2 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-400">
            <Lock className="w-3 h-3 text-amber-400 mr-1" />
            <span>Private Restricted Access</span>
          </div>
          <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">
            Authorized gate security and fleet operations management system.
          </p>
        </div>

        {/* Security Callout */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-slate-400 space-y-1">
            <div className="flex items-center text-slate-200 font-semibold">
              <Shield className="w-4 h-4 mr-1.5 text-emerald-400" />
              <span>Strict Authorization Policy</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Public self-registration is permanently disabled. Staff accounts are issued exclusively by the System Administrator.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Staff Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="staff@lorrytrackpro.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/60 transition transform active:scale-95 flex items-center justify-center space-x-2"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Gate System'}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </form>

          {/* Evaluation Quick Demo Selector */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <button
              type="button"
              onClick={() => loginAsDemoUser('staff')}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-extrabold shadow-lg transition flex items-center justify-center space-x-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>Enter Staff Lorry Entry Screen</span>
            </button>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => loginAsDemoUser('admin')}
                className="text-xs text-slate-400 hover:text-amber-400 underline font-semibold transition"
              >
                Sign in as Admin (Console & Management)
              </button>
            </div>
            
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setIsQRModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-bold transition shadow"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>📱 Scan QR for Phone Access</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-500 space-y-1">
          <p>Fleet Gate v1.0 • Web & Android APK</p>
          <p className="text-[11px]">Protected by Supabase Authentication & Row Level Security</p>
        </div>

      </div>

      {/* QR Access Modal */}
      <AllAccessQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
      />

    </div>
  );
};
