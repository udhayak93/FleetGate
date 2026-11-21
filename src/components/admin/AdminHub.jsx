import React, { useState } from 'react';
import { StaffManager } from './StaffManager';
import { ReportsAnalytics } from './ReportsAnalytics';
import { LorriesDirectory } from './LorriesDirectory';
import { Users, BarChart3 } from 'lucide-react';
import { TipperTruckIcon } from '../common/TipperTruckIcon';

export const AdminHub = () => {
  const [subTab, setSubTab] = useState('staff');

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      
      {/* Sub-tabs header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex space-x-2">
        <button
          onClick={() => setSubTab('staff')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition ${
            subTab === 'staff'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4 text-amber-400" />
          <span>Staff Accounts</span>
        </button>

        <button
          onClick={() => setSubTab('reports')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition ${
            subTab === 'reports'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <span>Reports & Analytics</span>
        </button>

        <button
          onClick={() => setSubTab('lorries')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition ${
            subTab === 'lorries'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <TipperTruckIcon className="w-4 h-4 text-amber-400" />
          <span>Lorries Master</span>
        </button>
      </div>

      {subTab === 'staff' && <StaffManager />}
      {subTab === 'reports' && <ReportsAnalytics />}
      {subTab === 'lorries' && <LorriesDirectory />}

    </div>
  );
};
