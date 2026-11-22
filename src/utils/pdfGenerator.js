import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatISTDateTime, formatISTDisplayDate } from './reportCalculator';

/**
 * Generate and download a professional A4 Daily Report PDF
 */
export function generateDailyReportPDF(dailyReport) {
  const {
    date,
    displayDate,
    totalUniqueVehicles,
    totalTrips,
    totalIn,
    totalOut,
    pendingOut,
    tripCategories,
    vehicleWiseRows
  } = dailyReport;

  // A4 Landscape: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Top Header Banner (Corporate Slate with Emerald Accent) ──
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Emerald Accent Stripe
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 28, pageWidth, 2, 'F');

  // App Logo & Brand Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('FLEET GATE', 14, 13);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text('HEAVY TIPPER GATE · DAILY AUDIT REPORT', 14, 20);

  // Right-aligned Metadata (Date & Generation Time in IST)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`REPORT DATE: ${displayDate || date}`, pageWidth - 14, 13, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  const genTimestamp = formatISTDateTime(new Date());
  doc.text(`Generated (IST): ${genTimestamp}`, pageWidth - 14, 20, { align: 'right' });

  // ── Section 1: Executive KPI Metrics (5 Cards in 1 Row) ──
  const kpiY = 35;
  const cardWidth = (pageWidth - 28 - (4 * 4)) / 5; // 5 cards with 4mm gap
  const cardHeight = 16;

  const kpis = [
    { label: 'TOTAL VEHICLES', value: `${totalUniqueVehicles}`, color: [15, 23, 42], textCol: [30, 41, 59] },
    { label: 'TOTAL TRIPS', value: `${totalTrips}`, color: [245, 158, 11], textCol: [180, 83, 9] },
    { label: 'TOTAL IN ENTRIES', value: `${totalIn}`, color: [16, 185, 129], textCol: [4, 120, 87] },
    { label: 'TOTAL OUT ENTRIES', value: `${totalOut}`, color: [14, 165, 233], textCol: [3, 105, 161] },
    { label: 'PENDING OUT', value: `${pendingOut}`, color: pendingOut > 0 ? [244, 63, 94] : [100, 116, 139], textCol: pendingOut > 0 ? [190, 18, 60] : [71, 85, 105] }
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardWidth + 4);
    // Card background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, kpiY, cardWidth, cardHeight, 2, 2, 'FD');

    // Colored top line accent
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(x + 2, kpiY, cardWidth - 4, 1, 'F');

    // Label
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + cardWidth / 2, kpiY + 5.5, { align: 'center' });

    // Value
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.textCol[0], kpi.textCol[1], kpi.textCol[2]);
    doc.text(kpi.value, x + cardWidth / 2, kpiY + 12.5, { align: 'center' });
  });

  // ── Section 2: Trip-Wise Vehicle Count Category Table ──
  const categoryY = kpiY + cardHeight + 4;

  const pct = (val) => totalUniqueVehicles > 0 ? `${Math.round((val / totalUniqueVehicles) * 100)}%` : '0%';

  const categoryTableData = [
    [
      '1st Trip (Single Visit)',
      `${tripCategories.trips1} vehicles`,
      pct(tripCategories.trips1),
      'Vehicles that completed exactly 1 trip today'
    ],
    [
      '2nd Trip (Double Visit)',
      `${tripCategories.trips2} vehicles`,
      pct(tripCategories.trips2),
      'Vehicles that completed exactly 2 trips today'
    ],
    [
      '3rd Trip (Triple Visit)',
      `${tripCategories.trips3} vehicles`,
      pct(tripCategories.trips3),
      'Vehicles that completed exactly 3 trips today'
    ],
    [
      '4th Trip (Quad Visit)',
      `${tripCategories.trips4} vehicles`,
      pct(tripCategories.trips4),
      'Vehicles that completed exactly 4 trips today'
    ],
    [
      '5th Trip & Above (Frequent)',
      `${tripCategories.trips5Plus} vehicles`,
      pct(tripCategories.trips5Plus),
      'Vehicles that completed 5 or more trips today'
    ]
  ];

  autoTable(doc, {
    startY: categoryY,
    head: [['Trip Category (Distinct Count)', 'Vehicle Count', '% of Fleet', 'Category Description']],
    body: categoryTableData,
    theme: 'grid',
    margin: { left: 14, right: 14 },
    tableWidth: pageWidth - 28,
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 1.5
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 1.2
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 35, fontStyle: 'bold', halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { fontStyle: 'normal', textColor: [100, 116, 139] }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // ── Section 3: Detailed Vehicle-Wise Report Table ──
  const ledgerY = doc.lastAutoTable.finalY + 4;

  const ledgerRows = (vehicleWiseRows || []).map((v, i) => [
    `${i + 1}`,
    v.plate_number,
    v.remarks || '-',
    v.trip1 !== '-' ? v.trip1 : '-',
    v.trip2 !== '-' ? v.trip2 : '-',
    v.trip3 !== '-' ? v.trip3 : '-',
    v.trip4 !== '-' ? v.trip4 : (v.has5Plus ? '5+ Trips' : '-'),
    `${v.total_trips} ${v.total_trips === 1 ? 'Trip' : 'Trips'}`
  ]);

  autoTable(doc, {
    startY: ledgerY,
    head: [['#', 'Lorry Number', 'Remarks', '1st Trip', '2nd Trip', '3rd Trip', '4th Trip', 'Total Trips']],
    body: ledgerRows.length > 0 ? ledgerRows : [['-', 'No Records', '-', '-', '-', '-', '-', '0']],
    theme: 'striped',
    margin: { left: 14, right: 14, bottom: 15 },
    tableWidth: pageWidth - 28,
    headStyles: {
      fillColor: [16, 185, 129], // emerald-600
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 1.8
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [15, 23, 42],
      cellPadding: 1.5
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 36, fontStyle: 'bold', textColor: [4, 120, 87] }, // emerald bold plate
      2: { cellWidth: 35 },
      3: { cellWidth: 46 },
      4: { cellWidth: 46 },
      5: { cellWidth: 46 },
      6: { cellWidth: 32 },
      7: { cellWidth: 20, fontStyle: 'bold', halign: 'center', textColor: [180, 83, 9] }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      // Footer on every page
      const current = doc.internal.getCurrentPageInfo().pageNumber;
      const totalPages = doc.internal.getNumberOfPages();

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `FleetGate Official Gate Audit Report · Verified from MongoDB Atlas (IST) · Page ${current} of ${totalPages}`,
        14,
        pageHeight - 6
      );

      doc.setFont('helvetica', 'bold');
      doc.text(
        'Authorized Gate Supervisor Signature: _______________________',
        pageWidth - 14,
        pageHeight - 6,
        { align: 'right' }
      );
    }
  });

  // Save / Trigger Download
  const filename = `FLEET_GATE_Daily_Report_${date}.pdf`;
  doc.save(filename);
}

/**
 * Generate and download a professional A4 Weekly Report PDF
 */
export function generateWeeklyReportPDF(weeklyReport) {
  const {
    weekStart,
    weekEnd,
    displayStart,
    displayEnd,
    totalUniqueVehicles,
    totalTrips,
    dailyBreakdown,
    tripCategories,
    vehicleSummaries
  } = weeklyReport;

  // A4 Landscape
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Top Header Banner ──
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Amber Accent Stripe for Weekly Reports
  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(0, 28, pageWidth, 2, 'F');

  // App Logo & Brand Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('FLEET GATE', 14, 13);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text('HEAVY TIPPER GATE · 7-DAY WEEKLY CONSOLIDATED REPORT', 14, 20);

  // Right-aligned Metadata (Week Range)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`WEEK: ${displayStart} – ${displayEnd}`, pageWidth - 14, 13, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  const genTimestamp = formatISTDateTime(new Date());
  doc.text(`Generated (IST): ${genTimestamp}`, pageWidth - 14, 20, { align: 'right' });

  // ── Section 1: Executive KPI Metrics ──
  const kpiY = 35;
  const cardWidth = (pageWidth - 28 - (3 * 4)) / 4;
  const cardHeight = 16;

  const avgTripsPerDay = totalTrips > 0 ? (totalTrips / 7).toFixed(1) : '0';
  const avgVehiclesPerDay = dailyBreakdown.length > 0 
    ? (dailyBreakdown.reduce((sum, d) => sum + d.uniqueVehicles, 0) / 7).toFixed(1) 
    : '0';

  const kpis = [
    { label: 'TOTAL UNIQUE VEHICLES (WEEK)', value: `${totalUniqueVehicles}`, textCol: [30, 41, 59] },
    { label: 'TOTAL MOVEMENTS / TRIPS', value: `${totalTrips}`, textCol: [180, 83, 9] },
    { label: 'DAILY AVERAGE TRIPS', value: `${avgTripsPerDay} trips/day`, textCol: [4, 120, 87] },
    { label: 'DAILY AVERAGE ACTIVE LORRIES', value: `${avgVehiclesPerDay} lorries/day`, textCol: [3, 105, 161] }
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, kpiY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFillColor(245, 158, 11);
    doc.rect(x + 2, kpiY, cardWidth - 4, 1, 'F');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + cardWidth / 2, kpiY + 5.5, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.textCol[0], kpi.textCol[1], kpi.textCol[2]);
    doc.text(kpi.value, x + cardWidth / 2, kpiY + 12.5, { align: 'center' });
  });

  // ── Section 2: 7-Day Daily Breakdown Table ──
  const dailyY = kpiY + cardHeight + 4;

  const dailyRows = (dailyBreakdown || []).map(d => [
    `${d.dayName}, ${d.displayDate}`,
    `${d.uniqueVehicles}`,
    `${d.totalTrips}`,
    `${d.totalIn}`,
    `${d.totalOut}`,
    `${d.pendingOut}`,
    `${d.tripCategories.trips1}`,
    `${d.tripCategories.trips2}`,
    `${d.tripCategories.trips3}`,
    `${d.tripCategories.trips4}`,
    `${d.tripCategories.trips5Plus}`
  ]);

  autoTable(doc, {
    startY: dailyY,
    head: [['Date (IST)', 'Vehicles', 'Total Trips', 'IN', 'OUT', 'Pending', '1st Trip', '2nd Trip', '3rd Trip', '4th Trip', '5th+ Trip']],
    body: dailyRows,
    theme: 'grid',
    margin: { left: 14, right: 14 },
    tableWidth: pageWidth - 28,
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.5
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [30, 41, 59],
      halign: 'center',
      cellPadding: 1.2
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', halign: 'left' },
      1: { cellWidth: 22, fontStyle: 'bold' },
      2: { cellWidth: 24, fontStyle: 'bold', textColor: [180, 83, 9] }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // ── Section 3: Vehicle-Wise Weekly Trip Summary Table ──
  const vehicleSummaryY = doc.lastAutoTable.finalY + 4;

  // Columns: #, Lorry Number, Day 1, Day 2, Day 3, Day 4, Day 5, Day 6, Day 7, Total Trips
  const dateKeys = dailyBreakdown.map(d => d.date);
  const dayHeaders = dailyBreakdown.map(d => `${d.dayName} (${d.date.slice(5)})`);

  const vehicleRows = (vehicleSummaries || []).map((v, i) => {
    const dayCounts = dateKeys.map(k => v.day_counts[k] ? `${v.day_counts[k]}` : '-');
    return [
      `${i + 1}`,
      v.plate_number,
      ...dayCounts,
      `${v.total_trips} ${v.total_trips === 1 ? 'Trip' : 'Trips'}`
    ];
  });

  autoTable(doc, {
    startY: vehicleSummaryY,
    head: [['#', 'Lorry Number', ...dayHeaders, 'Total Weekly Trips']],
    body: vehicleRows.length > 0 ? vehicleRows : [['-', 'No Records', '-', '-', '-', '-', '-', '-', '-', '0']],
    theme: 'striped',
    margin: { left: 14, right: 14, bottom: 15 },
    tableWidth: pageWidth - 28,
    headStyles: {
      fillColor: [245, 158, 11], // amber-500
      textColor: [15, 23, 42],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.6
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [15, 23, 42],
      halign: 'center',
      cellPadding: 1.3
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 40, fontStyle: 'bold', halign: 'left', textColor: [4, 120, 87] },
      9: { fontStyle: 'bold', halign: 'center', textColor: [180, 83, 9] }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      const current = doc.internal.getCurrentPageInfo().pageNumber;
      const totalPages = doc.internal.getNumberOfPages();

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `FleetGate Weekly Consolidated Report · Verified from MongoDB Atlas (IST) · Page ${current} of ${totalPages}`,
        14,
        pageHeight - 6
      );

      doc.setFont('helvetica', 'bold');
      doc.text(
        'Authorized Gate Supervisor Signature: _______________________',
        pageWidth - 14,
        pageHeight - 6,
        { align: 'right' }
      );
    }
  });

  // Save / Trigger Download
  const filename = `FLEET_GATE_Weekly_Report_${weekStart}_to_${weekEnd}.pdf`;
  doc.save(filename);
}
