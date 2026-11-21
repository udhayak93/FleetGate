import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLorryData } from '../../context/LorryDataContext';
import { format, isToday } from 'date-fns';
import { formatLorryNumber, getTripLabel } from '../../utils/vehicleFormatter';
import { TipperTruckIcon } from '../common/TipperTruckIcon';
import { AllAccessQRModal } from '../common/AllAccessQRModal';
import { 
  Users, 
  Trash2, 
  Edit3, 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Shield, 
  LogOut, 
  Eye, 
  RotateCcw,
  QrCode,
  RefreshCw,
  X
} from 'lucide-react';

export const AdminDashboard = ({ onOpenStaffView }) => {
  const { profile, logout, allStaff, createStaffAccount, updateStaffAccount, deleteStaffAccount } = useAuth();
  const { 
    movements, 
    lorries, 
    updateMovement, 
    deleteMovement, 
    clearDailyData, 
    resetAllRecords,
    isSyncing,
    syncStatus,
    refreshData
  } = useLorryData();

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'staff'

  // Modal States
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null);
  const [deletingMovementId, setDeletingMovementId] = useState(null);
  const [isClearDailyModalOpen, setIsClearDailyModalOpen] = useState(false);
  const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deletingStaffId, setDeletingStaffId] = useState(null);

  // Form States for Staff Add/Edit
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'staff',
    isActive: true
  });
  const [staffFormError, setStaffFormError] = useState(null);

  // Movement Edit Form State
  const [movementForm, setMovementForm] = useState({
    plate_number: '',
    vehicle_type: '12 Wheel',
    remarks: '',
    exit_remarks: '',
    entry_time: '',
    exit_time: '',
    status: 'IN'
  });

  // Calculate Overall Counts for Dashboard
  const dashboardStats = useMemo(() => {
    // 1. Total Number of Distinct Vehicles tracked
    const uniqueVehiclesSet = new Set();
    lorries.forEach(l => {
      const compact = (l.plate_number || '').toUpperCase().replace(/\s+/g, '');
      if (compact) uniqueVehiclesSet.add(compact);
    });
    movements.forEach(m => {
      const compact = (m.plate_number || '').toUpperCase().replace(/\s+/g, '');
      if (compact) uniqueVehiclesSet.add(compact);
    });
    const totalVehiclesCount = uniqueVehiclesSet.size;

    // 2. Today's Movements
    const todayMovs = movements.filter(m => {
      try {
        return isToday(new Date(m.entry_time));
      } catch {
        return false;
      }
    });

    // 3. Vehicles with 2+ Trips today
    const vehicleTripsToday = {};
    todayMovs.forEach(m => {
      const compact = (m.plate_number || '').toUpperCase().replace(/\s+/g, '');
      if (compact) {
        vehicleTripsToday[compact] = (vehicleTripsToday[compact] || 0) + 1;
      }
    });
    const multiTripVehiclesCount = Object.values(vehicleTripsToday).filter(c => c >= 2).length;

    // 4. Vehicles Inside Right Now
    const insideNowCount = movements.filter(m => m.is_active_inside && m.status === 'IN').length;

    return {
      totalVehiclesCount,
      todayTripsCount: todayMovs.length,
      multiTripVehiclesCount,
      insideNowCount
    };
  }, [lorries, movements]);

  // Open Edit Movement Modal
  const handleStartEditMovement = (mov) => {
    setEditingMovement(mov);
    setMovementForm({
      plate_number: mov.plate_number || '',
      vehicle_type: mov.vehicle_type || '12 Wheel',
      remarks: mov.remarks || mov.entry_notes || '',
      exit_remarks: mov.exit_remarks || mov.exit_notes || '',
      entry_time: mov.entry_time ? format(new Date(mov.entry_time), "yyyy-MM-dd'T'HH:mm") : '',
      exit_time: mov.exit_time ? format(new Date(mov.exit_time), "yyyy-MM-dd'T'HH:mm") : '',
      status: mov.status || 'IN'
    });
  };

  // Submit Edit Movement
  const handleSaveMovementEdit = async (e) => {
    e.preventDefault();
    if (!editingMovement) return;

    const formattedPlate = formatLorryNumber(movementForm.plate_number);
    await updateMovement(editingMovement.id, {
      plate_number: formattedPlate,
      vehicle_type: movementForm.vehicle_type,
      remarks: movementForm.remarks?.trim() || '',
      entry_notes: movementForm.remarks?.trim() || '',
      exit_remarks: movementForm.exit_remarks?.trim() || '',
      exit_notes: movementForm.exit_remarks?.trim() || '',
      entry_time: movementForm.entry_time ? new Date(movementForm.entry_time).toISOString() : editingMovement.entry_time,
      exit_time: movementForm.exit_time ? new Date(movementForm.exit_time).toISOString() : null,
      status: movementForm.status,
      is_active_inside: movementForm.status === 'IN'
    });

    setEditingMovement(null);
  };

  // Confirm Delete Movement
  const handleConfirmDeleteMovement = async () => {
    if (deletingMovementId) {
      await deleteMovement(deletingMovementId);
      setDeletingMovementId(null);
    }
  };

  // Confirm Clear All Daily Data
  const handleConfirmClearDailyData = async () => {
    await clearDailyData();
    setIsClearDailyModalOpen(false);
  };

  // Confirm Reset ALL Records (Master Reset)
  const handleConfirmResetAllRecords = async () => {
    await resetAllRecords();
    setIsResetAllModalOpen(false);
  };

  // Open Add Staff Modal
  const handleOpenAddStaff = () => {
    setStaffForm({
      fullName: '',
      email: '',
      password: 'StaffPass@123',
      role: 'staff',
      isActive: true
    });
    setStaffFormError(null);
    setIsAddStaffModalOpen(true);
  };

  // Open Edit Staff Modal
  const handleOpenEditStaff = (staff) => {
    setEditingStaff(staff);
    setStaffForm({
      fullName: staff.full_name || '',
      email: staff.email || '',
      password: '',
      role: staff.role || 'staff',
      isActive: staff.is_active !== undefined ? staff.is_active : true
    });
    setStaffFormError(null);
  };

  // Save Staff (Add or Edit)
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    setStaffFormError(null);

    if (!staffForm.fullName.trim() || !staffForm.email.trim()) {
      setStaffFormError('Full name and Email are required.');
      return;
    }

    if (editingStaff) {
      const res = await updateStaffAccount(editingStaff.id, {
        fullName: staffForm.fullName,
        email: staffForm.email,
        role: staffForm.role,
        isActive: staffForm.isActive
      });
      if (!res.success) {
        setStaffFormError(res.error);
        return;
      }
      setEditingStaff(null);
    } else {
      const res = await createStaffAccount({
        fullName: staffForm.fullName,
        email: staffForm.email,
        password: staffForm.password,
        role: staffForm.role
      });
      if (!res.success) {
        setStaffFormError(res.error);
        return;
      }
      setIsAddStaffModalOpen(false);
    }
  };

  // Confirm Delete Staff
  const handleConfirmDeleteStaff = async () => {
    if (deletingStaffId) {
      const res = await deleteStaffAccount(deletingStaffId);
      if (!res.success) {
        alert(res.error || 'Failed to delete staff account');
      }
      setDeletingStaffId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none pb-12">
      
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <TipperTruckIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wider text-white">
              FLEET <span className="text-emerald-400">GATE</span>
            </h1>
            <p className="text-[11px] text-amber-400 font-semibold">Admin Console</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={() => refreshData()}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition"
            title="Refresh shared database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>
          <button
            onClick={() => setIsQRModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition shadow-sm"
            title="Scan QR Code to open on phones"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">QR Access</span>
          </button>
          <button
            onClick={onOpenStaffView}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Staff Entry Screen</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Primary Tab Navigation: Dashboard & Records VS Staff Database */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-4 py-2">
        <div className="max-w-6xl mx-auto flex space-x-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === 'dashboard'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <TipperTruckIcon className="w-4 h-4" />
            <span>Dashboard & Records</span>
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === 'staff'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff Database ({allStaff.filter(s => s.role !== 'admin' && s.email !== 'admin@gmail.com').length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 space-y-5">
        
        {/* ================= TAB 1: DASHBOARD & MOVEMENT RECORDS ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            
            {/* Top Metrics Cards: TOTAL NUMBER OF VEHICLES, 2+ Trips, Inside Now, Today's Trips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              
              {/* Metric 1: Total Number of Vehicles */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                    Total Vehicles
                  </span>
                  <TipperTruckIcon className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-300">
                  {dashboardStats.totalVehiclesCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Total vehicles tracked
                </div>
              </div>

              {/* Metric 2: Vehicles on 2+ Trips Today */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                    2+ Trips Today
                  </span>
                  <span className="text-sm">🔄</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-300">
                  {dashboardStats.multiTripVehiclesCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Multi-trip vehicles
                </div>
              </div>

              {/* Metric 3: Inside Right Now */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                    Inside Now
                  </span>
                  <span className="text-sm">🟢</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                  {dashboardStats.insideNowCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Pending OUT
                </div>
              </div>

              {/* Metric 4: Total Trips Today */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                    Total Trips
                  </span>
                  <Clock className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-white">
                  {dashboardStats.todayTripsCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Today's total visits
                </div>
              </div>

            </div>

            {/* Action Bar: Title + Clear All Daily Data Button */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>Lorry Movement Records</span>
                  <span className="text-xs font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                    {movements.length} records
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Admin full control: Edit or delete records, clear today's entries, or reset all database records.
                </p>
              </div>

              {/* Action Buttons: Clear Daily Data & Separate Reset All Records Button */}
              <div className="flex items-center space-x-2 flex-wrap gap-y-2 self-start sm:self-auto">
                {/* Button 1: Clear Today's Daily Data */}
                <button
                  onClick={() => setIsClearDailyModalOpen(true)}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold transition shadow-sm"
                  title="Clear only today's records"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Clear Today's Data</span>
                </button>

                {/* Button 2: Separate Master Reset Button to delete ALL records */}
                <button
                  onClick={() => setIsResetAllModalOpen(true)}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-600 text-xs font-black shadow-md shadow-rose-950/40 transition active:scale-95"
                  title="Master reset: Permanently delete all records in the database"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>RESET ALL RECORDS</span>
                </button>
              </div>
            </div>

            {/* Movement Records Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-850 text-slate-300 border-b border-slate-800 font-bold uppercase text-[11px] sm:text-xs tracking-wider">
                      <th className="py-3 px-3 sm:px-4">Lorry Number</th>
                      <th className="py-3 px-3 sm:px-4">Remarks</th>
                      <th className="py-3 px-3 sm:px-4">Trip</th>
                      <th className="py-3 px-3 sm:px-4">IN Time</th>
                      <th className="py-3 px-3 sm:px-4">OUT Time</th>
                      <th className="py-3 px-3 sm:px-4">Status</th>
                      <th className="py-3 px-3 sm:px-4 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                          No lorry movements recorded in database.
                        </td>
                      </tr>
                    ) : (
                      movements.map((mov) => {
                        const inTimeFormatted = mov.entry_time ? format(new Date(mov.entry_time), 'dd MMM, hh:mm a') : '-';
                        const outTimeFormatted = mov.exit_time ? format(new Date(mov.exit_time), 'dd MMM, hh:mm a') : 'Pending';
                        const isPending = mov.status === 'IN' && mov.is_active_inside;
                        const tripNumber = mov.trip_number || mov.visit_number || 1;

                        return (
                          <tr key={mov.id} className="hover:bg-slate-850/50 transition">
                            {/* Plate Number */}
                            <td className="py-3 px-3 sm:px-4 font-mono font-bold text-white whitespace-nowrap">
                              {mov.plate_number}
                            </td>

                            {/* Remarks */}
                            <td className="py-3 px-3 sm:px-4 text-xs">
                              {mov.remarks || mov.entry_notes || mov.exit_remarks || mov.exit_notes ? (
                                <div className="space-y-0.5 max-w-[200px]">
                                  {(mov.remarks || mov.entry_notes) && (
                                    <span className="block truncate text-slate-200">
                                      {mov.remarks || mov.entry_notes}
                                    </span>
                                  )}
                                  {(mov.exit_remarks || mov.exit_notes) && (
                                    <span className="block truncate text-[11px] text-amber-300 font-mono">
                                      OUT: {mov.exit_remarks || mov.exit_notes}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-600 font-mono text-xs">-</span>
                              )}
                            </td>

                            {/* Trip Badge */}
                            <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                                tripNumber > 1
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}>
                                {getTripLabel(tripNumber)}
                              </span>
                            </td>

                            {/* IN Time */}
                            <td className="py-3 px-3 sm:px-4 font-mono text-emerald-400 whitespace-nowrap">
                              {inTimeFormatted}
                            </td>

                            {/* OUT Time */}
                            <td className="py-3 px-3 sm:px-4 font-mono whitespace-nowrap">
                              {isPending ? (
                                <span className="text-amber-400 font-bold">Pending</span>
                              ) : (
                                <span className="text-slate-300">{outTimeFormatted}</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isPending
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-slate-800 text-slate-300'
                              }`}>
                                {mov.status}
                              </span>
                            </td>

                            {/* Actions: Edit & Delete */}
                            <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => handleStartEditMovement(mov)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
                                  title="Edit Record"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingMovementId(mov.id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-rose-400 border border-slate-700 hover:border-rose-800 transition"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ================= TAB 2: STAFF DATABASE MANAGEMENT ================= */}
        {activeTab === 'staff' && (
          <div className="space-y-5">
            
            {/* Top Action Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <span>Staff Database Management</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Full staff control: Add new gate staff, update credentials, change roles, or delete staff records.
                </p>
              </div>

              <button
                onClick={handleOpenAddStaff}
                className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>ADD NEW STAFF</span>
              </button>
            </div>

            {/* Staff Database Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-850 text-slate-300 border-b border-slate-800 font-bold uppercase text-[11px] sm:text-xs tracking-wider">
                      <th className="py-3 px-3 sm:px-4">Staff Name</th>
                      <th className="py-3 px-3 sm:px-4">Email / Login ID</th>
                      <th className="py-3 px-3 sm:px-4">Role</th>
                      <th className="py-3 px-3 sm:px-4">Status</th>
                      <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {allStaff.filter(s => s.role !== 'admin' && s.email !== 'admin@gmail.com').length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                          No staff accounts yet. Click "Add New Staff" to add gate staff.
                        </td>
                      </tr>
                    ) : (
                      allStaff.filter(s => s.role !== 'admin' && s.email !== 'admin@gmail.com').map((staff) => {
                        const isActive = staff.is_active !== false;

                        return (
                          <tr key={staff.id} className="hover:bg-slate-850/50 transition">
                            {/* Name */}
                            <td className="py-3 px-3 sm:px-4 font-bold text-white whitespace-nowrap">
                              <span>{staff.full_name}</span>
                            </td>

                          {/* Email */}
                          <td className="py-3 px-3 sm:px-4 font-mono text-slate-300 whitespace-nowrap">
                            {staff.email}
                          </td>

                          {/* Role */}
                          <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                              staff.role === 'admin' 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {staff.role}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isActive
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Actions: Edit & Delete */}
                          <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleOpenEditStaff(staff)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
                                title="Edit Staff"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              
                              <button
                                onClick={() => setDeletingStaffId(staff.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-rose-400 border border-slate-700 hover:border-rose-800 transition"
                                title="Delete Staff"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* ================= MODAL: EDIT MOVEMENT RECORD ================= */}
      {editingMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Edit Movement Record</span>
              </h3>
              <button 
                onClick={() => setEditingMovement(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMovementEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Lorry Number
                </label>
                <input
                  type="text"
                  required
                  value={movementForm.plate_number}
                  onChange={(e) => setMovementForm({ ...movementForm, plate_number: formatLorryNumber(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  IN Remarks
                </label>
                <input
                  type="text"
                  placeholder="Optional entry remarks"
                  value={movementForm.remarks}
                  onChange={(e) => setMovementForm({ ...movementForm, remarks: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  OUT Remarks
                </label>
                <input
                  type="text"
                  placeholder="Optional exit remarks"
                  value={movementForm.exit_remarks}
                  onChange={(e) => setMovementForm({ ...movementForm, exit_remarks: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    IN Time
                  </label>
                  <input
                    type="datetime-local"
                    value={movementForm.entry_time}
                    onChange={(e) => setMovementForm({ ...movementForm, entry_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    OUT Time
                  </label>
                  <input
                    type="datetime-local"
                    value={movementForm.exit_time}
                    onChange={(e) => setMovementForm({ ...movementForm, exit_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={movementForm.status}
                  onChange={(e) => setMovementForm({ ...movementForm, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="IN">IN (Active Inside)</option>
                  <option value="OUT">OUT (Completed Visit)</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMovement(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRM DELETE MOVEMENT ================= */}
      {deletingMovementId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Delete Movement Record?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to permanently delete this lorry record? This action cannot be undone.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setDeletingMovementId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteMovement}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRM CLEAR ALL DAILY DATA ================= */}
      {isClearDailyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-950 border border-rose-500/60 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-extrabold text-white">Clear All Daily Data?</h3>
              <p className="text-xs text-rose-300">
                This will delete all of today's movements ({dashboardStats.todayTripsCount} trips) and reset the live daily gate counters for staff.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setIsClearDailyModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearDailyData}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRM RESET ALL RECORDS (MASTER RESET) ================= */}
      {isResetAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-rose-600 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-950 border border-rose-500 flex items-center justify-center text-rose-400 mx-auto shadow-inner">
              <AlertTriangle className="w-7 h-7 text-rose-500 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-white">Reset ALL Records?</h3>
              <p className="text-xs text-rose-300 leading-relaxed">
                This is a <strong>complete master reset</strong>. It will permanently delete <strong>all {movements.length} lorry movement records</strong>, clear all registered vehicle history, and reset all trip counters to zero across the database.
              </p>
              <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded-xl border border-slate-800">
                ⚠️ This action is permanent and cannot be undone.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setIsResetAllModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResetAllRecords}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg transition"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT STAFF ================= */}
      {(isAddStaffModalOpen || editingStaff) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>{editingStaff ? 'Edit Staff Account' : 'Add New Staff Account'}</span>
              </h3>
              <button 
                onClick={() => { setIsAddStaffModalOpen(false); setEditingStaff(null); }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {staffFormError && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs text-rose-300">
                {staffFormError}
              </div>
            )}

            <form onSubmit={handleSaveStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Email / Login ID
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. staff1@lorrytrackpro.local"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              {!editingStaff && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Initial Password
                  </label>
                  <input
                    type="text"
                    required
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Role
                  </label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="staff">Staff (Gate Entry)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>

                {editingStaff && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                      Account Status
                    </label>
                    <select
                      value={staffForm.isActive ? 'active' : 'inactive'}
                      onChange={(e) => setStaffForm({ ...staffForm, isActive: e.target.value === 'active' })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddStaffModalOpen(false); setEditingStaff(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow-md"
                >
                  {editingStaff ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRM DELETE STAFF ================= */}
      {deletingStaffId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Delete Staff Account?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to permanently delete this staff member? They will lose access immediately.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setDeletingStaffId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteStaff}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Delete Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Mobile / All Access QR Code Modal */}
      <AllAccessQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
      />

    </div>
  );
};
