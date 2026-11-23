import React, { useState, useMemo } from 'react';
import { useLorryData } from '../../context/LorryDataContext';
import { useAuth } from '../../context/AuthContext';
import { format, isToday } from 'date-fns';
import { formatLorryNumber, formatStrictLorryNumber, isValidLorryNumber, getTripLabel } from '../../utils/vehicleFormatter';
import { 
  Lock, Shield, X, Eye, EyeOff, RefreshCw, CheckCircle2, Search, 
  FileText, Download, Calendar, TrendingUp, Truck, ChevronLeft, ChevronRight, History 
} from 'lucide-react';
import { TipperTruckIcon } from '../common/TipperTruckIcon';
import { ThemeToggle } from '../common/ThemeToggle';
import { calculateDailyReport, getISTDateString, formatISTDisplayDate } from '../../utils/reportCalculator';
import { generateDailyReportPDF } from '../../utils/pdfGenerator';

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
  const [searchQuery, setSearchQuery] = useState(''); // Lorry Search Field state

  // State for Check-Out (OUT) Modal
  const [exitModalMovement, setExitModalMovement] = useState(null);

  // Admin Login Modal State (Staff requires NO login, only Admin needs login)
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState(null);
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);

  // Daily Report & PDF State (Staff Accessible)
  const todayIST = useMemo(() => getISTDateString(new Date()), []);
  const [dailyReportDate, setDailyReportDate] = useState(todayIST);
  const [isExportingDailyPDF, setIsExportingDailyPDF] = useState(false);
  const [staffReportSearch, setStaffReportSearch] = useState('');

  // Available historical report dates
  const availableDates = useMemo(() => {
    const set = new Set();
    (movements || []).forEach(m => {
      const d = getISTDateString(m.entry_time || m.in_time || m.created_at);
      if (d) set.add(d);
    });
    return Array.from(set).sort().reverse();
  }, [movements]);

  const handlePrevReportDay = () => {
    const cur = new Date(dailyReportDate + 'T00:00:00+05:30');
    cur.setDate(cur.getDate() - 1);
    setDailyReportDate(getISTDateString(cur));
  };

  const handleNextReportDay = () => {
    const cur = new Date(dailyReportDate + 'T00:00:00+05:30');
    cur.setDate(cur.getDate() + 1);
    setDailyReportDate(getISTDateString(cur));
  };

  const staffDailyReport = useMemo(() => {
    return calculateDailyReport(movements, dailyReportDate);
  }, [movements, dailyReportDate]);

  const filteredStaffReportRows = useMemo(() => {
    if (!staffReportSearch.trim()) return staffDailyReport.vehicleWiseRows;
    const q = staffReportSearch.toUpperCase().replace(/\s+/g, '');
    return staffDailyReport.vehicleWiseRows.filter(r =>
      r.compact.includes(q) || (r.plate_number && r.plate_number.toUpperCase().includes(q))
    );
  }, [staffDailyReport.vehicleWiseRows, staffReportSearch]);

  const handleDownloadStaffDailyPDF = () => {
    try {
      setIsExportingDailyPDF(true);
      generateDailyReportPDF(staffDailyReport);
    } catch (err) {
      console.error('Error generating daily PDF from staff screen:', err);
      alert('Failed to generate Daily PDF: ' + err.message);
    } finally {
      setIsExportingDailyPDF(false);
    }
  };

  // Check strict format: TN + 2 digits + 1-2 letters + 4 digits
  const isValidPlate = isValidLorryNumber(lorryNumber);

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

  // Filtered movements for display based on staff filter selection and lorry search
  const displayedMovements = useMemo(() => {
    let list = staffDayMovements;

    if (activeFilter === 'MULTI_TRIP') {
      list = list.filter(m => {
        const compact = (m.plate_number || '').toUpperCase().replace(/\s+/g, '');
        return (tripStats.multiTripVehiclesMap[compact] || 0) >= 2;
      });
    } else if (activeFilter === 'INSIDE') {
      list = list.filter(m => m.is_active_inside && m.status === 'IN');
    }

    if (searchQuery && searchQuery.trim()) {
      const cleanSearch = searchQuery.toUpperCase().replace(/\s+/g, '');
      list = list.filter(m => {
        const plateCompact = (m.plate_number || m.vehicle_number || '').toUpperCase().replace(/\s+/g, '');
        const plateFormatted = (m.plate_number || m.vehicle_number || '').toUpperCase();
        return plateCompact.includes(cleanSearch) || plateFormatted.includes(searchQuery.toUpperCase().trim());
      });
    }

    return list;
  }, [staffDayMovements, activeFilter, tripStats.multiTripVehiclesMap, searchQuery]);

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

    const normPlate = formatStrictLorryNumber(lorryNumber);
    if (!isValidLorryNumber(normPlate)) {
      setErrorMsg('Strict format required: TN [2 Digits] [1-2 Letters] [4 Digits] (e.g. TN 20 BV 4231 or TN 21 H 1234).');
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
                  placeholder="TN 20 BV 4231"
                  value={lorryNumber}
                  onFocus={(e) => {
                    if (e.target.value === 'TN ') {
                      e.target.setSelectionRange(3, 3);
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val || val.trim() === '' || val.trim() === 'TN') {
                      setLorryNumber('TN ');
                      return;
                    }
                    const formatted = formatStrictLorryNumber(val);
                    setLorryNumber(formatted === 'TN' ? 'TN ' : formatted);
                  }}
                  className={`w-full bg-white dark:bg-slate-950 border-2 rounded-xl px-3.5 py-3 text-base sm:text-lg font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-emerald-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none shadow-xs transition-colors ${
                    isValidPlate
                      ? 'border-emerald-500 dark:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10'
                  }`}
                />

                {/* Strict Format Progress & Indicator (PAN card style) */}
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  {isValidPlate ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Strict Format Complete</span>
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Must be: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">TN [2 Digits] [1-2 Letters] [4 Digits]</span>
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                    e.g. TN 20 BV 4231
                  </span>
                </div>

                {/* INTIMATION BANNER FOR 2nd TRIP / RETURNING LORRY */}
                {isValidPlate && tripInfo.isReturning && !duplicateCheck.isInside && (
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
                {isValidPlate && duplicateCheck.isInside && (
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

            {/* IN Button - strictly requires valid format to proceed */}
            <button
              type="submit"
              disabled={isSubmitting || !isValidPlate || duplicateCheck.isInside}
              className={`w-full py-3.5 rounded-xl text-base font-black shadow-md transition active:scale-[0.99] flex items-center justify-center space-x-2 ${
                !isValidPlate || duplicateCheck.isInside
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                  : tripInfo.isReturning
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 dark:bg-gradient-to-r dark:from-emerald-600 dark:to-emerald-500 hover:dark:from-emerald-500 hover:dark:to-emerald-400 text-white shadow-emerald-600/20 dark:shadow-emerald-950/60'
              }`}
            >
              {!isValidPlate ? (
                <span>
                  {lorryNumber.trim() === 'TN' || !lorryNumber.trim()
                    ? 'IN — Enter Lorry Number'
                    : 'IN — Complete 4-Digit Number Required'}
                </span>
              ) : duplicateCheck.isInside ? (
                <span>Vehicle Already Inside (Tap OUT below)</span>
              ) : tripInfo.isReturning ? (
                <span>IN ({getTripLabel(tripInfo.nextTripNumber)})</span>
              ) : (
                <span>IN</span>
              )}
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
          
          {/* Table Header Filter indicator & Search */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <span className="text-slate-800 dark:text-slate-200 font-extrabold uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap">
                {activeFilter === 'MULTI_TRIP' 
                  ? 'Filtered: Vehicles with 2+ Trips Only' 
                  : activeFilter === 'INSIDE' 
                    ? 'Filtered: Inside Now Only' 
                    : "Today's Lorry Records"}
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-300/60 dark:border-slate-700/80">
                {displayedMovements.length} of {tripStats.totalTripsCount}
              </span>
            </div>

            {/* Lorry Search Field: Search by last 4 digits or any part of the registration number */}
            <div className="relative flex items-center w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search 4 digits (e.g. 5432)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl pl-8 pr-8 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-emerald-300 placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 shadow-2xs transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[11px] sm:text-xs tracking-wider">
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
                      {searchQuery && searchQuery.trim() ? (
                        <div className="space-y-1.5">
                          <p>
                            No lorry records found matching{' '}
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              "{searchQuery.trim()}"
                            </span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition"
                          >
                            <span>Clear Search</span>
                          </button>
                        </div>
                      ) : activeFilter === 'MULTI_TRIP'
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
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition ${
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

        {/* =========================================================================
            DAILY REPORT & AUDIT SECTION (Staff Screen)
            ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors space-y-5">
          
          {/* Section Header: Title, Date Selector, Prev/Next, and PDF Download Button */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileText className="w-5 h-5" />
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-wide">
                  DAILY REPORTS & AUDIT
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Trip distribution statistics, vehicle-wise summary, and official A4 Daily Report PDF download.
              </p>
            </div>

            {/* Controls: Date Picker & PDF Download CTA */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Prev Day */}
              <button
                type="button"
                onClick={handlePrevReportDay}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Date Input */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-inner">
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2 shrink-0" />
                <input
                  type="date"
                  value={dailyReportDate}
                  onChange={(e) => setDailyReportDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
                />
              </div>

              {/* Next Day */}
              <button
                type="button"
                onClick={handleNextReportDay}
                disabled={dailyReportDate >= todayIST}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Download PDF Button */}
              <button
                type="button"
                onClick={handleDownloadStaffDailyPDF}
                disabled={isExportingDailyPDF}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingDailyPDF ? 'Generating...' : 'Download Daily Report (PDF)'}</span>
              </button>
            </div>
          </div>

          {/* Quick Available Date Pills */}
          {availableDates.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Dates:</span>
              {availableDates.slice(0, 7).map(dStr => (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => setDailyReportDate(dStr)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-semibold transition shrink-0 ${
                    dailyReportDate === dStr
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  {formatISTDisplayDate(dStr)}
                </button>
              ))}
            </div>
          )}

          {/* 5 KPI Summary Badges for Selected Date */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5">
              <div className="text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">Total Vehicles</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{staffDailyReport.totalUniqueVehicles}</div>
              <div className="text-[9px] text-slate-400">Unique tippers</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5">
              <div className="text-[10px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">Total Trips</div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{staffDailyReport.totalTrips}</div>
              <div className="text-[9px] text-slate-400">Total movements</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5">
              <div className="text-[10px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">IN Entries</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{staffDailyReport.totalIn}</div>
              <div className="text-[9px] text-slate-400">Checked IN</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5">
              <div className="text-[10px] font-bold tracking-wider uppercase text-sky-600 dark:text-sky-400">OUT Entries</div>
              <div className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 mt-0.5">{staffDailyReport.totalOut}</div>
              <div className="text-[9px] text-slate-400">Completed exit</div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5">
              <div className="text-[10px] font-bold tracking-wider uppercase text-rose-600 dark:text-rose-400">Pending OUT</div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{staffDailyReport.pendingOut}</div>
              <div className="text-[9px] text-slate-400">Inside facility</div>
            </div>
          </div>

          {/* Trip-Wise Distinct Category Cards (1st Trip, 2nd Trip, 3rd Trip, 4th Trip, 5+ Trips) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>Trip-Wise Vehicle Count ({staffDailyReport.displayDate})</span>
              </h3>
              <span className="text-[10px] text-slate-400 italic">Each vehicle counted once in final category</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2.5 text-center">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">1st Trip</div>
                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {staffDailyReport.tripCategories.trips1}
                </div>
                <div className="text-[9px] text-slate-400">Vehicles (1 trip only)</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2.5 text-center">
                <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">2nd Trip</div>
                <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                  {staffDailyReport.tripCategories.trips2}
                </div>
                <div className="text-[9px] text-slate-400">Vehicles (2 trips only)</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2.5 text-center">
                <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase">3rd Trip</div>
                <div className="text-lg sm:text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">
                  {staffDailyReport.tripCategories.trips3}
                </div>
                <div className="text-[9px] text-slate-400">Vehicles (3 trips only)</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2.5 text-center">
                <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">4th Trip</div>
                <div className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {staffDailyReport.tripCategories.trips4}
                </div>
                <div className="text-[9px] text-slate-400">Vehicles (4 trips only)</div>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2.5 text-center">
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">5+ Trips</div>
                <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {staffDailyReport.tripCategories.trips5Plus}
                </div>
                <div className="text-[9px] text-slate-400">5 or more trips</div>
              </div>
            </div>
          </div>

          {/* Vehicle-Wise Summary Table for Selected Date */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Truck className="w-3.5 h-3.5 text-amber-500" />
                  <span>Vehicle-Wise Trip Summary ({filteredStaffReportRows.length} vehicles)</span>
                </h3>
              </div>

              {/* In-table search filter */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter plate (e.g. 1829)..."
                  value={staffReportSearch}
                  onChange={(e) => setStaffReportSearch(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-2.5 w-10 text-center">#</th>
                    <th className="py-2 px-2.5">Lorry Number</th>
                    <th className="py-2 px-2.5">Trips Completed</th>
                    <th className="py-2 px-2.5">Remarks</th>
                    <th className="py-2 px-2.5 text-center w-24">Total Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredStaffReportRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                        No vehicle trips recorded for {staffDailyReport.displayDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredStaffReportRows.map((row, idx) => (
                      <tr key={row.compact} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="py-2.5 px-2.5 text-center font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-2.5 font-mono font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center space-x-1.5">
                            <span>{row.plate_number}</span>
                            {row.tripsCount > 1 && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/50">
                                {row.tripsCount} Trips
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                            {row.tripsCount} {row.tripsCount === 1 ? 'trip' : 'trips'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-600 dark:text-slate-400 max-w-[180px] truncate text-xs">
                          {row.remarks || '-'}
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full font-mono font-black text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                            {row.tripsCount}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
