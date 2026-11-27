import React, { useState, useMemo } from 'react';
import { useLorryData } from '../../context/LorryDataContext';
import { useAuth } from '../../context/AuthContext';
import { format, isToday } from 'date-fns';
import { formatLorryNumber, formatStrictLorryNumber, isValidLorryNumber, getTripLabel, getTripBadgeStyle } from '../../utils/vehicleFormatter';
import { 
  Lock, Shield, X, Eye, EyeOff, RefreshCw, CheckCircle2, Search, 
  FileText, Download, Calendar, TrendingUp, Truck, ChevronLeft, ChevronRight, History,
  Users, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import { TipperTruckIcon } from '../common/TipperTruckIcon';
import { ThemeToggle } from '../common/ThemeToggle';
import { calculateDailyReport, getISTDateString, formatISTDisplayDate } from '../../utils/reportCalculator';
import { generateDailyReportPDF } from '../../utils/pdfGenerator';

export const StaffSimpleScreen = () => {
  const { 
    movements, 
    activeLorries = [],
    teams = [],
    checkLorryInsideStatus, 
    getLorryTripInfo, 
    recordEntry, 
    recordExit,
    isSyncing,
    syncStatus,
    refreshData,
    assignMovementTeam,
    addTeam
  } = useLorryData();
  const { login, logout, profile, isAdmin } = useAuth();

  const [lorryNumber, setLorryNumber] = useState('TN ');
  const [remarks, setRemarks] = useState(''); // Replaced Wheel Type with optional Remarks
  
  // Team Selection State (Initial: Team 1 & 2 enabled, Team 3 & 4 disabled)
  const [selectedTeamId, setSelectedTeamId] = useState(() => {
    try {
      const saved = localStorage.getItem('fleetgate_active_team');
      if (saved) return saved;
    } catch (_) {}
    return 'team-1';
  });

  const [teamFilter, setTeamFilter] = useState('ALL'); // 'ALL' | team name

  const activeTeam = useMemo(() => {
    return teams.find(t => t.id === selectedTeamId) || teams.find(t => t.is_active) || teams[0];
  }, [teams, selectedTeamId]);

  // Quick OUT Picker Modal State
  const [isQuickOutPickerOpen, setIsQuickOutPickerOpen] = useState(false);
  const [quickOutSearch, setQuickOutSearch] = useState('');

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
  const yesterdayIST = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getISTDateString(d);
  }, []);

  // Lorry Records Date Filter State (Defaults to today, but staff can view yesterday, any past date, or all records)
  const [selectedRecordsDate, setSelectedRecordsDate] = useState(todayIST);
  const [dailyReportDate, setDailyReportDate] = useState(todayIST);
  const [isExportingDailyPDF, setIsExportingDailyPDF] = useState(false);

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
    const base = dailyReportDate === 'ALL' ? todayIST : dailyReportDate;
    const cur = new Date(base + 'T00:00:00+05:30');
    cur.setDate(cur.getDate() - 1);
    const d = getISTDateString(cur);
    setDailyReportDate(d);
    setSelectedRecordsDate(d);
  };

  const handleNextReportDay = () => {
    const base = dailyReportDate === 'ALL' ? todayIST : dailyReportDate;
    const cur = new Date(base + 'T00:00:00+05:30');
    cur.setDate(cur.getDate() + 1);
    const d = getISTDateString(cur);
    setDailyReportDate(d);
    setSelectedRecordsDate(d);
  };

  const handlePrevRecordsDay = () => {
    const base = selectedRecordsDate === 'ALL' ? todayIST : selectedRecordsDate;
    const cur = new Date(base + 'T00:00:00+05:30');
    cur.setDate(cur.getDate() - 1);
    const d = getISTDateString(cur);
    setSelectedRecordsDate(d);
    setDailyReportDate(d);
  };

  const handleNextRecordsDay = () => {
    const base = selectedRecordsDate === 'ALL' ? todayIST : selectedRecordsDate;
    const cur = new Date(base + 'T00:00:00+05:30');
    cur.setDate(cur.getDate() + 1);
    const d = getISTDateString(cur);
    setSelectedRecordsDate(d);
    setDailyReportDate(d);
  };

  const staffDailyReport = useMemo(() => {
    return calculateDailyReport(movements, dailyReportDate);
  }, [movements, dailyReportDate]);

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

  // Staff Movements Filter: Supports viewing Today, Yesterday, Any Past Date, or All Records
  const staffDayMovements = useMemo(() => {
    if (selectedRecordsDate === 'ALL') {
      return movements;
    }

    return movements.filter(m => {
      try {
        const entryDate = getISTDateString(m.entry_time || m.in_time || m.created_at);
        const isMatch = entryDate === selectedRecordsDate;
        const isTodaySelected = selectedRecordsDate === todayIST;
        return isMatch || (isTodaySelected && m.is_active_inside && m.status === 'IN');
      } catch {
        return false;
      }
    });
  }, [movements, selectedRecordsDate, todayIST]);

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

  // Team vehicle and trip counts for today's movements
  const teamVehicleCounts = useMemo(() => {
    const counts = {};
    teams.forEach(t => {
      counts[t.name] = {
        name: t.name,
        members: t.members,
        is_active: t.is_active,
        uniquePlates: new Set(),
        trips: 0
      };
    });

    staffDayMovements.forEach(m => {
      let tName = m.team;
      if (!tName && m.team_name) {
        tName = m.team_name.split(':')[0].trim();
      }
      if (tName && counts[tName]) {
        counts[tName].trips += 1;
        const compact = (m.plate_number || '').toUpperCase().replace(/\s+/g, '');
        if (compact) counts[tName].uniquePlates.add(compact);
      }
    });

    return counts;
  }, [teams, staffDayMovements]);

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

    if (teamFilter !== 'ALL') {
      list = list.filter(m => (m.team_name || m.team) === teamFilter);
    }

    if (searchQuery && searchQuery.trim()) {
      const cleanSearch = searchQuery.toUpperCase().replace(/\s+/g, '');
      list = list.filter(m => {
        const plateCompact = (m.plate_number || m.vehicle_number || '').toUpperCase().replace(/\s+/g, '');
        const plateFormatted = (m.plate_number || m.vehicle_number || '').toUpperCase();
        return plateCompact.includes(cleanSearch) || plateFormatted.includes(searchQuery.toUpperCase().trim());
      });
    }

    return [...list].sort((a, b) => new Date(b.entry_time || 0) - new Date(a.entry_time || 0));
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
      team: activeTeam ? activeTeam.name : 'Team 1',
      team_name: activeTeam ? activeTeam.name : 'Team 1',
      team_id: activeTeam?.id || selectedTeamId,
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
        remarks: remarks.trim(),
        teamName: activeTeam ? activeTeam.name : 'Team 1'
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

        {/* LORRY ENTRY FORM: LORRY NUMBER, DUTY TEAM, REMARKS, AND IN / OUT ACTIONS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors">
          <form onSubmit={handleRecordIn} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              
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
                    ⚠️ Already Inside: Lorry {lorryNumber} is currently inside. Tap <strong>RECORD OUT</strong> on the right to complete visit.
                  </div>
                )}
              </div>

              {/* Field 2: Team Selection Dropdown (Placed next to OUT section with live vehicle count) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    <span>Duty Team</span>
                  </label>
                  {/* Live Team Vehicle Count Badges */}
                  <div className="flex items-center space-x-1.5">
                    {teams.filter(t => t.is_active).map(t => {
                      const vCount = teamVehicleCounts[t.name]?.uniquePlates.size || 0;
                      return (
                        <span
                          key={t.id}
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md border transition ${
                            selectedTeamId === t.id
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {t.name}: {vCount} Vehicles
                        </span>
                      );
                    })}
                  </div>
                </div>

                <select
                  value={selectedTeamId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedTeamId(val);
                    try { localStorage.setItem('fleetgate_active_team', val); } catch {}
                  }}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl px-3.5 py-3 text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-xs transition-colors cursor-pointer"
                >
                  {teams.map(t => {
                    const vCount = teamVehicleCounts[t.name]?.uniquePlates.size || 0;
                    return (
                      <option
                        key={t.id}
                        value={t.id}
                        disabled={!t.is_active}
                        className={!t.is_active ? 'text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-900 font-normal italic' : 'text-slate-900 dark:text-white font-semibold'}
                      >
                        {t.name} — {t.members} ({vCount} vehicles today) {!t.is_active ? '(Disabled)' : ''}
                      </option>
                    );
                  })}
                </select>

                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="truncate">
                    Staff: <strong className="text-slate-800 dark:text-slate-200">{activeTeam?.members || 'Unassigned'}</strong>
                  </span>
                  <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                    {activeTeam?.name}: <strong>{teamVehicleCounts[activeTeam?.name]?.uniquePlates.size || 0} Vehicles</strong> ({teamVehicleCounts[activeTeam?.name]?.trips || 0} Trips Today)
                  </span>
                </div>
              </div>

              {/* Field 3: Remarks (Optional for check-in) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Remarks
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Optional</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Driver Kumar / Sand load (Optional)"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl px-3.5 py-3 text-sm sm:text-base font-medium text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-xs transition-colors"
                />
                <div className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                  Driver or cargo notes
                </div>
              </div>

            </div>

            {/* ACTION SECTION: IN Action (Left) & OUT Section (Right) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Left Button: RECORD IN */}
              <button
                type="submit"
                disabled={isSubmitting || !isValidPlate || duplicateCheck.isInside}
                className={`w-full py-4 px-4 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition-all transform active:scale-98 ${
                  !isValidPlate || duplicateCheck.isInside
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                    : tripInfo.isReturning
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25 ring-2 ring-amber-400/50 cursor-pointer animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer'
                }`}
              >
                <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
                {!isValidPlate ? (
                  <span>
                    {lorryNumber.trim() === 'TN' || !lorryNumber.trim()
                      ? 'IN — Enter Lorry Number'
                      : 'IN — Complete 4-Digit Number Required'}
                  </span>
                ) : duplicateCheck.isInside ? (
                  <span>Vehicle Already Inside (Tap OUT on right)</span>
                ) : tripInfo.isReturning ? (
                  <span>RECORD IN ({getTripLabel(tripInfo.nextTripNumber)})</span>
                ) : (
                  <span>RECORD IN</span>
                )}
              </button>

              {/* Right Button / Section: OUT Section */}
              <button
                type="button"
                onClick={() => {
                  if (duplicateCheck.isInside && duplicateCheck.movement) {
                    handleStartRecordOut(duplicateCheck.movement);
                  } else {
                    setIsQuickOutPickerOpen(true);
                  }
                }}
                disabled={isSubmitting}
                className={`w-full py-4 px-4 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition-all transform active:scale-98 cursor-pointer ${
                  duplicateCheck.isInside
                    ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30 ring-2 ring-sky-400 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 shadow-slate-900/30'
                }`}
              >
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                {duplicateCheck.isInside ? (
                  <span>RECORD OUT — {lorryNumber} (Ready to Exit)</span>
                ) : (
                  <span>RECORD OUT ({activeLorries.length} Inside)</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* =========================================================================
            1. DASHBOARD SUMMARY CARDS (All 7 Cards Together - Styled to Match Screenshot)
            Arrangement:
            Header: DATES: [ 26 Nov 2026 ]
            Left Column:
              1. Total Trips (Top)
              Directly below: 2. 2+ Trips | 3. Inside Now (2 equal cards)
            Right Column:
              4. IN Entries (Top)
              Directly below: 5. Total Vehicles | 6. OUT Entries (2 equal cards)
            Bottom:
              7. Pending OUT (Full-width spanning both columns)
            ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors space-y-3.5">
          {/* Header: DATES pill matching screenshot */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black tracking-wider uppercase text-slate-500 dark:text-slate-400">
                DATES:
              </span>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1 shadow-inner">
                <Calendar className="w-3.5 h-3.5 text-blue-500 mr-1.5 shrink-0" />
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatISTDisplayDate(dailyReportDate === 'ALL' ? todayIST : dailyReportDate)}
                </span>
              </div>
            </div>

            {/* Quick Date Switcher: Prev, Today, Yesterday, Next */}
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={handlePrevReportDay}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Previous Day"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDailyReportDate(todayIST);
                  setSelectedRecordsDate(todayIST);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition cursor-pointer ${
                  dailyReportDate === todayIST
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setDailyReportDate(yesterdayIST);
                  setSelectedRecordsDate(yesterdayIST);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition cursor-pointer ${
                  dailyReportDate === yesterdayIST
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={handleNextReportDay}
                disabled={dailyReportDate >= todayIST}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next Day"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Cards Grid: 2 Columns for Symmetrical Balance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            
            {/* LEFT COLUMN: Trips Metric Section */}
            <div className="flex flex-col space-y-3">
              {/* Card 1: Total Trips */}
              <button
                type="button"
                onClick={() => setActiveFilter('ALL')}
                className={`w-full text-left bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-amber-400 dark:hover:border-amber-500 cursor-pointer ${
                  activeFilter === 'ALL' ? 'ring-2 ring-amber-400/40' : ''
                }`}
              >
                <div className="text-xs sm:text-sm font-bold tracking-wider uppercase text-amber-500 dark:text-amber-400">
                  TOTAL TRIPS
                </div>
                <div className="text-3xl sm:text-4xl font-black font-mono text-amber-500 dark:text-amber-400 my-1">
                  {staffDailyReport.totalTrips}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Total movements
                </div>
              </button>

              {/* Directly Below Total Trips: Card 2 (2+ Trips) & Card 3 (Inside Now) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                {/* Card 2: 2+ Trips */}
                <button
                  type="button"
                  onClick={() => setActiveFilter(activeFilter === 'MULTI_TRIP' ? 'ALL' : 'MULTI_TRIP')}
                  className={`w-full text-left bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition hover:border-purple-400 dark:hover:border-purple-500 cursor-pointer ${
                    activeFilter === 'MULTI_TRIP' ? 'ring-2 ring-purple-500 bg-purple-50/80 dark:bg-purple-950/40' : ''
                  }`}
                >
                  <div className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-purple-600 dark:text-purple-400">
                    2+ TRIPS
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-purple-600 dark:text-purple-400 my-1">
                    {staffDailyReport.multiTripVehiclesCount}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Vehicles with 2+ trips
                  </div>
                </button>

                {/* Card 3: Inside Now */}
                <button
                  type="button"
                  onClick={() => setActiveFilter(activeFilter === 'INSIDE' ? 'ALL' : 'INSIDE')}
                  className={`w-full text-left bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition hover:border-emerald-400 dark:hover:border-emerald-500 cursor-pointer ${
                    activeFilter === 'INSIDE' ? 'ring-2 ring-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40' : ''
                  }`}
                >
                  <div className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                    INSIDE NOW
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 my-1">
                    {staffDailyReport.insideNowCount}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Currently inside facility
                  </div>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Gate Influx & Fleet Breakdown */}
            <div className="flex flex-col space-y-3">
              {/* Card 4: IN Entries */}
              <div className="w-full text-left bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xs transition">
                <div className="text-xs sm:text-sm font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                  IN ENTRIES
                </div>
                <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-600 dark:text-emerald-400 my-1">
                  {staffDailyReport.totalIn}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Checked IN
                </div>
              </div>

              {/* Directly Below IN Entries: Card 5 (Total Vehicles) & Card 6 (OUT Entries) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                {/* Card 5: Total Vehicles */}
                <div className="w-full text-left bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition">
                  <div className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-slate-700 dark:text-slate-200">
                    TOTAL VEHICLES
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white my-1">
                    {staffDailyReport.totalUniqueVehicles}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Unique tippers
                  </div>
                </div>

                {/* Card 6: OUT Entries */}
                <div className="w-full text-left bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition">
                  <div className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-sky-600 dark:text-sky-400">
                    OUT ENTRIES
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-sky-600 dark:text-sky-400 my-1">
                    {staffDailyReport.totalOut}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Completed exit
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Card 7: PENDING OUT (Full-width spanning both columns, matching user's screenshot) */}
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'INSIDE' ? 'ALL' : 'INSIDE')}
            className={`w-full text-left bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-rose-400 dark:hover:border-rose-500 cursor-pointer ${
              activeFilter === 'INSIDE' ? 'ring-2 ring-rose-500 bg-rose-50/80 dark:bg-rose-950/40' : ''
            }`}
          >
            <div className="text-xs sm:text-sm font-bold tracking-wider uppercase text-rose-500 dark:text-rose-400">
              PENDING OUT
            </div>
            <div className="text-3xl sm:text-4xl font-black font-mono text-rose-500 dark:text-rose-400 my-1">
              {staffDailyReport.pendingOut}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Inside facility
            </div>
          </button>
        </div>

        {/* 2+ Trips Vehicle List Chips (if any exist) */}
        {tripStats.multiTripVehiclesList.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Vehicles with 2 or more trips ({tripStats.multiTripVehiclesCount}):</span>
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
          
          {/* Table Header: Title, Date Navigation & Search */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
            {/* Team Vehicle Counts Summary Bar */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Team Vehicle Count:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {teams.filter(t => t.is_active).map(t => {
                  const vCount = teamVehicleCounts[t.name]?.uniquePlates.size || 0;
                  const tCount = teamVehicleCounts[t.name]?.trips || 0;
                  return (
                    <span
                      key={t.id}
                      className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    >
                      <span>{t.name}:</span>
                      <span className="font-mono text-blue-900 dark:text-blue-100">{vCount} vehicles</span>
                      <span className="text-[10px] text-blue-500 dark:text-blue-400 font-normal">({tCount} trips)</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Top Bar: Title & Date Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2">
                <span className="text-slate-900 dark:text-white font-extrabold uppercase tracking-wider text-xs sm:text-sm">
                  {selectedRecordsDate === todayIST
                    ? "Today's Lorry Records"
                    : selectedRecordsDate === yesterdayIST
                    ? "Yesterday's Lorry Records"
                    : selectedRecordsDate === 'ALL'
                    ? "All Lorry Records"
                    : `Lorry Records (${formatISTDisplayDate(selectedRecordsDate)})`}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700">
                  {displayedMovements.length} {displayedMovements.length === 1 ? 'record' : 'records'}
                </span>
              </div>

              {/* Date Navigation Controls */}
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handlePrevRecordsDay}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mr-1.5 shrink-0" />
                  <input
                    type="date"
                    value={selectedRecordsDate === 'ALL' ? todayIST : selectedRecordsDate}
                    onChange={(e) => setSelectedRecordsDate(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNextRecordsDay}
                  disabled={selectedRecordsDate >= todayIST && selectedRecordsDate !== 'ALL'}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Next Day"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom Bar: Quick Filter Pills & Lorry Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
              {/* Quick Date Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedRecordsDate(todayIST)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    selectedRecordsDate === todayIST
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Today
                </button>

                {availableDates.length > 0 && availableDates[0] !== todayIST && (
                  <button
                    type="button"
                    onClick={() => setSelectedRecordsDate(availableDates[0])}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                      selectedRecordsDate === availableDates[0]
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                    }`}
                  >
                    Previous Day ({formatISTDisplayDate(availableDates[0])})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedRecordsDate('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    selectedRecordsDate === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  All Dates ({movements.length})
                </button>
              </div>

              {/* Team Filter Dropdown for Today's Records */}
              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Team:</span>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="text-xs font-bold rounded-lg px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer outline-none"
                >
                  <option value="ALL">All Teams</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Lorry Search Field */}
              <div className="relative flex items-center w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search 4 digits (e.g. 5432)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl pl-8 pr-8 py-1 text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-emerald-300 placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 shadow-2xs transition-colors"
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
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-xs shadow-xs">
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] sm:text-xs tracking-wider">
                  <th className="py-3 px-3 sm:px-4">Lorry Number</th>
                  <th className="py-3 px-3 sm:px-4">Duty Team</th>
                  <th className="py-3 px-3 sm:px-4">Remarks</th>
                  <th className="py-3 px-3 sm:px-4">IN Time</th>
                  <th className="py-3 px-3 sm:px-4">OUT Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {displayedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs sm:text-sm font-normal">
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
                      ) : (
                        <div className="space-y-2.5">
                          <p>
                            No lorry records found for{' '}
                            <strong className="text-slate-700 dark:text-slate-300">
                              {selectedRecordsDate === todayIST
                                ? 'today'
                                : selectedRecordsDate === yesterdayIST
                                ? 'yesterday'
                                : formatISTDisplayDate(selectedRecordsDate)}
                            </strong>.
                          </p>
                          {availableDates.length > 0 && availableDates[0] !== selectedRecordsDate && (
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setSelectedRecordsDate(availableDates[0])}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition active:scale-95"
                              >
                                <span>View Previous Day's Records ({formatISTDisplayDate(availableDates[0])})</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedRecordsDate('ALL')}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition active:scale-95"
                              >
                                <span>View All Records ({movements.length})</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
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
                            <span className={getTripBadgeStyle(tripNumber)}>
                              {tripLabel}
                            </span>
                          </div>
                        </td>

                        {/* Duty Team — Simple clean mention (Team 1, Team 2, etc.) */}
                        <td className="py-3.5 px-3 sm:px-4 text-xs whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
                            {(() => {
                              let t = mov.team || mov.team_name;
                              if (t && t.includes(':')) {
                                t = t.split(':')[0].trim();
                              }
                              return t || 'Team 1';
                            })()}
                          </span>
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

          {displayedMovements.length > 10 && (
            <div className="px-4 py-2 bg-slate-50/90 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 text-center font-medium">
              Showing first 10 records. Scroll vertically to view all {displayedMovements.length} records.
            </div>
          )}

        </div>

        {/* =========================================================================
            DAILY REPORT & AUDIT SECTION (Staff Screen - At Bottom)
            ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors space-y-4">
          
          {/* Section Header: Title, Date Selector, Prev/Next, and PDF Download Button */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
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
                Trip distribution statistics and official A4 Daily Report PDF download.
              </p>
            </div>

            {/* Controls: Date Picker & PDF Download CTA */}
            <div className="flex flex-wrap items-center gap-2">
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
                  value={dailyReportDate === 'ALL' ? todayIST : dailyReportDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDailyReportDate(val);
                    setSelectedRecordsDate(val);
                  }}
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
                  onClick={() => {
                    setDailyReportDate(dStr);
                    setSelectedRecordsDate(dStr);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition shrink-0 cursor-pointer ${
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
              {/* Trip 1 - Blue */}
              <div className="bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/70 rounded-xl p-2.5 text-center transition-colors">
                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">1st Trip</div>
                <div className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                  {staffDailyReport.tripCategories.trips1}
                </div>
                <div className="text-[9px] text-blue-500/80 dark:text-blue-400/70">Vehicles (1 trip only)</div>
              </div>

              {/* Trip 2 - Green */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 rounded-xl p-2.5 text-center transition-colors">
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">2nd Trip</div>
                <div className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {staffDailyReport.tripCategories.trips2}
                </div>
                <div className="text-[9px] text-emerald-500/80 dark:text-emerald-400/70">Vehicles (2 trips only)</div>
              </div>

              {/* Trip 3 - Purple */}
              <div className="bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/70 rounded-xl p-2.5 text-center transition-colors">
                <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">3rd Trip</div>
                <div className="text-lg sm:text-xl font-black text-purple-700 dark:text-purple-300 mt-0.5">
                  {staffDailyReport.tripCategories.trips3}
                </div>
                <div className="text-[9px] text-purple-500/80 dark:text-purple-400/70">Vehicles (3 trips only)</div>
              </div>

              {/* Trip 4 - Orange */}
              <div className="bg-orange-50/50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/70 rounded-xl p-2.5 text-center transition-colors">
                <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">4th Trip</div>
                <div className="text-lg sm:text-xl font-black text-orange-700 dark:text-orange-300 mt-0.5">
                  {staffDailyReport.tripCategories.trips4}
                </div>
                <div className="text-[9px] text-orange-500/80 dark:text-orange-400/70">Vehicles (4 trips only)</div>
              </div>

              {/* Trip 5+ - Teal */}
              <div className="col-span-2 sm:col-span-1 bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/70 rounded-xl p-2.5 text-center transition-colors">
                <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">5+ Trips</div>
                <div className="text-lg sm:text-xl font-black text-teal-700 dark:text-teal-300 mt-0.5">
                  {staffDailyReport.tripCategories.trips5Plus}
                </div>
                <div className="text-[9px] text-teal-500/80 dark:text-teal-400/70">5 or more trips</div>
              </div>
            </div>
          </div>
        </div>

      </main>

            {/* ================= MODAL: QUICK OUT PICKER ================= */}
{isQuickOutPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <ArrowUpRight className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Vehicle OUT</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeLorries.length} vehicle{activeLorries.length === 1 ? '' : 's'} currently inside facility
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsQuickOutPickerOpen(false);
                  setQuickOutSearch('');
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeLorries.length > 3 && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by plate number..."
                  value={quickOutSearch}
                  onChange={(e) => setQuickOutSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {activeLorries.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No vehicles are currently inside.
                </div>
              ) : (
                activeLorries
                  .filter(m => !quickOutSearch.trim() || (m.plate_number || '').toLowerCase().includes(quickOutSearch.toLowerCase().replace(/\s+/g, '')))
                  .map(mov => (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 hover:border-sky-400 transition"
                    >
                      <div>
                        <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                          {mov.plate_number}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-2 mt-0.5">
                          <span>IN: {formatTime(mov.entry_time)}</span>
                          {mov.team_name && (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">• {mov.team_name}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickOutPickerOpen(false);
                          setQuickOutSearch('');
                          handleStartRecordOut(mov);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center space-x-1 cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>OUT</span>
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

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
