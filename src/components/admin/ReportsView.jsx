import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  HardDrive, 
  ShieldCheck, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  FileSpreadsheet, 
  Layers, 
  Truck,
  ArrowRight,
  Database,
  History
} from 'lucide-react';
import { 
  getISTDateString, 
  formatISTDisplayDate, 
  calculateDailyReport, 
  calculateWeeklyReport 
} from '../../utils/reportCalculator';
import { generateDailyReportPDF, generateWeeklyReportPDF } from '../../utils/pdfGenerator';
import { TipperTruckIcon } from '../common/TipperTruckIcon';

export const ReportsView = ({ movements = [], onRefresh }) => {
  // ── States ──────────────────────────────────────────────────────────────────
  const todayIST = useMemo(() => getISTDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayIST);
  const [availableDates, setAvailableDates] = useState([todayIST]);
  const [vehicleSearch, setVehicleSearch] = useState('');

  // Weekly States
  const [savedWeeklySummaries, setSavedWeeklySummaries] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('current');
  const [isGeneratingWeekly, setIsGeneratingWeekly] = useState(false);

  // Storage Status States
  const [storageStatus, setStorageStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isMaintenanceRunning, setIsMaintenanceRunning] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(null);

  // PDF Loading Indicator
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // ── Fetch Available Dates, Weekly Summaries & Storage Status ─────────────────
  const fetchReportMetadata = async () => {
    try {
      // 1. Available Dates
      const resDates = await fetch('/api/reports/dates');
      if (resDates.ok) {
        const data = await resDates.json();
        if (data.dates && data.dates.length > 0) {
          setAvailableDates(data.dates);
        }
      }

      // 2. Saved Weekly Summaries
      const resWeekly = await fetch('/api/reports/weekly');
      if (resWeekly.ok) {
        const data = await resWeekly.json();
        if (data.summaries) {
          setSavedWeeklySummaries(data.summaries);
        }
      }

      // 3. Storage Status
      fetchStorageStatus();
    } catch (err) {
      console.error('Error fetching report metadata:', err);
    }
  };

  const fetchStorageStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/reports/storage-status');
      if (res.ok) {
        const data = await res.json();
        setStorageStatus(data.storageStatus);
      }
    } catch (err) {
      console.error('Error fetching storage status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchReportMetadata();
  }, [movements.length]);

  // ── Date Navigation Helpers ─────────────────────────────────────────────────
  const handlePrevDay = () => {
    const cur = new Date(selectedDate + 'T00:00:00+05:30');
    cur.setDate(cur.getDate() - 1);
    setSelectedDate(getISTDateString(cur));
  };

  const handleNextDay = () => {
    const cur = new Date(selectedDate + 'T00:00:00+05:30');
    cur.setDate(cur.getDate() + 1);
    setSelectedDate(getISTDateString(cur));
  };

  // ── Daily Report Calculations for Selected Date ─────────────────────────────
  const dailyReport = useMemo(() => {
    return calculateDailyReport(movements, selectedDate);
  }, [movements, selectedDate]);

  // Filter vehicle rows by search query
  const filteredVehicleRows = useMemo(() => {
    if (!vehicleSearch.trim()) return dailyReport.vehicleWiseRows;
    const q = vehicleSearch.toUpperCase().replace(/\s+/g, '');
    return dailyReport.vehicleWiseRows.filter(r => 
      r.compact.includes(q) || r.plate_number.toUpperCase().includes(q)
    );
  }, [dailyReport.vehicleWiseRows, vehicleSearch]);

  // ── Weekly Report Calculations ──────────────────────────────────────────────
  const activeWeeklyReport = useMemo(() => {
    if (selectedWeekId === 'current') {
      return calculateWeeklyReport(movements);
    }
    const found = savedWeeklySummaries.find(w => w.week_id === selectedWeekId);
    if (found) {
      return {
        weekStart: found.week_start,
        weekEnd: found.week_end,
        displayStart: found.display_start,
        displayEnd: found.display_end,
        totalUniqueVehicles: found.total_unique_vehicles,
        totalTrips: found.total_trips,
        dailyBreakdown: found.daily_breakdown || [],
        tripCategories: found.trip_categories || { trips1: 0, trips2: 0, trips3: 0, trips4: 0, trips5Plus: 0 },
        vehicleSummaries: (found.vehicle_summaries || []).map(v => ({
          ...v,
          day_counts: v.day_counts || {}
        }))
      };
    }
    return calculateWeeklyReport(movements);
  }, [selectedWeekId, savedWeeklySummaries, movements]);

  // ── PDF Download Handlers ────────────────────────────────────────────────────
  const handleDownloadDailyPDF = () => {
    try {
      setIsExportingPDF(true);
      generateDailyReportPDF(dailyReport);
    } catch (err) {
      console.error('Error generating daily PDF:', err);
      alert('Failed to generate Daily PDF: ' + err.message);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleDownloadWeeklyPDF = () => {
    try {
      setIsExportingPDF(true);
      generateWeeklyReportPDF(activeWeeklyReport);
    } catch (err) {
      console.error('Error generating weekly PDF:', err);
      alert('Failed to generate Weekly PDF: ' + err.message);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // ── Manual Maintenance Trigger ──────────────────────────────────────────────
  const handleRunMaintenance = async () => {
    if (!confirm('Run 7-day storage retention maintenance now?\n\nThis will safely archive completed weeks into permanent summaries and clean up completed records older than 7 days. Pending OUT vehicles will remain strictly protected.')) {
      return;
    }

    setIsMaintenanceRunning(true);
    setMaintenanceMessage(null);
    try {
      const res = await fetch('/api/reports/maintenance', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.result) {
        const { archivedWeeksCount, deletedCount, protectedPendingCount } = data.result;
        setMaintenanceMessage({
          type: 'success',
          text: `Maintenance successful! Archived ${archivedWeeksCount || 0} weeks, safely deleted ${deletedCount || 0} expired records (>7 days). ${protectedPendingCount || 0} pending OUT records protected.`
        });
        fetchReportMetadata();
        if (onRefresh) onRefresh();
      } else {
        setMaintenanceMessage({
          type: 'error',
          text: `Maintenance completed: ${data.result?.message || 'No action needed.'}`
        });
      }
    } catch (err) {
      setMaintenanceMessage({
        type: 'error',
        text: 'Maintenance request failed: ' + err.message
      });
    } finally {
      setIsMaintenanceRunning(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      
      {/* =========================================================================
          SECTION 1: DAILY REPORTS (PDF DOWNLOAD & LIVE METRICS)
          ========================================================================= */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileText className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-wide">
                DAILY REPORTS
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Select any date to view trip statistics and download executive A4 landscape audit PDF reports.
            </p>
          </div>

          {/* Date Selector & PDF Download CTA */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-inner">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={handleDownloadDailyPDF}
              disabled={isExportingPDF}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Download Daily Report (PDF)</span>
            </button>
          </div>
        </div>

        {/* 5 Executive KPI Cards for the selected date */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mt-5">
          {/* Card 1: Total Unique Vehicles */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5 transition-colors">
            <div className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Total Vehicles
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
              {dailyReport.totalUniqueVehicles}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Unique tippers on {dailyReport.displayDate}
            </div>
          </div>

          {/* Card 2: Total Number of Trips */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5 transition-colors">
            <div className="text-[11px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
              Total Trips
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {dailyReport.totalTrips}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Gate movements recorded
            </div>
          </div>

          {/* Card 3: Total IN Entries */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5 transition-colors">
            <div className="text-[11px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
              Total IN Entries
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {dailyReport.totalIn}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Vehicles checked IN
            </div>
          </div>

          {/* Card 4: Total OUT Entries */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5 transition-colors">
            <div className="text-[11px] font-bold tracking-wider uppercase text-sky-600 dark:text-sky-400">
              Total OUT Entries
            </div>
            <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 mt-1">
              {dailyReport.totalOut}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Completed exit cycles
            </div>
          </div>

          {/* Card 5: Pending OUT */}
          <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5 transition-colors">
            <div className="text-[11px] font-bold tracking-wider uppercase text-rose-600 dark:text-rose-400">
              Pending OUT
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {dailyReport.pendingOut}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Currently inside facility
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: DATE-WISE REPORT HISTORY & TRIP-WISE VEHICLE COUNT
          ========================================================================= */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <History className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-wide">
                DATE-WISE REPORT HISTORY
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Explore past daily records, distinct trip distributions, and trip-by-trip audit ledger.
            </p>
          </div>

          {/* Navigation Controls: Prev / Current Display / Next */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevDay}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev Day</span>
            </button>

            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
              {dailyReport.displayDate}
            </span>

            <button
              onClick={handleNextDay}
              disabled={selectedDate >= todayIST}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next Day"
            >
              <span className="hidden sm:inline">Next Day</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Date Pills: Available Historical Dates */}
        {availableDates.length > 0 && (
          <div className="mt-4 flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0">Available:</span>
            {availableDates.slice(0, 8).map(dStr => (
              <button
                key={dStr}
                onClick={() => setSelectedDate(dStr)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition shrink-0 ${
                  selectedDate === dStr
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-700/60'
                }`}
              >
                {formatISTDisplayDate(dStr)}
              </button>
            ))}
          </div>
        )}

        {/* ── Sub-section 2.1: Trip-Wise Vehicle Count Category Table ── */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>Trip-Wise Vehicle Count (Distinct Vehicles)</span>
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              Each vehicle counted only once in its final category
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* 1st Trip */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 text-center">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">1st Trip</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {dailyReport.tripCategories.trips1}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Vehicles (1 trip only)</div>
            </div>

            {/* 2nd Trip */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 text-center">
              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">2nd Trip</div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {dailyReport.tripCategories.trips2}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Vehicles (2 trips only)</div>
            </div>

            {/* 3rd Trip */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 text-center">
              <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase">3rd Trip</div>
              <div className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">
                {dailyReport.tripCategories.trips3}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Vehicles (3 trips only)</div>
            </div>

            {/* 4th Trip */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 text-center">
              <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">4th Trip</div>
              <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {dailyReport.tripCategories.trips4}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Vehicles (4 trips only)</div>
            </div>

            {/* 5th Trip & Above */}
            <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 text-center">
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">5+ Trips</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {dailyReport.tripCategories.trips5Plus}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">5 or more trips</div>
            </div>
          </div>
        </div>

        {/* ── Sub-section 2.2: Detailed Vehicle-Wise Report Table ── */}
        <div className="mt-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Truck className="w-4 h-4 text-amber-500" />
                <span>Vehicle-Wise Trip Ledger ({filteredVehicleRows.length} vehicles)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailed table showing actual IN & OUT times for 1st, 2nd, 3rd, and 4th trips.
              </p>
            </div>

            {/* In-table vehicle search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search plate (e.g. 2567)..."
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Lorry Number</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-3">1st Trip</th>
                  <th className="py-2.5 px-3">2nd Trip</th>
                  <th className="py-2.5 px-3">3rd Trip</th>
                  <th className="py-2.5 px-3">4th Trip</th>
                  <th className="py-2.5 px-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                {filteredVehicleRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      No vehicle records found for {dailyReport.displayDate}.
                    </td>
                  </tr>
                ) : (
                  filteredVehicleRows.map((row, idx) => (
                    <tr 
                      key={row.compact}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Lorry Number */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span>{row.plate_number}</span>
                          {row.total_trips >= 2 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              {row.total_trips} Trips
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Remarks */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={row.remarks}>
                        {row.remarks || '-'}
                      </td>

                      {/* 1st Trip */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.trips[0] ? (
                          <span className="flex items-center space-x-1">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{row.trips[0].inTime}</span>
                            <span className="text-slate-400">→</span>
                            <span className={row.trips[0].outTime === 'Pending' ? 'text-rose-500 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                              {row.trips[0].outTime}
                            </span>
                          </span>
                        ) : '-'}
                      </td>

                      {/* 2nd Trip */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.trips[1] ? (
                          <span className="flex items-center space-x-1">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{row.trips[1].inTime}</span>
                            <span className="text-slate-400">→</span>
                            <span className={row.trips[1].outTime === 'Pending' ? 'text-rose-500 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                              {row.trips[1].outTime}
                            </span>
                          </span>
                        ) : '-'}
                      </td>

                      {/* 3rd Trip */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.trips[2] ? (
                          <span className="flex items-center space-x-1">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{row.trips[2].inTime}</span>
                            <span className="text-slate-400">→</span>
                            <span className={row.trips[2].outTime === 'Pending' ? 'text-rose-500 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                              {row.trips[2].outTime}
                            </span>
                          </span>
                        ) : '-'}
                      </td>

                      {/* 4th Trip */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.trips[3] ? (
                          <span className="flex items-center space-x-1">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{row.trips[3].inTime}</span>
                            <span className="text-slate-400">→</span>
                            <span className={row.trips[3].outTime === 'Pending' ? 'text-rose-500 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                              {row.trips[3].outTime}
                            </span>
                          </span>
                        ) : '-'}
                      </td>

                      {/* Total Trips */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px]">
                          {row.total_trips}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: WEEKLY REPORTS (PDF DOWNLOAD & 7-DAY BREAKDOWN)
          ========================================================================= */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-wide">
                WEEKLY REPORTS
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Consolidated 7-day reports, daily trends, weekly trip distribution, and complete vehicle summaries.
            </p>
          </div>

          {/* Week Selector Dropdown & Download Button */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedWeekId}
              onChange={(e) => setSelectedWeekId(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="current">Current Week (Mon - Sun)</option>
              {savedWeeklySummaries.map(w => (
                <option key={w.week_id} value={w.week_id}>
                  {w.display_start || w.week_start} to {w.display_end || w.week_end} ({w.total_trips} trips)
                </option>
              ))}
            </select>

            <button
              onClick={handleDownloadWeeklyPDF}
              disabled={isExportingPDF}
              className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Download Weekly Report (PDF)</span>
            </button>
          </div>
        </div>

        {/* Weekly Header Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-5">
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Week Range</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              {activeWeeklyReport.displayStart} — {activeWeeklyReport.displayEnd}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">7-Day Audited Period</div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Unique Vehicles</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {activeWeeklyReport.totalUniqueVehicles}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Distinct lorries active this week</div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">Total Weekly Trips</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {activeWeeklyReport.totalTrips}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Total movements completed</div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Multi-Trip Vehicles</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {activeWeeklyReport.vehicleSummaries.filter(v => v.total_trips >= 2).length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Vehicles with 2+ trips this week</div>
          </div>
        </div>

        {/* 7-Day Daily Breakdown Table */}
        <div className="mt-6">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <span>7-Day Daily Movement Breakdown</span>
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Date (IST)</th>
                  <th className="py-2.5 px-3">Day</th>
                  <th className="py-2.5 px-3 text-center">Unique Vehicles</th>
                  <th className="py-2.5 px-3 text-center">Total Trips</th>
                  <th className="py-2.5 px-3 text-center">IN</th>
                  <th className="py-2.5 px-3 text-center">OUT</th>
                  <th className="py-2.5 px-3 text-center">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900 font-mono">
                {activeWeeklyReport.dailyBreakdown.map(day => (
                  <tr key={day.date} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      {day.displayDate}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-500 dark:text-slate-400 font-sans">
                      {day.dayName}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                      {day.uniqueVehicles}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-600 dark:text-amber-400">
                      {day.totalTrips}
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                      {day.totalIn}
                    </td>
                    <td className="py-2.5 px-3 text-center text-sky-600 dark:text-sky-400 font-bold">
                      {day.totalOut}
                    </td>
                    <td className={`py-2.5 px-3 text-center font-bold ${day.pendingOut > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                      {day.pendingOut}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: WEEKLY DATA STORAGE STATUS & AUTOMATIC RETENTION
          ========================================================================= */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Database className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-wide">
                WEEKLY DATA STORAGE STATUS
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Automated 7-day retention management running on MongoDB Atlas cloud database.
            </p>
          </div>

          <button
            onClick={handleRunMaintenance}
            disabled={isMaintenanceRunning}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isMaintenanceRunning ? 'animate-spin' : ''}`} />
            <span>{isMaintenanceRunning ? 'Running Maintenance...' : 'Run Storage Maintenance Now'}</span>
          </button>
        </div>

        {/* Maintenance Message Banner */}
        {maintenanceMessage && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
            maintenanceMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{maintenanceMessage.text}</span>
          </div>
        )}

        {/* Storage Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-5">
          {/* Metric 1: Total Movements in DB */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Live Records in DB</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {storageStatus ? storageStatus.totalMovements : movements.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Movements in MongoDB</div>
          </div>

          {/* Metric 2: Protected Pending OUT */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-emerald-500/30 dark:border-emerald-500/30 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Protected Pending OUT</span>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {storageStatus ? storageStatus.pendingOutCount : 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">NEVER deleted by retention</div>
          </div>

          {/* Metric 3: Permanent Weekly Archives */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Weekly Summaries</div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {storageStatus ? storageStatus.archivedWeeksCount : savedWeeklySummaries.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Preserved permanently</div>
          </div>

          {/* Metric 4: Retention Policy */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase">Retention Policy</div>
            <div className="text-sm font-black text-sky-600 dark:text-sky-400 mt-1 flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>7-Day Cycle (IST)</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Auto-archival + cleanup</div>
          </div>
        </div>

        {/* Detailed Safety Rules and System Info Box */}
        <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400">
          <div className="font-bold text-slate-900 dark:text-slate-200 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Strict Retention & Deletion Safety Rules:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li><strong className="text-slate-800 dark:text-slate-300">Pending OUT Protection:</strong> Any vehicle currently inside the gate is protected indefinitely and is never deleted.</li>
            <li><strong className="text-slate-800 dark:text-slate-300">Summary Before Deletion:</strong> 7-day expired records are only recycled after the corresponding weekly summary report is successfully saved in the cloud database.</li>
            <li><strong className="text-slate-800 dark:text-slate-300">Permanent Historical Access:</strong> Archived weekly reports and summaries remain permanently accessible for admin download anytime.</li>
            <li><strong className="text-slate-800 dark:text-slate-300">Server-Side Scheduled Engine:</strong> Background maintenance executes automatically every hour on the server without relying on browser timers.</li>
          </ul>
        </div>
      </section>

    </div>
  );
};
