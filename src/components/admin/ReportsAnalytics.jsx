import React from 'react';
import { useLorryData } from '../../context/LorryDataContext';
import { 
  BarChart3, 
  Download, 
  TrendingUp, 
  Building,
  CheckCircle2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const ReportsAnalytics = () => {
  const { movements, lorries, stats } = useLorryData();

  const transporterCounts = {};
  movements.forEach(m => {
    const t = m.transporter_name || 'Direct / Independent';
    transporterCounts[t] = (transporterCounts[t] || 0) + 1;
  });

  const sortedTransporters = Object.entries(transporterCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const purposeCounts = {};
  movements.forEach(m => {
    const p = m.purpose || 'Other';
    purposeCounts[p] = (purposeCounts[p] || 0) + 1;
  });

  const handleGeneratePDF = () => {
    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FLEET GATE', 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 197, 94);
    doc.text('OFFICIAL GATE AUDIT & MOVEMENT REPORT', 14, 25);

    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 14, 32);
    doc.text(`Total Records: ${movements.length}`, 150, 32);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Gate Performance Indicators', 14, 48);

    const metricsData = [
      ['Currently Inside Premises', `${stats.inside_now} lorries`],
      ['Total Inbound Today', `${stats.today_in} arrivals`],
      ['Total Completed Visits Today', `${stats.today_out} exits`],
      ['Average Turnaround Duration', `${Math.floor(stats.avg_duration_minutes / 60)}h ${stats.avg_duration_minutes % 60}m`],
      ['Total Fleet Lorries Registered', `${lorries.length} lorries`]
    ];

    autoTable(doc, {
      startY: 52,
      head: [['KPI Metric', 'Current Value']],
      body: metricsData,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 9 }
    });

    const lastY = doc.lastAutoTable.finalY || 100;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Recent Vehicle Movements Ledger', 14, lastY + 12);

    const tableRows = movements.slice(0, 25).map(m => [
      m.plate_number,
      m.transporter_name || 'Direct',
      m.driver_name,
      m.status,
      format(new Date(m.entry_time), 'MM-dd HH:mm'),
      m.exit_time ? format(new Date(m.exit_time), 'MM-dd HH:mm') : 'INSIDE',
      m.duration_minutes ? `${m.duration_minutes}m` : '-',
      `#${m.visit_number}`
    ]);

    autoTable(doc, {
      startY: lastY + 16,
      head: [['Plate', 'Transporter', 'Driver', 'Status', 'Entry', 'Exit', 'Duration', 'Visit']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`LorryTrackPro_Gate_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-100 flex items-center">
              <BarChart3 className="w-6 h-6 mr-2 text-amber-400" />
              Reports & Gate Analytics
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Admin Exclusive
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Analyze turnaround times, vehicle traffic flow, and generate PDF audit summaries.
          </p>
        </div>

        <button
          onClick={handleGeneratePDF}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-950/40 transition self-start md:self-auto"
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          <span>DOWNLOAD PDF REPORT</span>
        </button>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Top Transporters */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-slate-200 flex items-center mb-4">
            <Building className="w-4 h-4 mr-2 text-emerald-400" />
            Top Transporters / Logistics Fleets
          </h3>

          <div className="space-y-3">
            {sortedTransporters.map(([name, count]) => {
              const pct = Math.round((count / (movements.length || 1)) * 100);
              return (
                <div key={name} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">{name}</span>
                    <span className="text-slate-400 font-mono">{count} trips ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full transition-all" 
                      style={{ width: `${Math.max(5, pct)}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Movement Purpose Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-slate-200 flex items-center mb-4">
            <TrendingUp className="w-4 h-4 mr-2 text-sky-400" />
            Movement Purpose Breakdown
          </h3>

          <div className="space-y-3">
            {Object.entries(purposeCounts).map(([purpose, count]) => {
              const pct = Math.round((count / (movements.length || 1)) * 100);
              return (
                <div key={purpose} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">{purpose}</span>
                    <span className="text-slate-400 font-mono">{count} vehicles ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div 
                      className="bg-sky-500 h-2 rounded-full transition-all" 
                      style={{ width: `${Math.max(5, pct)}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-xs text-slate-300 space-y-3">
        <h4 className="font-bold text-slate-200 text-sm flex items-center">
          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
          Audit & Compliance Integrity
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-slate-400">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-200 font-semibold block mb-0.5">Dual-Pass Security</span>
            <p>Every lorry must be verified upon IN arrival and explicitly checked upon OUT exit.</p>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-200 font-semibold block mb-0.5">Visit Counter Formula</span>
            <p>1 completed cycle (IN → OUT) increments the vehicle's permanent visit log by 1.</p>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-200 font-semibold block mb-0.5">RLS Protected</span>
            <p>Staff cannot alter or wipe historical audit logs; all entries are immutable by default.</p>
          </div>
        </div>
      </div>

    </div>
  );
};
