import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLorryData } from '../../context/LorryDataContext';
import { LayoutDashboard, Clock, BookOpen, Shield } from 'lucide-react';
import { TipperTruckIcon } from './TipperTruckIcon';

export const BottomNav = ({ activeTab, setActiveTab }) => {
  const { isAdmin } = useAuth();
  const { stats } = useLorryData();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 z-30 safe-bottom">
      <div className="grid grid-cols-5 h-16 items-center px-1">
        
        {/* Gate Dashboard */}
        <button
          onClick={() => setActiveTab('gate')}
          className={`flex flex-col items-center justify-center h-full transition ${
            activeTab === 'gate' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-1">Gate</span>
        </button>

        {/* Inside Now */}
        <button
          onClick={() => setActiveTab('active')}
          className={`flex flex-col items-center justify-center h-full relative transition ${
            activeTab === 'active' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <TipperTruckIcon className="w-5 h-5" />
            {stats.inside_now > 0 && (
              <span className="absolute -top-1.5 -right-2.5 px-1 min-w-4 h-4 text-[9px] font-bold bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center">
                {stats.inside_now}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1">Inside</span>
        </button>

        {/* History */}
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center h-full transition ${
            activeTab === 'history' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px] mt-1">History</span>
        </button>

        {/* Lorries Directory */}
        <button
          onClick={() => setActiveTab('lorries')}
          className={`flex flex-col items-center justify-center h-full transition ${
            activeTab === 'lorries' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] mt-1">Directory</span>
        </button>

        {/* Admin Hub */}
        {isAdmin ? (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center justify-center h-full transition ${
              activeTab === 'admin' ? 'text-amber-400 font-semibold' : 'text-amber-400/60 hover:text-amber-300'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] mt-1">Admin</span>
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center h-full transition ${
              activeTab === 'profile' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
              S
            </div>
            <span className="text-[10px] mt-1">Profile</span>
          </button>
        )}

      </div>
    </nav>
  );
};
