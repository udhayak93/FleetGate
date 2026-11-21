import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLorryData } from '../../context/LorryDataContext';
import { Shield, User, LogOut, Radio, Clock, Settings, RefreshCw } from 'lucide-react';
import { TipperTruckIcon } from './TipperTruckIcon';

export const Header = ({ onOpenSettings, activeTab, setActiveTab }) => {
  const { profile, isAdmin, isDemoMode, logout } = useAuth();
  const { stats, isSyncing, refreshData } = useLorryData();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 safe-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & App Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('gate')}>
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-md shadow-emerald-950/50 border border-emerald-500/40">
              <TipperTruckIcon className="w-5 h-5 text-white" />
              {stats.inside_now > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full beacon-active ring-2 ring-slate-900" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-wider text-slate-100 flex items-center">
                  FLEET <span className="ml-1 text-emerald-400 font-black">GATE</span>
                </span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 hidden sm:inline-block">
                  Private Access
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Gate Management & Lorry Movement System</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <button
              onClick={() => setActiveTab('gate')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'gate' ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Gate Dashboard
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative ${
                activeTab === 'active' ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Inside Now
              {stats.inside_now > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 text-xs font-bold bg-emerald-500 text-slate-950 rounded-full">
                  {stats.inside_now}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'history' ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              History & Logs
            </button>
            <button
              onClick={() => setActiveTab('lorries')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'lorries' ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Lorries Directory
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'admin' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10'
                }`}
              >
                Admin Control
              </button>
            )}
          </nav>

          {/* Right Status & Profile Controls */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            
            {/* Clock */}
            <div className="hidden lg:flex items-center text-xs font-mono text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded-md border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
              {currentTime}
            </div>

            {/* Sync Status / Refresh */}
            <button 
              onClick={() => refreshData()}
              title="Refresh / Sync Live Data"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Connection badge */}
            <div 
              onClick={onOpenSettings}
              className={`hidden sm:flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full cursor-pointer transition ${
                isDemoMode 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
              title="Click to configure Supabase Connection"
            >
              <Radio className="w-3 h-3 animate-pulse" />
              <span className="font-medium">{isDemoMode ? 'Demo Mode' : 'Supabase Live'}</span>
            </div>

            {/* User Profile Pill */}
            <div className="flex items-center space-x-2 bg-slate-800/80 py-1 px-2.5 rounded-xl border border-slate-700/60">
              <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-slate-200 font-bold text-xs">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold text-slate-200 leading-tight truncate max-w-[120px]">
                  {profile?.full_name || 'Staff Member'}
                </p>
                <div className="flex items-center space-x-1">
                  {isAdmin ? (
                    <span className="inline-flex items-center text-[10px] font-bold text-amber-400">
                      <Shield className="w-2.5 h-2.5 mr-0.5 text-amber-400" />
                      ADMIN
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-emerald-400">
                      STAFF
                    </span>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                title="Sign Out"
                className="ml-1 p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Settings Button */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="Application Settings & Supabase Setup"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

          </div>
        </div>
      </div>
    </header>
  );
};
