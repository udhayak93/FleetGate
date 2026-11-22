import React, { useState, useMemo } from 'react';
import { useLorryData } from '../../context/LorryDataContext';
import { useAuth } from '../../context/AuthContext';
import { format, isToday } from 'date-fns';
import { formatLorryNumber, getTripLabel } from '../../utils/vehicleFormatter';
import { Lock, Shield, X, Eye, EyeOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { TipperTruckIcon } from '../common/TipperTruckIcon';
import { ThemeToggle } from '../common/ThemeToggle';

export const StaffSimpleScreen = () => {
  const { 
    movements, 
    checkLorryInsideStatus, 
    getLorryTripInfo, 
    recordEntry, 
    recordExit,
    isSyncing,
    syncStatus,
    refreshData 
  } = useLorryData();
  const { login, logout, profile, isAdmin } = useAuth();

  const [lorryNumber, setLorryNumber] = useState('TN ');
  const [remarks, setRemarks] = useState(''); // Replaced Wheel Type with optional Remarks
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastSavedInTime, setLastSavedInTime] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'MULTI_TRIP' | 'INSIDE'

  // State for Check-Out (OUT) Modal
  const [exitModalMovement, setExitModalMovement] = useState(null);

  // Admin Login Modal State (Staff requires NO login, only Admin needs login)
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState(null);
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);

  // Check if entered lorry is currently inside
  const duplicateCheck = checkLorryInsideStatus(lorryNumber);

  // Check trip history for the entered lorry (intimation for 2nd Trip, 3rd Trip, etc.)
  const tripInfo = getLorryTripInfo(lorryNumber);

  // Helper to format timestamp to hh:mm a (e.g. 08:30 AM)
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      return format(new Date(isoString), 'hh:mm a');
    } catch {
      return '';
    }
  };

  // 1-DAY ACCESS RULE:
  // Staff can ONLY access today's live data. Older historical data (> 1 day) is restricted to Admin.
  // Active lorries currently inside are kept so staff can mark OUT.
  const staffDayMovements = useMemo(() => {
    return movements.filter(m => {
      try {
        return isToday(new Date(m.entry_time)) || (m.is_active_inside && m.status === 'IN');
      } catch {
        return false;
      }
    });
  }, [movements]);

  // Overall Count of Vehicles going for 2 or more trips today
  const tripStats = useMemo(() => {
    const counts = {};
    const lorryInfo = {};

    staffDayMovements.forEach(m => {
      const compact = (m.plate_number || '').toUpperCase().replace(/\s+/g, '');
      if (!compact) return;
      counts[compact] = (counts[compact] || 0) + 1;
      lorryInfo[compact] = m.plate_number;
    });

    const multiTripEntries = Object.entries(counts).filter(([_, count]) => count >= 2);
    const multiTripVehiclesCount = multiTripEntries.length;
    const totalVehiclesCount = Object.keys(counts).length;
    const insideCount = staffDayMovements.filter(m => m.is_active_inside && m.status === 'IN').length;

    return {
      multiTripVehiclesCount,
      totalVehiclesCount,
      totalTripsCount: staffDayMovements.length,
      insideCount,
      multiTripVehiclesMap: counts,
      multiTripVehiclesList: multiTripEntries.map(([compact, count]) => ({
        compact,
        plate: lorryInfo[compact] || compact,
        trips: count
      }))
    };
  }, [staffDayMovements]);

  // Filtered movements for display based on staff filter selection
  const displayedMovements = useMemo(() => {
    if (activeFilter === 'MULTI_TRIP') {
      return staffDayMovements.filter(m => {
        const compact = (m.plate_number || '').toUpperCase().replace(/\s+/g, '');
        return (tripStats.multiTripVehiclesMap[compact] || 0) >= 2;
      });
    }
    if (activeFilter === 'INSIDE') {
      return staffDayMovements.filter(m => m.is_active_inside && m.status === 'IN');
    }
    return staffDayMovements;
  }, [staffDayMovements, activeFilter, tripStats.multiTripVehiclesMap]);

  // Helper to determine exact trip number for any row
  const getMovementTripNumber = (mov) => {
    if (mov.trip_number) return mov.trip_number;
    if (mov.visit_number) return mov.visit_number;
    const compact = (mov.plate_number || '').toUpperCase().replace(/\s+/g, '');
    const sameLorries = staffDayMovements.filter(
      m => (m.plate_number || '').toUpperCase().replace(/\s+/g, '') === compact
    );
    const sorted = [...sameLorries].sort((a, b) => new Date(a.entry_time) - new Date(b.entry_time));
    const idx = sorted.findIndex(m => m.id === mov.id);
    return idx >= 0 ? idx + 1 : 1;
  };

  // Handle Lorry IN using exact mobile time + optional remarks
  const handleRecordIn = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLastSavedInTime(null);

    const normPlate = formatLorryNumber(lorryNumber);
    if (!normPlate || normPlate.replace(/\s+/g, '') === 'TN') {
      setErrorMsg('Please enter Lorry Number after TN (e.g. TN 20 CH 2023).');
      return;
    }

    if (duplicateCheck.isInside) {
      setErrorMsg(`Duplicate active IN: Lorry ${normPlate} is already recorded inside. Record OUT before entering again.`);
      return;
    }

    // Capture exact mobile device timestamp at the moment IN is clicked
    const mobileNow = new Date();
    const exactMobileIso = mobileNow.toISOString();
    const exactFormattedTime = format(mobileNow, 'hh:mm a');
    const intendedTripNumber = tripInfo.nextTripNumber;
    const intendedTripLabel = getTripLabel(intendedTripNumber);

    setIsSubmitting(true);
    const res = await recordEntry({
      plateNumber: normPlate,
      wheelType: '12 Wheel',
      vehicleType: '12 Wheel',
      remarks: remarks.trim(),
      entryNotes: remarks.trim(),
      entryTime: exactMobileIso
    });
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to record entry.');
    } else {
      setLastSavedInTime({
        plate: normPlate,
        time: exactFormattedTime,
        tripLabel: intendedTripLabel,
        isSecondPlusTrip: intendedTripNumber > 1,
        remarks: remarks.trim()
      });
      setLorryNumber('TN ');
      setRemarks('');
    }
  };

  // Open OUT modal
  const handleStartRecordOut = (movement) => {
    setErrorMsg(null);
    setExitModalMovement(movement);
  };

  // Confirm Lorry OUT using exact mobile time
  const handleConfirmRecordOut = async () => {
    if (!exitModalMovement) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    const mobileExitNow = new Date();
    const exactMobileExitIso = mobileExitNow.toISOString();

    const res = await recordExit({
      movementId: exitModalMovement.id,
      exitGate: 'Main Gate',
      exitTime: exactMobileExitIso,
    });
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to record exit.');
    } else {
      setExitModalMovement(null);
    }
  };

  // Handle Admin Login Submission
  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    setAdminLoginError(null);
    setIsAdminLoggingIn(true);
    const res = await login(adminEmail, adminPassword);
    setIsAdminLoggingIn(false);

    if (!res.success) {
      setAdminLoginError(res.error || 'Invalid email or password.');
    } else {
      setIsAdminModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans select-none pb-12 transition-colors duration-200">
      
      {/* Top Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 safe-top shadow-xs transition-colors">
        <div className="max-w-4xl w-full mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 border border-emerald-500/40 flex items-center justify-center text-white shadow-md">
              <TipperTruckIcon className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-wider text-slate-900 dark:text-white leading-none">
                FLEET <span className="text-emerald-600 dark:text-emerald-400">GATE</span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 mt-0.5 font-medium">
                <span>Heavy Tipper Gate</span>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">No Login Needed</span>
              </p>
            </div>
          </div>

          {/* Top Right: Theme Toggle + Admin Login / Status */}
          <div className="flex items-center space-x-2">
            {/* Light / Dark Mode Toggle */}
            <ThemeToggle className="w-9 h-9" />

            {isAdmin ? (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-amber-600 dark:text-amber-400 font-bold hidden sm:inline px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  Administrator
                </span>
                <button
                  onClick={logout}
                  className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition shadow-xs flex items-center"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="h-9 flex items-center space-x-1.5 px-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/40 text-xs font-extrabold shadow-xs transition active:scale-95"
              >
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-4">

        {/* Real-Time Shared Cloud Sync Status Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs flex items-center justify-between text-slate-700 dark:text-slate-300 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'live' ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20' : syncStatus === 'syncing' ? 'bg-amber-500 animate-spin' : 'bg-rose-500'}`} />
            <span className="font-semibold text-xs">
              {syncStatus === 'live' ? (
                <span className="text-slate-800 dark:text-emerald-400 font-bold flex items-center">
                  Shared Cloud Database Active <span className="ml-1 text-[11px] text-slate-500 dark:text-slate-400 font-normal hidden sm:inline">(Auto-syncs all mobile devices)</span>
                </span>
              ) : syncStatus === 'syncing' ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">Syncing with Cloud...</span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">Offline Cache</span>
              )}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => refreshData()}
              disabled={isSyncing}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 text-[11px] transition active:scale-95 shadow-xs"
              title="Sync now across all phones"
            >
              <RefreshCw className={`w-3 h-3 text-emerald-600 dark:text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {/* Success Notice: Display IN Time, Trip Label & optional Remarks immediately after saving */}
        {lastSavedInTime && (
          <div className="bg-emerald-50 dark:bg-emerald-950/80 border-2 border-emerald-500/60 rounded-xl p-3 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="font-bold text-slate-900 dark:text-white font-mono text-base">{lastSavedInTime.plate}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                lastSavedInTime.isSecondPlusTrip 
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400' 
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/80 dark:text-emerald-300 dark:border-emerald-600'
              }`}>
                {lastSavedInTime.tripLabel}
              </span>
              <span className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm">IN Time recorded:</span>
              <span className="font-bold font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                {lastSavedInTime.time}
              </span>
              {lastSavedInTime.remarks && (
                <span className="text-xs text-slate-700 dark:text-slate-300 italic bg-slate-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded border border-slate-200 dark:border-emerald-600/40">
                  Note: {lastSavedInTime.remarks}
                </span>
              )}
            </div>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-1 rounded-md">✓ Saved</span>
          </div>
        )}

        {/* Error Notice */}
        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-400 dark:border-rose-500/60 rounded-xl p-3 text-rose-800 dark:text-rose-300 text-xs sm:text-sm font-semibold shadow-xs">
            {errorMsg}
          </div>
        )}

        {/* LORRY ENTRY FORM: LORRY NUMBER, REMARKS (OPTIONAL), AND IN BUTTON */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors">
          <form onSubmit={handleRecordIn} className="space-y-4">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              
              {/* Field 1: Lorry Number with Auto-Spacing (e.g. TN 21 BV 1234 or TN 21 H 1234) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Lorry Number
                  </label>
                  {/* Trip Indicator Badge beside the label */}
                  {lorryNumber.trim().length >= 4 && !duplicateCheck.isInside && (
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                      tripInfo.isReturning
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                    }`}>
                      {getTripLabel(tripInfo.nextTripNumber)}
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="TN 20 CH 2023"
                  value={lorryNumber}
                  onFocus={(e) => {
                    if (e.target.value === 'TN ') {
                      e.target.setSelectionRange(3, 3);
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    let raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (!raw.startsWith('TN')) {
                      raw = 'TN' + raw;
                    }
                    const formatted = formatLorryNumber(raw);
                    setLorryNumber(formatted === 'TN' ? 'TN ' : formatted);
                  }}
                  className="w-full bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl px-3.5 py-3 text-base sm:text-lg font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-emerald-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-xs transition-colors"
                />

                {/* INTIMATION BANNER FOR 2nd TRIP / RETURNING LORRY */}
                {lorryNumber.trim().length >= 4 && tripInfo.isReturning && !duplicateCheck.isInside && (
                  <div className="mt-2 bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-500/50 rounded-xl px-3 py-2 text-xs flex items-center justify-between text-amber-900 dark:text-amber-300 font-medium">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
                      <span>
                        Notice: Lorry <strong>{lorryNumber}</strong> entering for{' '}
                        <strong className="underline text-amber-700 dark:text-amber-200">{getTripLabel(tripInfo.nextTripNumber)}</strong>
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono hidden sm:inline">
                      ({tripInfo.totalTrips} completed today)
                    </span>
                  </div>
                )}

                {/* DUPLICATE ACTIVE IN NOTICE */}
                {lorryNumber.trim().length >= 4 && duplicateCheck.isInside && (
                  <div className="mt-2 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500/60 rounded-xl px-3 py-2 text-xs text-rose-800 dark:text-rose-300 font-medium">
                    ⚠️ Already Inside: Lorry {lorryNumber} is currently inside. Tap <strong>OUT</strong> below before recording next trip.
                  </div>
                )}
              </div>

              {/* Field 2: Remarks (Replaced Wheel Type – Optional for check-in) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Remarks
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Optional</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Driver Kumar / Sand load / Empty (Optional)"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl px-3.5 py-3 text-base font-medium text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-xs transition-colors"
                />
              </div>

            </div>

            {/* IN Button - intimates trip number dynamically */}
            <button
              type="submit"
              disabled={isSubmitting || !lorryNumber.trim() || duplicateCheck.isInside}
              className={`w-full py-3.5 rounded-xl text-base font-black shadow-md transition active:scale-[0.99] ${
                !lorryNumber.trim() || duplicateCheck.isInside
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                  : tripInfo.isReturning
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 dark:bg-gradient-to-r dark:from-emerald-600 dark:to-emerald-500 hover:dark:from-emerald-500 hover:dark:to-emerald-400 text-white shadow-emerald-600/20 dark:shadow-emerald-950/60'
              }`}
            >
              {lorryNumber.trim().length >= 4 && tripInfo.nextTripNumber > 1
                ? `IN (${getTripLabel(tripInfo.nextTripNumber)})`
                : 'IN'}
            </button>

          </form>
        </div>

        {/* OVERALL COUNTER STATS: 2+ TRIPS, INSIDE NOW, TOTAL TRIPS */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          
          {/* Stat 1: Vehicles going for 2 or more trips */}
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'MULTI_TRIP' ? 'ALL' : 'MULTI_TRIP')}
            className={`p-3 sm:p-3.5 rounded-xl border text-left transition shadow-xs active:scale-95 ${
              activeFilter === 'MULTI_TRIP'
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 ring-2 ring-amber-400/30'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] sm:text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                2+ Trips
              </span>
              <span className="text-xs">🔄</span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-300">
              {tripStats.multiTripVehiclesCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight font-medium">
              Vehicles with 2+ trips
            </div>
          </button>

          {/* Stat 2: Lorries Currently Inside */}
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'INSIDE' ? 'ALL' : 'INSIDE')}
            className={`p-3 sm:p-3.5 rounded-xl border text-left transition shadow-xs active:scale-95 ${
              activeFilter === 'INSIDE'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 ring-2 ring-emerald-400/30'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Inside Now
              </span>
              <span className="text-xs">🟢</span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-300">
              {tripStats.insideCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight font-medium">
              Pending OUT
            </div>
          </button>

          {/* Stat 3: Total Trips Today */}
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`p-3 sm:p-3.5 rounded-xl border text-left transition shadow-xs active:scale-95 ${
              activeFilter === 'ALL'
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 ring-2 ring-slate-400/30'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Total Trips
              </span>
              <span className="text-xs">📋</span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
              {tripStats.totalTripsCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight font-medium">
              {tripStats.totalVehiclesCount} lorries today
            </div>
          </button>

        </div>

        {/* 2+ Trips Vehicle List Chips (if any exist) */}
        {tripStats.multiTripVehiclesList.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Vehicles with 2 or more trips today ({tripStats.multiTripVehiclesCount}):</span>
              {activeFilter !== 'ALL' && (
                <button
                  onClick={() => setActiveFilter('ALL')}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline text-[11px] font-semibold"
                >
                  Show All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tripStats.multiTripVehiclesList.map((v) => (
                <span
                  key={v.compact}
                  className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold flex items-center space-x-1.5"
                >
                  <span>{v.plate}</span>
                  <span className="bg-amber-200 dark:bg-amber-500/30 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                    {v.trips} Trips
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* RECORD DISPLAY TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors">
          
          {/* Table Header Filter indicator */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
              {activeFilter === 'MULTI_TRIP' 
                ? 'Filtered: Vehicles with 2+ Trips Only' 
                : activeFilter === 'INSIDE' 
                  ? 'Filtered: Inside Now Only' 
                  : "Today's Lorry Records"}
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              Showing {displayedMovements.length} of {tripStats.totalTripsCount}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[11px] sm:text-xs tracking-wider">
                  <th className="py-3 px-3 sm:px-4">Lorry Number</th>
                  <th className="py-3 px-3 sm:px-4">Remarks</th>
                  <th className="py-3 px-3 sm:px-4">IN Time</th>
                  <th className="py-3 px-3 sm:px-4">OUT Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {displayedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs sm:text-sm font-normal">
                      {activeFilter === 'MULTI_TRIP'
                        ? 'No vehicles have completed 2 or more trips yet today.'
                        : activeFilter === 'INSIDE'
                          ? 'No lorries currently inside the facility.'
                          : 'No lorry records for today. Enter a lorry number above and click IN.'}
                    </td>
                  </tr>
                ) : (
                  displayedMovements.map((mov) => {
                    const isPending = mov.status === 'IN' && mov.is_active_inside;
                    const inTimeStr = formatTime(mov.entry_time);
                    const outTimeStr = mov.exit_time ? formatTime(mov.exit_time) : null;
                    const tripNumber = getMovementTripNumber(mov);
                    const tripLabel = getTripLabel(tripNumber);

                    return (
                      <tr 
                        key={mov.id} 
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition ${
                          isPending ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        {/* Lorry Number with Trip Intimation Badge */}
                        <td className="py-3.5 px-3 sm:px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span>{mov.plate_number}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold tracking-tight ${
                              tripNumber > 1
                                ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/50'
                                : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}>
                              {tripLabel}
                            </span>
                          </div>
                        </td>

                        {/* Remarks (Entry & Exit Notes) */}
                        <td className="py-3.5 px-3 sm:px-4 text-xs">
                          {mov.remarks || mov.entry_notes || mov.exit_remarks || mov.exit_notes ? (
                            <div className="space-y-0.5 max-w-[220px]">
                              {(mov.remarks || mov.entry_notes) && (
                                <span className="block truncate text-slate-700 dark:text-slate-200 font-medium">
                                  {mov.remarks || mov.entry_notes}
                                </span>
                              )}
                              {(mov.exit_remarks || mov.exit_notes) && (
                                <span className="block truncate text-[11px] text-amber-700 dark:text-amber-300/80 font-mono">
                                  OUT: {mov.exit_remarks || mov.exit_notes}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 font-mono text-xs">-</span>
                          )}
                        </td>

                        {/* IN Time */}
                        <td className="py-3.5 px-3 sm:px-4 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {inTimeStr}
                        </td>

                        {/* OUT Time */}
                        <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                          {isPending ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-amber-600 dark:text-amber-400 font-mono font-bold text-xs">
                                Pending
                              </span>
                              <button
                                onClick={() => handleStartRecordOut(mov)}
                                disabled={isSubmitting}
                                className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-xs shadow-xs transition"
                              >
                                OUT
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {outTimeStr || 'Pending'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

      </main>

      {/* ================= MODAL: RECORD OUT ================= */}
      {exitModalMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Lorry OUT</h3>
                <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{exitModalMovement.plate_number}</p>
              </div>
              <button
                onClick={() => setExitModalMovement(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>IN Time:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{formatTime(exitModalMovement.entry_time)}</span>
              </div>
              {(exitModalMovement.remarks || exitModalMovement.entry_notes) && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>IN Remarks:</span>
                  <span className="text-slate-800 dark:text-slate-300 truncate max-w-[180px]">
                    {exitModalMovement.remarks || exitModalMovement.entry_notes}
                  </span>
                </div>
              )}
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setExitModalMovement(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRecordOut}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition"
              >
                {isSubmitting ? 'Saving...' : 'Confirm OUT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADMIN LOGIN ================= */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Admin Console Login</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Staff does not need login</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdminModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adminLoginError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500/50 rounded-xl text-xs text-rose-800 dark:text-rose-300 font-medium">
                {adminLoginError}
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@gmail.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAdminLoggingIn}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-black text-sm shadow-md transition"
              >
                {isAdminLoggingIn ? 'Verifying...' : 'Sign In as Admin'}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
