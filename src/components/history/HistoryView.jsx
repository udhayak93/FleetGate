import React, { useState } from 'react';
import { useLorryData } from '../../context/LorryDataContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Clock, 
  Search, 
  Trash2, 
  Building, 
  FileSpreadsheet, 
  ArrowDownRight, 
  ArrowUpRight,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';

export const HistoryView = () => {
  const { movements, deleteMovement } = useLorryData();
  const { isAdmin } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');

  const filtered = movements.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const match = (
        m.plate_number.toLowerCase().includes(q) ||
        m.driver_name.toLowerCase().includes(q) ||
        (m.transporter_name && m.transporter_name.toLowerCase().includes(q)) ||
        (m.cargo_details && m.cargo_details.toLowerCase().includes(q))
      );
      if (!match) return false;
    }

    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;

    if (dateFilter !== 'ALL') {
      const entryTime = new Date(m.entry_time).getTime();
      const now = Date.now();
      if (dateFilter === 'TODAY' && (now - entryTime > 86400000)) return false;
      if (dateFilter === 'WEEK' && (now - entryTime > 7 * 86400000)) return false;
    }

    return true;
  });

  const handleExportCSV = () => {
    const headers = [
      'Movement ID',
      'Plate Number',
      'Status',
      'Transporter',
      'Driver Name',
      'Driver Phone',
      'Cargo Details',
      'Purpose',
      'Entry Time',
      'Entry Gate',
      'Entry Recorded By',
      'Exit Time',
      'Exit Gate',
      'Exit Recorded By',
      'Duration (Minutes)',
      'Visit Number'
    ];

    const rows = filtered.map(m => [
      `"${m.id}"`,
      `"${m.plate_number}"`,
      `"${m.status}"`,
      `"${m.transporter_name || ''}"`,
      `"${m.driver_name}"`,
      `"${m.driver_phone || ''}"`,
      `"${m.cargo_details || ''}"`,
      `"${m.purpose}"`,
      `"${format(new Date(m.entry_time), 'yyyy-MM-dd HH:mm:ss')}"`,
      `"${m.entry_gate}"`,
      `"${m.entry_recorded_by_name || ''}"`,
      m.exit_time ? `"${format(new Date(m.exit_time), 'yyyy-MM-dd HH:mm:ss')}"` : '""',
      `"${m.exit_gate || ''}"`,
      `"${m.exit_recorded_by_name || ''}"`,
      m.duration_minutes || '',
      m.visit_number
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LorryTrackPro_Logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id, plate) => {
    if (!isAdmin) return;
    if (confirm(`Admin Action: Are you sure you want to delete movement record for ${plate}?`)) {
      await deleteMovement(id);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      
      {/* View Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-100 flex items-center">
              <Clock className="w-6 h-6 mr-2 text-emerald-400" />
              Movement Logs & History
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {filtered.length} Records
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete audit trail of all vehicle entries and completed exit cycles with timestamps.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition self-start md:self-auto"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search plate, driver, transporter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('IN')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'IN' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Inside (IN)
          </button>
          <button
            onClick={() => setStatusFilter('OUT')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'OUT' ? 'bg-sky-500/20 text-sky-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Exited (OUT)
          </button>
        </div>

        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setDateFilter('ALL')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
              dateFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setDateFilter('TODAY')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
              dateFilter === 'TODAY' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('WEEK')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
              dateFilter === 'WEEK' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            7 Days
          </button>
        </div>
      </div>

      {/* Movement List */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No records match your filters</h3>
          <p className="text-xs text-slate-500 mt-1">Try clearing or broadening your search criteria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((mov) => {
            const entryDate = new Date(mov.entry_time);
            const exitDate = mov.exit_time ? new Date(mov.exit_time) : null;
            const isInside = mov.status === 'IN' && mov.is_active_inside;

            return (
              <div
                key={mov.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-slate-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-base font-extrabold text-slate-100 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      {mov.plate_number}
                    </span>
                    
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                      isInside 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                    }`}>
                      {isInside ? 'ACTIVE INSIDE' : 'VISIT COMPLETED'}
                    </span>

                    <span className="text-xs text-slate-400 font-mono">
                      Visit #{mov.visit_number}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-slate-400">
                    <span className="flex items-center">
                      <Building className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      {mov.transporter_name || 'Direct'}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-slate-300">
                      {mov.purpose}
                    </span>

                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(mov.id, mov.plate_number)}
                        title="Delete record (Admin only)"
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-500 flex items-center font-semibold">
                      <ArrowDownRight className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      ENTRY TIME & GATE:
                    </span>
                    <p className="text-slate-200 font-medium">
                      {format(entryDate, 'MMM dd, yyyy • hh:mm a')}
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      {mov.entry_gate} {mov.entry_recorded_by_name ? `(By: ${mov.entry_recorded_by_name})` : ''}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 flex items-center font-semibold">
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-sky-400" />
                      EXIT TIME & DURATION:
                    </span>
                    {exitDate ? (
                      <>
                        <p className="text-slate-200 font-medium">
                          {format(exitDate, 'MMM dd, yyyy • hh:mm a')}
                        </p>
                        <p className="text-sky-400 text-[11px] font-mono">
                          Duration: {mov.duration_minutes ? `${Math.floor(mov.duration_minutes / 60)}h ${mov.duration_minutes % 60}m` : 'Completed'}
                        </p>
                      </>
                    ) : (
                      <p className="text-emerald-400 font-medium">
                        Still on premises (Inside)
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 font-semibold">DRIVER & CONTACT:</span>
                    <p className="text-slate-200 font-medium">{mov.driver_name}</p>
                    {mov.driver_phone && (
                      <p className="text-slate-400 text-[11px]">{mov.driver_phone}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 font-semibold">CARGO & NOTES:</span>
                    <p className="text-slate-300 truncate" title={mov.cargo_details || 'N/A'}>
                      {mov.cargo_details || 'No cargo details entered'}
                    </p>
                    {(mov.entry_notes || mov.exit_notes) && (
                      <p className="text-[11px] text-slate-400 italic truncate" title={`${mov.entry_notes || ''} ${mov.exit_notes || ''}`}>
                        {mov.exit_notes || mov.entry_notes}
                      </p>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
