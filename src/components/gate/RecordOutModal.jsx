import React, { useState, useEffect } from 'react';
import { useLorryData } from '../../context/LorryDataContext';
import { GATES } from '../../constants';
import { X, ArrowUpRight, CheckCircle, AlertTriangle, Clock, Gauge } from 'lucide-react';
import { TipperTruckIcon } from '../common/TipperTruckIcon';
import { formatDistanceToNow } from 'date-fns';

export const RecordOutModal = ({
  isOpen,
  onClose,
  selectedMovementId = ''
}) => {
  const { activeLorries, recordExit } = useLorryData();

  const [movementId, setMovementId] = useState(selectedMovementId);
  const [exitGate, setExitGate] = useState('Main Gate');
  const [exitOdometer, setExitOdometer] = useState('');
  const [exitNotes, setExitNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  useEffect(() => {
    if (selectedMovementId) {
      setMovementId(selectedMovementId);
    } else if (activeLorries.length > 0 && !movementId) {
      setMovementId(activeLorries[0].id);
    }
  }, [selectedMovementId, activeLorries, movementId]);

  if (!isOpen) return null;

  const currentMovement = activeLorries.find(m => m.id === movementId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!movementId) {
      setErrorMessage('Please select a lorry to record OUT.');
      return;
    }

    setIsSubmitting(true);
    const result = await recordExit({
      movementId,
      exitGate,
      exitOdometer: exitOdometer ? parseInt(exitOdometer, 10) : undefined,
      exitNotes: exitNotes.trim()
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Failed to record exit');
    } else {
      setSuccessToast(`Exit Recorded! Lorry ${currentMovement?.plate_number} marked OUT (Visit completed).`);
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-sky-950/40 border-b border-sky-900/30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center">
                RECORD LORRY EXIT (OUT)
              </h2>
              <p className="text-xs text-sky-400 font-medium">Outbound Verification & Complete Visit Cycle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {successToast && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center space-x-2 text-emerald-400 text-sm">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-semibold">{successToast}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-xs sm:text-sm flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeLorries.length === 0 ? (
            <div className="text-center py-6">
              <TipperTruckIcon className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No Lorries Currently Inside Premises</p>
              <p className="text-xs text-slate-500 mt-1">All active vehicles have already been logged OUT.</p>
            </div>
          ) : (
            <>
              {/* Lorry Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Select Active Inside Lorry <span className="text-sky-400">*</span>
                </label>
                <select
                  value={movementId}
                  onChange={(e) => setMovementId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {activeLorries.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.plate_number} — {m.driver_name} ({m.transporter_name || 'Direct'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Lorry Details Box */}
              {currentMovement && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                    <span className="text-slate-400">Plate & Transporter:</span>
                    <span className="font-bold text-white text-sm font-mono">
                      {currentMovement.plate_number}
                      <span className="ml-2 text-xs font-normal text-slate-400">({currentMovement.transporter_name})</span>
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Driver & Phone:</span>
                    <span className="font-semibold text-slate-200">
                      {currentMovement.driver_name} {currentMovement.driver_phone ? `(${currentMovement.driver_phone})` : ''}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Entered At:</span>
                    <span className="text-slate-300">
                      {new Date(currentMovement.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({currentMovement.entry_gate})
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-emerald-400 font-medium">
                    <span className="flex items-center text-slate-400">
                      <Clock className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Time Elapsed Inside:
                    </span>
                    <span className="font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {formatDistanceToNow(new Date(currentMovement.entry_time), { addSuffix: false })}
                    </span>
                  </div>

                  {currentMovement.entry_odometer && (
                    <div className="flex justify-between items-center pt-1 text-slate-400">
                      <span>Entry Odometer:</span>
                      <span className="font-mono text-slate-300">{currentMovement.entry_odometer} KM</span>
                    </div>
                  )}
                </div>
              )}

              {/* Exit Gate & Exit Odometer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Exit Gate
                  </label>
                  <select
                    value={exitGate}
                    onChange={(e) => setExitGate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {GATES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Exit Odometer (KM)
                  </label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="number"
                      placeholder="e.g. 142510"
                      value={exitOdometer}
                      onChange={(e) => setExitOdometer(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Exit Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Exit Inspection / Outbound Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Unloading verified, empty container out, gate pass signed"
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Visit Increment Notice */}
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 text-sky-300 text-xs flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-sky-400" />
                <span>
                  Confirming this exit will complete <strong>Visit Cycle #{currentMovement?.visit_number || 1}</strong> and increment this lorry's lifetime visit counter.
                </span>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || activeLorries.length === 0}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition flex items-center space-x-2 ${
                activeLorries.length === 0
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-sky-600 hover:bg-sky-500 text-slate-950 shadow-sky-950/40'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{isSubmitting ? 'Logging OUT...' : 'Confirm Lorry Exit (OUT)'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
