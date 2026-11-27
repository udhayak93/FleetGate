import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, getSupabaseConfig } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { isToday } from 'date-fns';
import { formatLorryNumber } from '../utils/vehicleFormatter';
import { apiFetch, apiUrl } from '../utils/api';

const LorryDataContext = createContext(undefined);

const LOCAL_CACHE_KEY = 'fleetgate_cached_movements';
const LOCAL_TEAMS_KEY = 'fleetgate_cached_teams';

function getMovementISTDate(m) {
  if (!m) return null;
  const dInput = m.entry_time || m.in_time || m.created_at;
  if (!dInput) return null;
  const d = new Date(dInput);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function getTodayISTStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

const INITIAL_TEAMS = [
  { id: 'team-1', name: 'Team 1', members: 'Saravanan & Muthuraj', is_active: true },
  { id: 'team-2', name: 'Team 2', members: 'Murugan & Tamil', is_active: true },
  { id: 'team-3', name: 'Team 3', members: 'Unassigned', is_active: false },
  { id: 'team-4', name: 'Team 4', members: 'Unassigned', is_active: false },
];

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

  // Primary shared teams state (configured with Team 1 & 2 enabled, Team 3 & 4 disabled)
  const [teams, setTeams] = useState(() => {
    try {
      const cached = localStorage.getItem(LOCAL_TEAMS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return INITIAL_TEAMS;
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

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_TEAMS_KEY, JSON.stringify(teams));
    } catch (_) {}
  }, [teams]);

  // ============================================================================
  // SHARED CLOUD FETCH & SYNC
  // ============================================================================
  const refreshData = useCallback(async () => {
    setIsSyncing(true);

    try {
      // 1. Fetch from shared backend API (synchronized across all devices)
      const res = await apiFetch('/api/movements');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.movements)) {
          // Normalize server fields to match UI expectations
          const normalized = data.movements.map(m => {
            const entryTime = m.entry_time || m.in_time;
            const exitTime = m.exit_time || m.out_time;
            const isInside = m.status === 'inside' || m.status === 'IN' || m.is_active_inside || !exitTime;
            const rawPlate = m.plate_number || m.vehicle_number || '';
            return {
              ...m,
              entry_time: entryTime,
              in_time: entryTime,
              exit_time: exitTime,
              out_time: exitTime,
              remarks: m.remarks || m.entry_notes || '',
              entry_notes: m.remarks || m.entry_notes || '',
              exit_notes: m.exit_remarks || m.exit_notes || '',
              team: m.team || (m.team_name ? m.team_name.split(':')[0].trim() : 'Team 1'),
              team_name: m.team_name || m.team || 'Team 1',
              team_id: m.team_id || '',
              plate_number: rawPlate,
              vehicle_number: rawPlate,
              is_active_inside: Boolean(isInside),
              status: isInside ? 'IN' : 'OUT'
            };
          });

          setMovements(normalized);
          setSyncStatus('live');
          setLastSyncTime(new Date());

          // Fetch shared teams
          try {
            const resTeams = await apiFetch('/api/teams');
            if (resTeams.ok) {
              const dTeams = await resTeams.json();
              if (dTeams.success && Array.isArray(dTeams.teams) && dTeams.teams.length > 0) {
                setTeams(dTeams.teams);
              }
            }
          } catch (_) {}

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
      eventSource = new EventSource(apiUrl('/api/events'));
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
    if (!compact || compact === 'TN') return { isInside: false };

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
    if (!compact || compact === 'TN') {
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
      const res = await apiFetch('/api/movements/in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          plate_number: normPlate,
          plateNumber: normPlate,
          vehicle_number: normPlate,
          vehicleNumber: normPlate,
          remarks: (data.remarks || data.entryNotes || '').trim(),
          team: (data.team || data.team_name || '').trim(),
          team_name: (data.team_name || data.team || '').trim(),
          team_id: data.team_id || '',
          entryTime: data.entryTime,
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
      const res = await apiFetch('/api/movements/out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          movementId: movementId,
          movement_id: movementId,
          id: movementId,
          plate_number: rawPlate,
          vehicle_number: rawPlate,
          exitTime: data.exitTime,
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
          out_time: updatedFields.exit_time || updatedFields.out_time,
          team_name: updatedFields.team_name,
          team_id: updatedFields.team_id
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

  // Assign or update Duty Team on any movement (accessible to Staff and Admin)
  const assignMovementTeam = async (movementId, teamName, teamId = null) => {
    try {
      const res = await apiFetch(`/api/movements/${movementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_name: teamName || null,
          team_id: teamId || null
        })
      });

      // Optimistic update so UI reflects immediately
      setMovements(prev => prev.map(m => {
        if (m.id === movementId || m._id === movementId) {
          return { ...m, team_name: teamName, team: teamName, team_id: teamId };
        }
        return m;
      }));

      if (res.ok) {
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      console.error('Failed to assign team to movement:', err);
      setMovements(prev => prev.map(m => {
        if (m.id === movementId || m._id === movementId) {
          return { ...m, team_name: teamName, team: teamName, team_id: teamId };
        }
        return m;
      }));
      return { success: true };
    }
  };

  const clearDailyData = async () => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can clear data.' };
    }

    const todayIST = getTodayISTStr();

    // 1. Immediately wipe today's records from React state & local storage (zero lag)
    setMovements(prev => {
      const remaining = prev.filter(m => getMovementISTDate(m) !== todayIST);
      try {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(remaining));
      } catch (_) {}
      return remaining;
    });

    // 2. Request cloud backend to delete strictly today's records from MongoDB
    try {
      const res = await apiFetch('/api/clear-today', { method: 'POST' });
      const result = await res.json();
      if (res.ok && result.success) {
        await refreshData();
        return { success: true, count: result.cleared };
      }
      return { success: true, count: 0 };
    } catch (err) {
      console.warn('Backend clear-today completed in memory:', err.message);
      return { success: true, count: 0 };
    }
  };

  const resetAllRecords = async () => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can reset records.' };
    }

    try {
      const res = await apiFetch('/api/reset-all', { method: 'POST' });
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

  // ============================================================================
  // TEAM MANAGEMENT (Add, Edit, Delete, Toggle Enable/Disable)
  // ============================================================================
  const addTeam = async (teamData) => {
    const name = (teamData.name || '').trim();
    if (!name) return { success: false, error: 'Team name is required.' };
    const members = (teamData.members || '').trim() || 'Unassigned';
    const isActive = teamData.is_active !== undefined ? Boolean(teamData.is_active) : (teamData.isActive !== undefined ? Boolean(teamData.isActive) : true);

    const tempId = `team-${Date.now()}`;
    const newTeamObj = {
      id: tempId,
      name,
      members,
      is_active: isActive,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setTeams(prev => [...prev, newTeamObj]);

    try {
      const res = await apiFetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, members, is_active: isActive })
      });
      const data = await res.json();
      if (res.ok && data.success && data.team) {
        setTeams(prev => prev.map(t => t.id === tempId ? data.team : t));
        return { success: true, team: data.team };
      }
    } catch (_) {}

    return { success: true, team: newTeamObj };
  };

  const updateTeam = async (id, updateData) => {
    setTeams(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          ...(updateData.name ? { name: updateData.name.trim() } : {}),
          ...(updateData.members !== undefined ? { members: updateData.members.trim() } : {}),
          ...(updateData.is_active !== undefined ? { is_active: Boolean(updateData.is_active) } : {}),
          ...(updateData.isActive !== undefined ? { is_active: Boolean(updateData.isActive) } : {}),
          updated_at: new Date().toISOString()
        };
      }
      return t;
    }));

    try {
      const res = await apiFetch(`/api/teams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      const data = await res.json();
      if (res.ok && data.success && data.team) {
        setTeams(prev => prev.map(t => t.id === id ? data.team : t));
        return { success: true, team: data.team };
      }
    } catch (_) {}

    return { success: true };
  };

  const deleteTeam = async (id) => {
    setTeams(prev => prev.filter(t => t.id !== id));
    try {
      await apiFetch(`/api/teams/${id}`, { method: 'DELETE' });
    } catch (_) {}
    return { success: true };
  };

  const toggleTeamStatus = async (id) => {
    const existing = teams.find(t => t.id === id);
    if (!existing) return { success: false, error: 'Team not found' };
    const nextStatus = !existing.is_active;
    return await updateTeam(id, { is_active: nextStatus });
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
        teams,
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
        resetAllRecords,
        addTeam,
        updateTeam,
        deleteTeam,
        toggleTeamStatus,
        assignMovementTeam
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
