import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { StaffSimpleScreen } from './components/staff/StaffSimpleScreen';
import { AdminDashboard } from './components/admin/AdminDashboard';

export const App = () => {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const [adminViewMode, setAdminViewMode] = useState('admin'); // 'admin' | 'staff'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-600 dark:text-slate-400 space-y-3 transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center animate-pulse">
          <span className="w-3 h-3 bg-emerald-500 dark:bg-emerald-400 rounded-full" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Loading FLEET GATE...
        </p>
      </div>
    );
  }

  // If not logged in as Admin, directly show StaffSimpleScreen (Staff needs NO login)
  if (!isAuthenticated || !isAdmin) {
    return <StaffSimpleScreen />;
  }

  // If Admin user: Allow toggling between Admin Dashboard and Staff Entry Screen
  if (adminViewMode === 'staff') {
    return (
      <div className="relative">
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 font-semibold sticky top-0 z-50">
          <span>Viewing Staff Simple Screen (Admin Test Mode)</span>
          <button
            onClick={() => setAdminViewMode('admin')}
            className="px-2.5 py-1 bg-amber-500 text-slate-950 rounded font-bold hover:bg-amber-400 transition"
          >
            Return to Admin Console
          </button>
        </div>
        <StaffSimpleScreen />
      </div>
    );
  }

  // Admin Console: Total vehicles, movement records (edit/delete/clear daily), and staff management (add/edit/delete)
  return (
    <AdminDashboard onOpenStaffView={() => setAdminViewMode('staff')} />
  );
};
