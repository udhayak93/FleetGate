import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, getSupabaseConfig } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { isToday } from 'date-fns';
import { formatLorryNumber } from '../utils/vehicleFormatter';

const LorryDataContext = createContext(undefined);

const LOCAL_CACHE_KEY = 'fleetgate_cached_movements';

export const LorryDataProvider = ({ children }) => {
  const { profile, isAdmin, authToken } = useAuth();
  const { isConfigured } = getSupabaseConfig();

  // Primary shared movements state
  const [movements, setMovements] = useState(() => {
    try {
      const cached = localStorage.getItem(LOCAL_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('live'); // 'live' | 'syncing' | 'offline' | 'error'
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  // Cache locally as an offline fallback
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(movements));
    } catch (_) {}
  }, [movements]);

  // ============================================================================
  // SHARED CLOUD FETCH & SYNC
  // ============================================================================
  const refreshData = useCallback(async () => {
    setIsSyncing(true);

    try {
      // 1. Fetch from shared backend API (synchronized across all devices)
      const res = await fetch('/api/movements');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.movements)) {
          // Normalize server fields to match UI expectations
          const normalized = data.movements.map(m => ({
            ...m,
            // Ensure compatibility with existing component prop names
            entry_time: m.in_time,
            exit_time: m.out_time,
            remarks: m.remarks || '',
            entry_notes: m.remarks || '',
            exit_notes: m.remarks || '',
            plate_number: m.plate_number || m.vehicle_number,
            status: m.is_active_inside ? 'IN' : 'OUT'
          }));

          setMovements(normalized);
          setSyncStatus('live');
          setLastSyncTime(new Date());
          setIsSyncing(false);
          return;
        }
      }
    } catch (apiErr) {
      console.warn('[Sync] API fetch warning, trying fallback:', apiErr.message);
    }

    // 2. Fallback to Supabase if configured
    if (isConfigured) {
      try {
        const { data: supaData, error: supaError } = await supabase
          .from('lorry_movements')
          .select('*')
          .order('entry_time', { ascending: false });

        if (!supaError && supaData) {
          setMovements(supaData);
          setSyncStatus('live');
          setLastSyncTime(new Date());
          setIsSyncing(false);
          return;
        }
      } catch (err) {
        console.error('[Sync] Supabase fetch error:', err);
      }
    }

    // If both fail, mark offline
    setSyncStatus('offline');
    setIsSyncing(false);
  }, [isConfigured]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ============================================================================
  // REAL-TIME SERVER-SENT EVENTS (SSE) + PERIODIC POLLING
  // ============================================================================
  useEffect(() => {
    let eventSource = null;
    let pollInterval = null;

    // Connect to SSE stream for instant cross-device updates (< 100ms)
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'SYNC') {
            console.log('[SSE] Received sync broadcast from another device. Updating...');
            refreshData();
          }
        } catch (_) {}
      };

      eventSource.onerror = () => {
        // SSE disconnected, fallback to polling
        if (eventSource) eventSource.close();
      };
    } catch (sseErr) {
      console.warn('SSE not supported on this client, using polling:', sseErr);
    }

    // Safety polling every 3 seconds to guarantee 100% sync on all mobile devices
    pollInterval = setInterval(() => {
      refreshData();
    }, 3000);

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [refreshData]);

  // ============================================================================
  // DERIVED STATE & METRICS
  // ============================================================================
  const activeLorries = useMemo(() => {
    return movements.filter(m => m.is_active_inside);
  }, [movements]);

  // Check if a lorry is currently inside (Prevent Duplicate IN)
  const checkLorryInsideStatus = useCallback((plateNumber) => {
    const raw = (plateNumber || '').trim().toUpperCase();
    const compact = raw.replace(/\s+/g, '');
    if (!compact) return { isInside: false };

    const active = movements.find(
      m => (m.plate_number || '').toUpperCase().replace(/\s+/g, '') === compact && m.is_active_inside
    );

    return {
      isInside: Boolean(active),
      activeMovement: active
    };
  }, [movements]);

  // Calculate trip count today for intimating 2nd trip, 3rd trip
  const getLorryTripInfo = useCallback((plateNumber) => {
    const raw = (plateNumber || '').trim().toUpperCase();
    const compact = raw.replace(/\s+/g, '');
    if (!compact) {
      return { totalTrips: 0, nextTripNumber: 1, isReturning: false, previousMovements: [] };
    }

    const matched = movements.filter(m => {
      const p = (m.plate_number || '').toUpperCase().replace(/\s+/g, '');
      return p === compact && (isToday(new Date(m.in_time || m.entry_time)));
    });

    const totalTrips = matched.length;
    const nextTripNumber = totalTrips + 1;
    const isReturning = totalTrips > 0;

    return {
      totalTrips,
      nextTripNumber,
      isReturning,
      previousMovements: matched
    };
  }, [movements]);

  // Stats
  const stats = useMemo(() => {
    const inside_now = activeLorries.length;
    let today_in = 0;
    let today_out = 0;

    const counts = {};
    movements.forEach(m => {
      const entryDate = new Date(m.in_time || m.entry_time);
      if (isToday(entryDate)) {
        today_in++;
        const c = (m.plate_number || '').toUpperCase().replace(/\s+/g, '');
        if (c) counts[c] = (counts[c] || 0) + 1;
      }
      if (m.out_time || m.exit_time) {
        const exitDate = new Date(m.out_time || m.exit_time);
        if (isToday(exitDate)) {
          today_out++;
        }
      }
    });

    const total_vehicles_today = Object.keys(counts).length;
    const multi_trip_vehicles_today = Object.values(counts).filter(c => c >= 2).length;

    return {
      inside_now,
      today_in,
      today_out,
      total_vehicles_today,
      multi_trip_vehicles_today,
      total_lorries_registered: total_vehicles_today
    };
  }, [activeLorries, movements]);

  // ============================================================================
  // RECORD ARRIVAL (IN)
  // Fields: Vehicle number, In time (server timestamp), Remarks
  // ============================================================================
  const recordEntry = async (data) => {
    const rawPlate = data.plateNumber || data.vehicle_number || '';
    const normPlate = formatLorryNumber(rawPlate) || rawPlate.trim().toUpperCase();

    if (!normPlate) {
      return { success: false, error: 'Vehicle number is required.' };
    }

    // Client-side quick check
    const { isInside } = checkLorryInsideStatus(normPlate);
    if (isInside) {
      return {
        success: false,
        error: `DUPLICATE ENTRY REJECTED: Vehicle ${normPlate} is ALREADY inside premises. Must check OUT first.`
      };
    }

    setIsSyncing(true);

    try {
      // Send to shared cloud API
      const res = await fetch('/api/movements/in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          plate_number: normPlate,
          remarks: (data.remarks || data.entryNotes || '').trim(),
          created_by: profile?.full_name || 'Staff'
        })
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setIsSyncing(false);
        return { success: false, error: result.error || 'Failed to record entry.' };
      }

      // Immediately refresh shared state
      await refreshData();
      setIsSyncing(false);
      return { success: true, movement: result.movement };
    } catch (err) {
      console.error('[Record IN] Error:', err);
      setIsSyncing(false);
      return { success: false, error: 'Network error: could not connect to shared server.' };
    }
  };

  // ============================================================================
  // RECORD DEPARTURE (OUT)
  // Fields: In time (preserved), Out time (server timestamp), Remarks
  // ============================================================================
  const recordExit = async (data) => {
    const movementId = data.movementId || data.movement_id || data.id;
    const rawPlate = data.plateNumber || data.plate_number;

    setIsSyncing(true);

    try {
      const res = await fetch('/api/movements/out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          movement_id: movementId,
          plate_number: rawPlate,
          remarks: (data.exitRemarks || data.exitNotes || data.remarks || '').trim()
        })
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setIsSyncing(false);
        return { success: false, error: result.error || 'Failed to record departure.' };
      }

      await refreshData();
      setIsSyncing(false);
      return { success: true, movement: result.movement };
    } catch (err) {
      console.error('[Record OUT] Error:', err);
      setIsSyncing(false);
      return { success: false, error: 'Network error: could not connect to shared server.' };
    }
  };

  // ============================================================================
  // ADMIN OPERATIONS: UPDATE / DELETE / CLEAR / RESET
  // ============================================================================
  const updateMovement = async (movementId, updatedFields) => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can edit records.' };
    }

    try {
      const res = await fetch(`/api/movements/${movementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate_number: updatedFields.plate_number,
          remarks: updatedFields.remarks || updatedFields.entry_notes,
          in_time: updatedFields.entry_time || updatedFields.in_time,
          out_time: updatedFields.exit_time || updatedFields.out_time
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        await refreshData();
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to update record.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteMovement = async (movementId) => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can delete records.' };
    }

    try {
      const res = await fetch(`/api/movements/${movementId}`, {
        method: 'DELETE'
      });
      const result = await res.json();
      if (res.ok && result.success) {
        await refreshData();
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to delete record.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const clearDailyData = async () => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can clear data.' };
    }

    try {
      const res = await fetch('/api/admin/clear-daily', { method: 'POST' });
      const result = await res.json();
      if (res.ok && result.success) {
        await refreshData();
        return { success: true, count: result.cleared };
      }
      return { success: false, error: result.error || 'Failed to clear data.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const resetAllRecords = async () => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can reset records.' };
    }

    try {
      const res = await fetch('/api/admin/reset-all', { method: 'POST' });
      const result = await res.json();
      if (res.ok && result.success) {
        await refreshData();
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to reset records.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Lorries mock list for directory fallback
  const lorries = useMemo(() => {
    const map = new Map();
    movements.forEach(m => {
      const p = m.plate_number;
      if (p && !map.has(p)) {
        map.set(p, {
          id: `lry_${p}`,
          plate_number: p,
          is_currently_inside: m.is_active_inside,
          total_completed_visits: m.trip_number || 1
        });
      }
    });
    return Array.from(map.values());
  }, [movements]);

  return (
    <LorryDataContext.Provider
      value={{
        movements,
        activeLorries,
        lorries,
        stats,
        isLoading,
        isSyncing,
        syncStatus,
        lastSyncTime,
        refreshData,
        recordEntry,
        recordExit,
        checkLorryInsideStatus,
        getLorryTripInfo,
        updateMovement,
        deleteMovement,
        clearDailyData,
        resetAllRecords
      }}
    >
      {children}
    </LorryDataContext.Provider>
  );
};

export const useLorryData = () => {
  const context = useContext(LorryDataContext);
  if (!context) {
    throw new Error('useLorryData must be used within a LorryDataProvider');
  }
  return context;
};
