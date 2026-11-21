import React, { useState, useEffect } from 'react';
import { useLorryData } from '../../context/LorryDataContext';
import { VEHICLE_TYPES, MOVEMENT_PURPOSES, GATES } from '../../constants';
import { X, ArrowDownRight, AlertTriangle, CheckCircle, User, FileText, Gauge } from 'lucide-react';
import { TipperTruckIcon } from '../common/TipperTruckIcon';
import { formatLorryNumber } from '../../utils/vehicleFormatter';

export const RecordInModal = ({ isOpen, onClose, prefilledPlate = '' }) => {
  const { lorries, checkLorryInsideStatus, recordEntry } = useLorryData();

  const [plateNumber, setPlateNumber] = useState(prefilledPlate);
  const [transporterName, setTransporterName] = useState('');
  const [vehicleType, setVehicleType] = useState('10-Wheeler');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [cargoDetails, setCargoDetails] = useState('');
  const [purpose, setPurpose] = useState('Loading');
  const [entryGate, setEntryGate] = useState('Main Gate');
  const [entryOdometer, setEntryOdometer] = useState('');
  const [entryNotes, setEntryNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  useEffect(() => {
    if (prefilledPlate) {
      setPlateNumber(prefilledPlate.toUpperCase());
    }
  }, [prefilledPlate]);

  useEffect(() => {
    const cleanPlate = (plateNumber || '').trim().toUpperCase();
    if (!cleanPlate) return;

    const matched = lorries.find(l => l.plate_number.toUpperCase() === cleanPlate);
    if (matched) {
      if (!transporterName) setTransporterName(matched.transporter_name || '');
      if (matched.vehicle_type) setVehicleType(matched.vehicle_type);
      if (!driverName && matched.default_driver_name) setDriverName(matched.default_driver_name);
      if (!driverPhone && matched.default_driver_phone) setDriverPhone(matched.default_driver_phone);
    }
  }, [plateNumber, lorries]);

  if (!isOpen) return null;

  const duplicateCheck = checkLorryInsideStatus(plateNumber);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    const normPlate = (plateNumber || '').trim().toUpperCase();
    if (!normPlate) {
      setErrorMessage('Please enter the lorry plate number.');
      return;
    }
    if (!driverName.trim()) {
      setErrorMessage('Please enter the driver name.');
      return;
    }

    if (duplicateCheck.isInside) {
      setErrorMessage(`DUPLICATE ENTRY BLOCKED: Lorry ${normPlate} is ALREADY inside the facility!`);
      return;
    }

    setIsSubmitting(true);
    const result = await recordEntry({
      plateNumber: normPlate,
      transporterName: transporterName.trim() || 'Direct / Unknown',
      vehicleType,
      driverName: driverName.trim(),
      driverPhone: driverPhone.trim(),
      cargoDetails: cargoDetails.trim(),
      purpose,
      entryGate,
      entryOdometer: entryOdometer ? parseInt(entryOdometer, 10) : undefined,
      entryNotes: entryNotes.trim()
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Failed to record entry');
    } else {
      setSuccessToast(`Entry Recorded! Lorry ${normPlate} logged IN.`);
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-950/40 border-b border-emerald-900/30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ArrowDownRight className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center">
                RECORD LORRY ENTRY (IN)
              </h2>
              <p className="text-xs text-emerald-400 font-medium">Inbound Gate Verification & Log</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {successToast && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center space-x-2 text-emerald-400 text-sm">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-semibold">{successToast}</span>
            </div>
          )}

          {duplicateCheck.isInside && (
            <div className="bg-rose-500/15 border-2 border-rose-500/40 rounded-xl p-3.5 text-rose-300 text-xs sm:text-sm flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-200">
                  DUPLICATE ACTIVE ENTRY PREVENTED
                </p>
                <p className="mt-0.5 text-rose-300/90 leading-snug">
                  Lorry <span className="font-mono font-bold text-white bg-rose-950/80 px-1 py-0.5 rounded">{plateNumber.toUpperCase()}</span> is ALREADY recorded inside the premises (Entered at {new Date(duplicateCheck.activeMovement?.entry_time || '').toLocaleTimeString()}).
                </p>
                <p className="mt-1 font-semibold text-rose-400">
                  Please record an OUT exit for this vehicle before creating a new entry.
                </p>
              </div>
            </div>
          )}

          {errorMessage && !duplicateCheck.isInside && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-xs sm:text-sm flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Plate Number & Vehicle Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Plate Number <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <TipperTruckIcon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. TN 21 BV 1234"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(formatLorryNumber(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono font-bold uppercase tracking-wider text-emerald-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Vehicle Type
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {VEHICLE_TYPES.map(vt => (
                  <option key={vt} value={vt}>{vt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Transporter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Transporter / Company Name
            </label>
            <input
              type="text"
              placeholder="e.g. Blue Dart Logistics, VRL, Self / Direct"
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Driver Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Driver Name <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Driver Phone (Mobile)
              </label>
              <input
                type="tel"
                placeholder="e.g. +91 98450 12345"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Purpose & Gate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Movement Purpose
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {MOVEMENT_PURPOSES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Entry Gate
              </label>
              <select
                value={entryGate}
                onChange={(e) => setEntryGate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {GATES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cargo Details */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Cargo / Material Details
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. Raw Material 20 Tons, Steel Rods, Sealed Container #BD-90"
                value={cargoDetails}
                onChange={(e) => setCargoDetails(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Odometer & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Entry Odometer (KM)
              </label>
              <div className="relative">
                <Gauge className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="number"
                  placeholder="e.g. 142500"
                  value={entryOdometer}
                  onChange={(e) => setEntryOdometer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Security Remarks / Seal Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Seal intact, verified driver ID card"
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

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
              disabled={isSubmitting || duplicateCheck.isInside}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition flex items-center space-x-2 ${
                duplicateCheck.isInside
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-emerald-950/40'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>{isSubmitting ? 'Logging...' : 'Confirm Lorry Entry (IN)'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
