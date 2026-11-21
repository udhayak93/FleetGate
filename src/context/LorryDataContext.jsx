import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, getSupabaseConfig } from '../lib/supabase';
import { INITIAL_LORRIES, INITIAL_MOVEMENTS } from '../data/mockData';
import { useAuth } from './AuthContext';
import { isToday } from 'date-fns';
import { formatLorryNumber } from '../utils/vehicleFormatter';

const LorryDataContext = createContext(undefined);

// Clean live private keys - no dummy data
const LOCAL_STORAGE_LORRIES_KEY = 'ltp_live_private_lorries';
const LOCAL_STORAGE_MOVEMENTS_KEY = 'ltp_live_private_movements';

// Clear legacy dummy cache keys from previous tests so clean state is guaranteed
try {
  [
    'ltp_local_lorries_v3',
    'ltp_local_movements_v3',
    'ltp_local_lorries_v2',
    'ltp_local_movements_v2',
    'ltp_local_lorries',
    'ltp_local_movements'
  ].forEach(k => localStorage.removeItem(k));
} catch (_) {}

export const LorryDataProvider = ({ children }) => {
  const { profile, isAdmin } = useAuth();
  const { isConfigured } = getSupabaseConfig();

  const [lorries, setLorries] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_LORRIES_KEY);
      return saved ? JSON.parse(saved) : INITIAL_LORRIES;
    } catch {
      return INITIAL_LORRIES;
    }
  });

  const [movements, setMovements] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_MOVEMENTS_KEY);
      return saved ? JSON.parse(saved) : INITIAL_MOVEMENTS;
    } catch {
      return INITIAL_MOVEMENTS;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_LORRIES_KEY, JSON.stringify(lorries));
  }, [lorries]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_MOVEMENTS_KEY, JSON.stringify(movements));
  }, [movements]);

  const refreshData = useCallback(async () => {
    if (!isConfigured || !profile) return;
    setIsSyncing(true);

    try {
      const { data: lorriesData, error: lorriesError } = await supabase
        .from('lorries')
        .select('*')
        .order('plate_number', { ascending: true });

      if (!lorriesError && lorriesData) {
        setLorries(lorriesData);
      }

      let movQuery = supabase
        .from('lorry_movements')
        .select('*')
        .order('entry_time', { ascending: false });

      // Staff security rule: Staff can only access 1 day of records (today)
      // Older historical records are restricted and can only be accessed/handled by Admin
      if (!isAdmin) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        movQuery = movQuery.or(`entry_time.gte.${startOfToday.toISOString()},is_active_inside.eq.true`);
      }

      const { data: movData, error: movError } = await movQuery;

      if (!movError && movData) {
        setMovements(movData);
      }
    } catch (err) {
      console.error('Error refreshing from Supabase:', err);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [isConfigured, profile, isAdmin]);

  useEffect(() => {
    if (isConfigured && profile) {
      refreshData();

      const channel = supabase
        .channel('lorry_movements_live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lorry_movements' },
          () => {
            refreshData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lorries' },
          () => {
            refreshData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isConfigured, profile, refreshData]);

  const activeLorries = useMemo(() => {
    return movements.filter(m => m.is_active_inside && m.status === 'IN');
  }, [movements]);

  const checkLorryInsideStatus = useCallback((plateNumber) => {
    const raw = (plateNumber || '').trim().toUpperCase();
    const compact = raw.replace(/\s+/g, '');
    if (!compact) return { isInside: false };

    const active = movements.find(
      m => (m.plate_number || '').toUpperCase().replace(/\s+/g, '') === compact && m.is_active_inside && m.status === 'IN'
    );
    return {
      isInside: Boolean(active),
      activeMovement: active
    };
  }, [movements]);

  // Check trip history for a lorry to intimidate multi-trip visits (e.g. 2nd Trip, 3rd Trip)
  const getLorryTripInfo = useCallback((plateNumber) => {
    const raw = (plateNumber || '').trim().toUpperCase();
    const compact = raw.replace(/\s+/g, '');
    if (!compact) {
      return { totalTrips: 0, nextTripNumber: 1, isReturning: false, previousMovements: [] };
    }

    const matched = movements.filter(
      m => (m.plate_number || '').toUpperCase().replace(/\s+/g, '') === compact
    );

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

  const stats = useMemo(() => {
    const inside_now = activeLorries.length;
    let today_in = 0;
    let today_out = 0;
    let totalCompletedMinutes = 0;
    let completedCount = 0;

    movements.forEach(m => {
      const entryDate = new Date(m.entry_time);
      if (isToday(entryDate)) {
        today_in++;
      }
      if (m.exit_time) {
        const exitDate = new Date(m.exit_time);
        if (isToday(exitDate)) {
          today_out++;
        }
      }
      if (m.status === 'OUT' && typeof m.duration_minutes === 'number' && m.duration_minutes > 0) {
        totalCompletedMinutes += m.duration_minutes;
        completedCount++;
      }
    });

    const avg_duration_minutes = completedCount > 0 ? Math.round(totalCompletedMinutes / completedCount) : 120;

    return {
      inside_now,
      today_in,
      today_out,
      avg_duration_minutes,
      total_lorries_registered: lorries.length
    };
  }, [activeLorries, movements, lorries]);

  const recordEntry = async (data) => {
    if (!profile) {
      return { success: false, error: 'Authentication required to record entry.' };
    }

    const normPlate = formatLorryNumber(data.plateNumber) || (data.plateNumber || '').trim().toUpperCase();
    if (!normPlate) {
      return { success: false, error: 'Vehicle Plate Number is required.' };
    }
    
    const driverName = (data.driverName && data.driverName.trim()) 
      ? data.driverName.trim() 
      : 'Driver';

    const wheelType = data.wheelType || data.vehicleType || '12 Wheel';

    const { isInside, activeMovement } = checkLorryInsideStatus(normPlate);
    if (isInside && activeMovement) {
      return {
        success: false,
        error: `DUPLICATE ENTRY REJECTED: Lorry ${normPlate} is ALREADY inside the premises. Please record OUT first before re-entering.`
      };
    }

    const exactEntryTime = data.entryTime || new Date().toISOString();
    let lorry = lorries.find(l => l.plate_number.toUpperCase() === normPlate);
    const lorryId = lorry ? lorry.id : `lry_${Date.now()}`;
    
    // Calculate trip number (e.g. 1st Trip, 2nd Trip) based on past visits
    const compact = normPlate.replace(/\s+/g, '');
    const previousMovements = movements.filter(
      m => (m.plate_number || '').toUpperCase().replace(/\s+/g, '') === compact
    );
    const nextTripNumber = previousMovements.length + 1;

    const newMovement = {
      id: `mov_${Date.now()}`,
      lorry_id: lorryId,
      plate_number: normPlate,
      vehicle_type: wheelType,
      driver_name: driverName,
      driver_phone: data.driverPhone?.trim() || lorry?.default_driver_phone || '',
      transporter_name: data.transporterName?.trim() || lorry?.transporter_name || 'Standard Transport',
      cargo_details: data.cargoDetails?.trim() || '',
      purpose: data.purpose || 'Material Transport',
      entry_gate: data.entryGate || 'Main Gate',
      entry_time: exactEntryTime,
      entry_recorded_by: profile.id,
      entry_recorded_by_name: profile.full_name,
      entry_odometer: data.entryOdometer,
      entry_notes: data.remarks?.trim() || data.entryNotes?.trim() || '',
      remarks: data.remarks?.trim() || data.entryNotes?.trim() || '',
      status: 'IN',
      is_active_inside: true,
      trip_number: nextTripNumber,
      visit_number: nextTripNumber,
      created_at: exactEntryTime
    };

    // 1. Immediately store in local state & localStorage so data is NEVER lost!
    if (!lorry) {
      const newLorry = {
        id: lorryId,
        plate_number: normPlate,
        transporter_name: data.transporterName?.trim() || 'Standard Transport',
        vehicle_type: wheelType,
        default_driver_name: driverName,
        default_driver_phone: '',
        total_completed_visits: 0,
        is_currently_inside: true,
        created_at: exactEntryTime
      };
      setLorries(prev => [newLorry, ...prev]);
    } else {
      setLorries(prev => prev.map(l => l.id === lorryId ? {
        ...l,
        is_currently_inside: true
      } : l));
    }

    setMovements(prev => [newMovement, ...prev]);

    // 2. Sync to Supabase in the background if configured
    if (isConfigured) {
      try {
        const { data: upsertLorry } = await supabase
          .from('lorries')
          .upsert([{
            plate_number: normPlate,
            vehicle_type: wheelType,
            transporter_name: data.transporterName?.trim() || lorry?.transporter_name || 'Standard Transport',
            is_currently_inside: true,
            updated_at: exactEntryTime
          }], { onConflict: 'plate_number' })
          .select()
          .single();

        const actualLorryId = upsertLorry?.id || lorryId;

        const { data: insertedMov, error: movInsertErr } = await supabase
          .from('lorry_movements')
          .insert([{
            lorry_id: actualLorryId,
            plate_number: normPlate,
            vehicle_type: wheelType,
            driver_name: driverName,
            driver_phone: data.driverPhone?.trim() || lorry?.default_driver_phone || null,
            transporter_name: data.transporterName?.trim() || lorry?.transporter_name || 'Standard Transport',
            purpose: data.purpose || 'Material Transport',
            entry_gate: data.entryGate || 'Main Gate',
            entry_time: exactEntryTime,
            entry_recorded_by: profile.id,
            entry_recorded_by_name: profile.full_name,
            status: 'IN',
            is_active_inside: true,
            visit_number: nextVisitNumber
          }])
          .select()
          .single();

        if (insertedMov) {
          // Update movement ID from Supabase
          newMovement.id = insertedMov.id;
          setMovements(prev => prev.map(m => m.id === newMovement.id ? { ...m, id: insertedMov.id } : m));
        } else if (movInsertErr) {
          // Fallback to RPC if installed
          await supabase.rpc('record_lorry_entry', {
            p_plate_number: normPlate,
            p_transporter_name: data.transporterName?.trim() || 'Standard Transport',
            p_vehicle_type: wheelType,
            p_driver_name: driverName,
            p_driver_phone: data.driverPhone?.trim() || '',
            p_cargo_details: data.cargoDetails?.trim() || '',
            p_purpose: data.purpose || 'Material Transport',
            p_entry_gate: data.entryGate || 'Main Gate',
            p_entry_odometer: data.entryOdometer || null,
            p_entry_notes: data.entryNotes?.trim() || '',
            p_user_id: profile.id,
            p_user_name: profile.full_name
          });
        }
      } catch (err) {
        console.warn('Supabase entry sync warning (data preserved locally):', err);
      }
    }

    return { success: true, movement: newMovement, tripNumber: nextTripNumber };
  };

  const recordExit = async (data) => {
    if (!profile) {
      return { success: false, error: 'Authentication required to record exit.' };
    }

    const targetMovement = movements.find(m => m.id === data.movementId && m.is_active_inside && m.status === 'IN');
    if (!targetMovement) {
      return { success: false, error: 'Movement record not found or lorry is already marked OUT.' };
    }

    const exitTimestampStr = data.exitTime || new Date().toISOString();
    const exitTimestamp = new Date(exitTimestampStr);
    const entryTimestamp = new Date(targetMovement.entry_time);
    const durationMinutes = Math.max(1, Math.round((exitTimestamp.getTime() - entryTimestamp.getTime()) / 60000));

    const updatedMovement = {
      ...targetMovement,
      status: 'OUT',
      is_active_inside: false,
      exit_time: exitTimestampStr,
      exit_gate: data.exitGate || 'Main Gate',
      exit_recorded_by: profile.id,
      exit_recorded_by_name: profile.full_name,
      exit_odometer: data.exitOdometer,
      exit_notes: data.exitRemarks?.trim() || data.exitNotes?.trim() || data.remarks?.trim() || '',
      exit_remarks: data.exitRemarks?.trim() || data.exitNotes?.trim() || data.remarks?.trim() || '',
      duration_minutes: durationMinutes,
      updated_at: exitTimestampStr
    };

    // 1. Immediately update local state & localStorage
    setMovements(prev => prev.map(m => m.id === data.movementId ? updatedMovement : m));

    setLorries(prev => prev.map(l => {
      if (l.id === targetMovement.lorry_id || l.plate_number.toUpperCase() === targetMovement.plate_number.toUpperCase()) {
        return {
          ...l,
          is_currently_inside: false,
          total_completed_visits: (l.total_completed_visits || 0) + 1,
          updated_at: exitTimestampStr
        };
      }
      return l;
    }));

    // 2. Sync to Supabase in background
    if (isConfigured) {
      try {
        const { error: movErr } = await supabase
          .from('lorry_movements')
          .update({
            status: 'OUT',
            is_active_inside: false,
            exit_time: exitTimestampStr,
            exit_gate: data.exitGate || 'Main Gate',
            exit_recorded_by: profile.id,
            exit_recorded_by_name: profile.full_name,
            duration_minutes: durationMinutes,
            updated_at: exitTimestampStr
          })
          .eq('id', data.movementId);

        if (!movErr && targetMovement.lorry_id) {
          const currentLorry = lorries.find(l => l.id === targetMovement.lorry_id);
          const newVisits = (currentLorry?.total_completed_visits || 0) + 1;
          await supabase
            .from('lorries')
            .update({
              is_currently_inside: false,
              total_completed_visits: newVisits,
              updated_at: exitTimestampStr
            })
            .eq('id', targetMovement.lorry_id);
        } else if (movErr) {
          await supabase.rpc('record_lorry_exit', {
            p_movement_id: data.movementId,
            p_exit_gate: data.exitGate || 'Main Gate',
            p_exit_odometer: data.exitOdometer || null,
            p_exit_notes: data.exitNotes?.trim() || '',
            p_user_id: profile.id,
            p_user_name: profile.full_name
          });
        }
      } catch (err) {
        console.warn('Supabase exit sync warning (data preserved locally):', err);
      }
    }

    return { success: true, movement: updatedMovement };
  };

  const addOrUpdateLorry = async (data) => {
    if (!isAdmin) {
      return { success: false, error: 'Access Denied: Only Admin can manage the Lorries directory.' };
    }

    const normPlate = (data.plate_number || '').trim().toUpperCase();
    if (!normPlate) {
      return { success: false, error: 'Plate number is required.' };
    }

    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('lorries')
          .upsert([{
            plate_number: normPlate,
            transporter_name: data.transporter_name || 'Direct / Unknown',
            vehicle_type: data.vehicle_type || '10-Wheeler',
            default_driver_name: data.default_driver_name || null,
            default_driver_phone: data.default_driver_phone || null,
            notes: data.notes || null,
            updated_at: new Date().toISOString()
          }], { onConflict: 'plate_number' });

        if (error) throw error;
        await refreshData();
        return { success: true };
      } catch (err) {
        console.error('Supabase lorry upsert error:', err);
      }
    }

    const existingIndex = lorries.findIndex(l => l.plate_number.toUpperCase() === normPlate);
    if (existingIndex >= 0) {
      setLorries(prev => prev.map((l, idx) => idx === existingIndex ? {
        ...l,
        ...data,
        plate_number: normPlate,
        updated_at: new Date().toISOString()
      } : l));
    } else {
      const newLorry = {
        id: `lry_${Date.now()}`,
        plate_number: normPlate,
        transporter_name: data.transporter_name || 'Direct / Unknown',
        vehicle_type: data.vehicle_type || '10-Wheeler',
        default_driver_name: data.default_driver_name || '',
        default_driver_phone: data.default_driver_phone || '',
        notes: data.notes || '',
        total_completed_visits: 0,
        is_currently_inside: false,
        created_at: new Date().toISOString()
      };
      setLorries(prev => [newLorry, ...prev]);
    }

    return { success: true };
  };

  const deleteMovement = async (movementId) => {
    if (!isAdmin) {
      return { success: false, error: 'Access Denied: Only Admin can delete movement records.' };
    }

    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('lorry_movements')
          .delete()
          .eq('id', movementId);

        if (error) throw error;
        await refreshData();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    setMovements(prev => prev.filter(m => m.id !== movementId));
    return { success: true };
  };

  // Admin capability: Edit any movement record
  const updateMovement = async (movementId, updatedData) => {
    if (!isAdmin) {
      return { success: false, error: 'Access Denied: Only Admin can edit movement records.' };
    }

    const normPlate = updatedData.plate_number 
      ? (formatLorryNumber(updatedData.plate_number) || updatedData.plate_number.toUpperCase().trim()) 
      : undefined;

    const cleanData = { ...updatedData };
    if (normPlate) cleanData.plate_number = normPlate;

    setMovements(prev => prev.map(m => m.id === movementId ? { ...m, ...cleanData, updated_at: new Date().toISOString() } : m));

    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('lorry_movements')
          .update({ ...cleanData, updated_at: new Date().toISOString() })
          .eq('id', movementId);
        if (error) throw error;
      } catch (err) {
        console.error('Supabase updateMovement error:', err);
      }
    }

    return { success: true };
  };

  // Admin capability: Clear all daily data
  const clearDailyData = async () => {
    if (!isAdmin) {
      return { success: false, error: 'Access Denied: Only Admin can clear daily data.' };
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startIso = startOfToday.toISOString();

    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('lorry_movements')
          .delete()
          .gte('entry_time', startIso);
        if (error) throw error;
      } catch (err) {
        console.error('Supabase clearDailyData error:', err);
      }
    }

    setMovements(prev => prev.filter(m => {
      try {
        return !isToday(new Date(m.entry_time));
      } catch {
        return false;
      }
    }));

    setLorries(prev => prev.map(l => ({
      ...l,
      is_currently_inside: false
    })));

    return { success: true };
  };

  // Admin capability: Complete Master Reset / Delete ALL records across the entire database
  const resetAllRecords = async () => {
    if (!isAdmin) {
      return { success: false, error: 'Access Denied: Only Admin can reset all records.' };
    }

    if (isConfigured) {
      try {
        await supabase
          .from('lorry_movements')
          .delete()
          .neq('id', '0');

        await supabase
          .from('lorries')
          .delete()
          .neq('id', '0');
      } catch (err) {
        console.error('Supabase resetAllRecords error:', err);
      }
    }

    // Wipe local state and storage clean
    setMovements([]);
    setLorries([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_MOVEMENTS_KEY);
      localStorage.removeItem(LOCAL_STORAGE_LORRIES_KEY);
    } catch (_) {}

    return { success: true };
  };

  return (
    <LorryDataContext.Provider
      value={{
        lorries,
        movements,
        activeLorries,
        stats,
        isLoading,
        isSyncing,
        refreshData,
        checkLorryInsideStatus,
        getLorryTripInfo,
        recordEntry,
        recordExit,
        addOrUpdateLorry,
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
