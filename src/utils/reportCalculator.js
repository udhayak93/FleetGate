/**
 * FleetGate Report & Analytics Calculation Engine
 * Handles accurate IST (Indian Standard Time) calculations,
 * distinct trip-wise counts, vehicle grouping, and weekly summaries.
 */

/**
 * Returns YYYY-MM-DD string in Indian Standard Time (Asia/Kolkata)
 */
export function getISTDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

/**
 * Returns formatted time in IST (e.g. 10:32 AM)
 */
export function formatISTTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Returns formatted Date & Time in IST (e.g. 22 Nov 2026, 10:32 AM)
 */
export function formatISTDateTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timePart = formatISTTime(dateInput);
  return `${datePart}, ${timePart}`;
}

/**
 * Returns display date (e.g. 22 Nov 2026)
 */
export function formatISTDisplayDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Normalizes vehicle registration number for grouping
 */
export function normalizePlate(plate) {
  return String(plate || '').toUpperCase().replace(/\s+/g, '').trim();
}

/**
 * Calculate complete daily report from movements for a specific date (YYYY-MM-DD in IST)
 */
export function calculateDailyReport(movements, selectedDateStr) {
  if (!selectedDateStr) {
    selectedDateStr = getISTDateString(new Date());
  }

  // 1. Filter movements strictly for the selected date in IST
  const dayMovements = (movements || []).filter(m => {
    const entryDate = getISTDateString(m.entry_time || m.in_time || m.created_at);
    return entryDate === selectedDateStr;
  });

  // 2. Group records by unique normalized vehicle registration number
  const vehicleMap = {}; // compactPlate -> { plate_number, records: [] }

  dayMovements.forEach(m => {
    const rawPlate = m.plate_number || m.vehicle_number || '';
    const compact = normalizePlate(rawPlate);
    if (!compact) return;

    if (!vehicleMap[compact]) {
      vehicleMap[compact] = {
        compact,
        plate_number: rawPlate.trim() || compact,
        records: []
      };
    }
    vehicleMap[compact].records.push(m);
  });

  // 3. Sort each vehicle's movements chronologically & calculate trips
  const vehicleWiseRows = Object.values(vehicleMap).map(v => {
    // Sort chronological by entry_time
    v.records.sort((a, b) => {
      const timeA = new Date(a.entry_time || a.in_time || 0).getTime();
      const timeB = new Date(b.entry_time || b.in_time || 0).getTime();
      return timeA - timeB;
    });

    const totalTrips = v.records.length;

    // Collect remarks
    const remarksList = v.records
      .map(r => r.remarks || r.entry_notes || r.exit_remarks || r.exit_notes || '')
      .filter(Boolean);
    const combinedRemarks = remarksList.length > 0 ? remarksList[0] : '-';

    // Build trip slots for 1st, 2nd, 3rd, 4th, etc.
    const tripSlots = [];
    v.records.forEach((rec, idx) => {
      const inTime = formatISTTime(rec.entry_time || rec.in_time);
      const isExit = rec.exit_time || rec.out_time;
      const outTime = isExit ? formatISTTime(rec.exit_time || rec.out_time) : 'Pending';
      tripSlots.push({
        tripNumber: idx + 1,
        inTime,
        outTime,
        status: isExit ? 'OUT' : 'IN',
        remarks: rec.remarks || rec.entry_notes || ''
      });
    });

    return {
      plate_number: v.plate_number,
      compact: v.compact,
      total_trips: totalTrips,
      remarks: combinedRemarks,
      trips: tripSlots,
      trip1: tripSlots[0] ? `IN: ${tripSlots[0].inTime} | OUT: ${tripSlots[0].outTime}` : '-',
      trip2: tripSlots[1] ? `IN: ${tripSlots[1].inTime} | OUT: ${tripSlots[1].outTime}` : '-',
      trip3: tripSlots[2] ? `IN: ${tripSlots[2].inTime} | OUT: ${tripSlots[2].outTime}` : '-',
      trip4: tripSlots[3] ? `IN: ${tripSlots[3].inTime} | OUT: ${tripSlots[3].outTime}` : '-',
      has5Plus: totalTrips >= 5,
      records: v.records
    };
  });

  // Sort vehicle rows by plate number alphabetically
  vehicleWiseRows.sort((a, b) => a.plate_number.localeCompare(b.plate_number));

  // 4. Calculate STRICT distinct Trip-Wise Vehicle Counts
  // Every vehicle is counted ONLY ONCE in its final trip category
  let trips1 = 0; // exactly 1 trip
  let trips2 = 0; // exactly 2 trips
  let trips3 = 0; // exactly 3 trips
  let trips4 = 0; // exactly 4 trips
  let trips5Plus = 0; // 5 or more trips

  vehicleWiseRows.forEach(v => {
    if (v.total_trips === 1) trips1++;
    else if (v.total_trips === 2) trips2++;
    else if (v.total_trips === 3) trips3++;
    else if (v.total_trips === 4) trips4++;
    else if (v.total_trips >= 5) trips5Plus++;
  });

  const totalUniqueVehicles = vehicleWiseRows.length;
  const totalTrips = dayMovements.length;

  let totalIn = 0;
  let totalOut = 0;
  let pendingOut = 0;

  dayMovements.forEach(m => {
    totalIn++;
    const hasExited = (m.exit_time || m.out_time) && m.status !== 'inside' && m.status !== 'IN' && !m.is_active_inside;
    if (hasExited) {
      totalOut++;
    } else {
      pendingOut++;
    }
  });

  return {
    date: selectedDateStr,
    displayDate: formatISTDisplayDate(selectedDateStr),
    totalUniqueVehicles,
    totalTrips,
    totalIn,
    totalOut,
    pendingOut,
    tripCategories: {
      trips1,
      trips2,
      trips3,
      trips4,
      trips5Plus
    },
    vehicleWiseRows,
    rawMovements: dayMovements
  };
}

/**
 * Calculate weekly report from movements for a week range (weekStart to weekEnd YYYY-MM-DD in IST)
 */
export function calculateWeeklyReport(movements, weekStartStr, weekEndStr) {
  // If not provided, calculate current week Monday to Sunday in IST
  if (!weekStartStr || !weekEndStr) {
    const today = new Date();
    const currentIST = getISTDateString(today);
    // Find Monday of current week
    const d = new Date(currentIST);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    weekStartStr = getISTDateString(monday);
    weekEndStr = getISTDateString(sunday);
  }

  // Filter movements within week range in IST
  const weekMovements = (movements || []).filter(m => {
    const dateStr = getISTDateString(m.entry_time || m.in_time || m.created_at);
    return dateStr >= weekStartStr && dateStr <= weekEndStr;
  });

  // Generate 7-day array
  const dailyBreakdown = [];
  const start = new Date(weekStartStr);
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    const dateStr = getISTDateString(cur);
    const dayName = cur.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });

    const dayReport = calculateDailyReport(weekMovements, dateStr);
    dailyBreakdown.push({
      date: dateStr,
      dayName,
      displayDate: dayReport.displayDate,
      uniqueVehicles: dayReport.totalUniqueVehicles,
      totalTrips: dayReport.totalTrips,
      totalIn: dayReport.totalIn,
      totalOut: dayReport.totalOut,
      pendingOut: dayReport.pendingOut,
      tripCategories: dayReport.tripCategories
    });
  }

  // Vehicle-wise weekly breakdown
  const vehicleMap = {};
  weekMovements.forEach(m => {
    const rawPlate = m.plate_number || m.vehicle_number || '';
    const compact = normalizePlate(rawPlate);
    if (!compact) return;

    if (!vehicleMap[compact]) {
      vehicleMap[compact] = {
        compact,
        plate_number: rawPlate.trim() || compact,
        total_trips: 0,
        day_counts: {},
        records: []
      };
    }
    const dStr = getISTDateString(m.entry_time || m.in_time || m.created_at);
    vehicleMap[compact].day_counts[dStr] = (vehicleMap[compact].day_counts[dStr] || 0) + 1;
    vehicleMap[compact].total_trips++;
    vehicleMap[compact].records.push(m);
  });

  const vehicleSummaries = Object.values(vehicleMap).sort((a, b) => b.total_trips - a.total_trips);

  // Overall distinct trip category for the whole week
  let trips1 = 0;
  let trips2 = 0;
  let trips3 = 0;
  let trips4 = 0;
  let trips5Plus = 0;

  vehicleSummaries.forEach(v => {
    if (v.total_trips === 1) trips1++;
    else if (v.total_trips === 2) trips2++;
    else if (v.total_trips === 3) trips3++;
    else if (v.total_trips === 4) trips4++;
    else if (v.total_trips >= 5) trips5Plus++;
  });

  const totalUniqueVehicles = vehicleSummaries.length;
  const totalTrips = weekMovements.length;

  return {
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    displayStart: formatISTDisplayDate(weekStartStr),
    displayEnd: formatISTDisplayDate(weekEndStr),
    totalUniqueVehicles,
    totalTrips,
    dailyBreakdown,
    tripCategories: {
      trips1,
      trips2,
      trips3,
      trips4,
      trips5Plus
    },
    vehicleSummaries
  };
}
