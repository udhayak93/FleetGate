import React, { useState } from 'react';
import { useLorryData } from '../../context/LorryDataContext';
import { RecordOutModal } from '../gate/RecordOutModal';
import { TipperTruckIcon } from '../common/TipperTruckIcon';
import { 
  Clock, 
  Search, 
  Phone, 
  ArrowUpRight, 
  CheckCircle2,
  Building,
  User,
  ShieldAlert
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const ActiveLorriesView = () => {
  const { activeLorries } = useLorryData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGate, setSelectedGate] = useState('all');
  const [isOutModalOpen, setIsOutModalOpen] = useState(false);
  const [targetMovementId, setTargetMovementId] = useState('');

  const gates = Array.from(new Set(activeLorries.map(m => m.entry_gate))).filter(Boolean);

  const filtered = activeLorries.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      m.plate_number.toLowerCase().includes(q) ||
      m.driver_name.toLowerCase().includes(q) ||
      (m.transporter_name && m.transporter_name.toLowerCase().includes(q)) ||
      (m.cargo_details && m.cargo_details.toLowerCase().includes(q))
    );

    const matchesGate = selectedGate === 'all' || m.entry_gate === selectedGate;

    return matchesSearch && matchesGate;
  });

  const handleRecordOut = (id) => {
    setTargetMovementId(id);
    setIsOutModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-100 flex items-center">
              <TipperTruckIcon className="w-6 h-6 mr-2 text-emerald-400" />
              Vehicles Inside Premises
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {activeLorries.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time tracking of all lorries currently parked, loading, or unloading on-site.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search plate or driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={selectedGate}
            onChange={(e) => setSelectedGate(e.target.value)}
            className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Gates ({activeLorries.length})</option>
            {gates.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Vehicles */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No Inside Vehicles Found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {searchQuery ? 'Try adjusting your search criteria.' : 'There are currently no active lorries recorded on premises.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mov) => {
            const entered = new Date(mov.entry_time);
            const elapsedMins = Math.round((Date.now() - entered.getTime()) / 60000);
            const isLongStay = elapsedMins >= 240;

            return (
              <div 
                key={mov.id}
                className={`bg-slate-900 border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition ${
                  isLongStay ? 'border-amber-500/40' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-lg font-black text-slate-100 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 tracking-wider">
                          {mov.plate_number}
                        </span>
                        {isLongStay && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center">
                            <ShieldAlert className="w-3 h-3 mr-0.5" />
                            Over 4h
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 flex items-center">
                        <Building className="w-3 h-3 mr-1 text-slate-500" />
                        {mov.transporter_name || 'Direct'}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center text-xs font-bold font-mono text-emerald-400">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        {formatDistanceToNow(entered, { addSuffix: false })}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {entered.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Details List */}
                  <div className="mt-4 bg-slate-950/70 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex items-center">
                        <User className="w-3 h-3 mr-1" /> Driver:
                      </span>
                      <span className="font-semibold text-slate-200">{mov.driver_name}</span>
                    </div>

                    {mov.driver_phone && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 flex items-center">
                          <Phone className="w-3 h-3 mr-1" /> Phone:
                        </span>
                        <a href={`tel:${mov.driver_phone}`} className="text-emerald-400 hover:underline">
                          {mov.driver_phone}
                        </a>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-slate-500">Purpose:</span>
                      <span className="font-medium text-slate-200">{mov.purpose}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Entry Gate:</span>
                      <span className="text-slate-300">{mov.entry_gate}</span>
                    </div>

                    {mov.cargo_details && (
                      <div className="pt-1 border-t border-slate-800/80">
                        <span className="text-slate-500 block mb-0.5">Cargo / Material:</span>
                        <span className="text-slate-200 font-medium">{mov.cargo_details}</span>
                      </div>
                    )}

                    {mov.entry_recorded_by_name && (
                      <div className="text-[10px] text-slate-500 pt-1">
                        Recorded by: {mov.entry_recorded_by_name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-mono">
                    Visit #{mov.visit_number}
                  </span>

                  <button
                    onClick={() => handleRecordOut(mov.id)}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-slate-950 text-xs font-extrabold shadow-md shadow-sky-950/50 transition flex items-center space-x-1.5"
                  >
                    <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                    <span>Log OUT Exit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecordOutModal
        isOpen={isOutModalOpen}
        onClose={() => setIsOutModalOpen(false)}
        selectedMovementId={targetMovementId}
      />

    </div>
  );
};
