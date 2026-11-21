import React, { useState } from 'react';
import { useLorryData } from '../../context/LorryDataContext';
import { RecordInModal } from './RecordInModal';
import { RecordOutModal } from './RecordOutModal';
import { TipperTruckIcon } from '../common/TipperTruckIcon';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  Search, 
  Phone, 
  FileText,
  Building,
  User
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const GateDashboard = () => {
  const { activeLorries, stats } = useLorryData();

  const [isInModalOpen, setIsInModalOpen] = useState(false);
  const [isOutModalOpen, setIsOutModalOpen] = useState(false);
  const [selectedOutMovementId, setSelectedOutMovementId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenOutForMovement = (movementId) => {
    setSelectedOutMovementId(movementId);
    setIsOutModalOpen(true);
  };

  const filteredActive = activeLorries.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.plate_number.toLowerCase().includes(q) ||
      m.driver_name.toLowerCase().includes(q) ||
      (m.transporter_name && m.transporter_name.toLowerCase().includes(q)) ||
      (m.cargo_details && m.cargo_details.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      
      {/* Top Banner / Quick Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                Live Gate Control
              </span>
              <span className="text-xs text-slate-500 font-mono">Real-time synced</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight mt-1">
              GATE MOVEMENT OPERATIONS
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Record vehicle arrivals and departures. Automatic duplicate prevention & visit counting enabled.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <button
              onClick={() => setIsInModalOpen(true)}
              className="flex items-center justify-center space-x-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/60 transition transform active:scale-95"
            >
              <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
              <span>RECORD IN</span>
            </button>

            <button
              onClick={() => {
                setSelectedOutMovementId('');
                setIsOutModalOpen(true);
              }}
              className="flex items-center justify-center space-x-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-sky-950/60 transition transform active:scale-95"
            >
              <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              <span>RECORD OUT</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Inside Now */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inside Premises</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TipperTruckIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-100 font-mono">
              {stats.inside_now}
            </span>
            <span className="text-xs font-medium text-emerald-400 flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1 beacon-active" />
              Active
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Vehicles currently on-site</p>
        </div>

        {/* Today IN */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today IN</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-100 font-mono">
              {stats.today_in}
            </span>
            <span className="text-xs font-medium text-slate-400">entries</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Inbound gate arrivals today</p>
        </div>

        {/* Today OUT */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-sky-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today OUT</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-100 font-mono">
              {stats.today_out}
            </span>
            <span className="text-xs font-medium text-slate-400">cycles</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Completed visits today</p>
        </div>

        {/* Avg Turnaround */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Turnaround</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-100 font-mono">
              {Math.floor(stats.avg_duration_minutes / 60)}h {stats.avg_duration_minutes % 60}m
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Average premise stay duration</p>
        </div>

      </div>

      {/* Active Lorries Inside Section */}
      <div className="space-y-4">
        
        {/* Section Header with Quick Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center">
              <TipperTruckIcon className="w-5 h-5 mr-2 text-emerald-400" />
              Vehicles Inside Premises
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {activeLorries.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400">Tap "Record OUT" on any vehicle card to quickly log departure.</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search plate, driver, cargo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Active Cards Grid */}
        {filteredActive.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">
              {searchQuery ? 'No matching inside lorries found' : 'All Clear — No Lorries Inside'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery ? 'Try clearing your search query.' : 'Click "RECORD IN" above to log a new vehicle arriving at the gate.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActive.map((movement) => {
              const enteredTime = new Date(movement.entry_time);
              const elapsedHours = (Date.now() - enteredTime.getTime()) / 3600000;
              const isOvertime = elapsedHours >= 6;

              return (
                <div
                  key={movement.id}
                  className={`bg-slate-900 border rounded-2xl p-4 shadow-lg flex flex-col justify-between transition hover:shadow-xl ${
                    isOvertime 
                      ? 'border-amber-500/40 hover:border-amber-500/60' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Card Top: Plate & Status */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-base font-extrabold text-slate-100 tracking-wider bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {movement.plate_number}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            IN
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center">
                          <Building className="w-3 h-3 mr-1 text-slate-500" />
                          {movement.transporter_name || 'Direct'}
                        </p>
                      </div>

                      {/* Elapsed Time Badge */}
                      <div className={`text-right ${isOvertime ? 'text-amber-400' : 'text-emerald-400'}`}>
                        <div className="flex items-center text-xs font-bold font-mono">
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          {formatDistanceToNow(enteredTime, { addSuffix: false })}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Since {enteredTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Driver & Cargo info */}
                    <div className="mt-3 space-y-1.5 text-xs text-slate-300 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center">
                          <User className="w-3 h-3 mr-1 text-slate-500" />
                          Driver:
                        </span>
                        <span className="font-medium text-slate-200">{movement.driver_name}</span>
                      </div>

                      {movement.driver_phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center">
                            <Phone className="w-3 h-3 mr-1 text-slate-500" />
                            Phone:
                          </span>
                          <a href={`tel:${movement.driver_phone}`} className="text-emerald-400 hover:underline">
                            {movement.driver_phone}
                          </a>
                        </div>
                      )}

                      {movement.cargo_details && (
                        <div className="flex items-start justify-between pt-1 border-t border-slate-800/80">
                          <span className="text-slate-400 flex items-center mt-0.5">
                            <FileText className="w-3 h-3 mr-1 text-slate-500" />
                            Cargo:
                          </span>
                          <span className="text-right text-slate-300 font-medium truncate max-w-[170px]" title={movement.cargo_details}>
                            {movement.cargo_details}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-500">Purpose / Gate:</span>
                        <span className="text-slate-300 font-medium">
                          {movement.purpose} • {movement.entry_gate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Quick Record OUT Button */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Visit #{movement.visit_number}
                    </span>
                    <button
                      onClick={() => handleOpenOutForMovement(movement.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition flex items-center space-x-1"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Record OUT</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      <RecordInModal
        isOpen={isInModalOpen}
        onClose={() => setIsInModalOpen(false)}
      />

      <RecordOutModal
        isOpen={isOutModalOpen}
        onClose={() => setIsOutModalOpen(false)}
        selectedMovementId={selectedOutMovementId}
      />

    </div>
  );
};
