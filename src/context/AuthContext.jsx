import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, getSupabaseConfig } from '../lib/supabase';
import { INITIAL_PROFILES } from '../data/mockData';

const AuthContext = createContext(undefined);

const LOCAL_STORAGE_ACTIVE_USER_KEY = 'fleetgate_active_user';
const LOCAL_STORAGE_TOKEN_KEY = 'fleetgate_auth_token';

export const DEFAULT_STAFF_PROFILE = {
  id: 'usr_staff_gate',
  email: 'staff@fleetgate.com',
  full_name: 'Gate Security Staff',
  role: 'staff',
  is_active: true
};

export const AuthProvider = ({ children }) => {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ACTIVE_USER_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_STAFF_PROFILE;
    } catch {
      return DEFAULT_STAFF_PROFILE;
    }
  });

  const [authToken, setAuthToken] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY) || '';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [allStaff, setAllStaff] = useState(INITIAL_PROFILES);
  const { isConfigured } = getSupabaseConfig();

  // Fetch staff list from shared backend API
  const refreshStaffList = useCallback(async () => {
    try {
      const res = await fetch('/api/staff');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.staff)) {
          setAllStaff(data.staff);
          return;
        }
      }
    } catch (_) {}

    // Fallback to Supabase if configured
    if (isConfigured) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').order('full_name');
        if (!error && data) setAllStaff(data);
      } catch (_) {}
    }
  }, [isConfigured]);

  useEffect(() => {
    refreshStaffList();

    // Connect to SSE stream for instant live staff updates across all devices
    let eventSource = null;
    let pollInterval = null;

    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('staff_update', () => {
        refreshStaffList();
      });
      eventSource.addEventListener('SYNC', () => {
        refreshStaffList();
      });
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'SYNC' || payload.entity === 'staff') {
            refreshStaffList();
          }
        } catch (_) {}
      };
      eventSource.onerror = () => {
        if (eventSource) eventSource.close();
      };
    } catch (_) {}

    // Safety polling every 4 seconds to guarantee all open phones/desktops stay in sync
    pollInterval = setInterval(() => {
      refreshStaffList();
    }, 4000);

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [refreshStaffList]);

  // Persist session to local storage
  useEffect(() => {
    if (profile) {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_USER_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ACTIVE_USER_KEY);
    }
  }, [profile]);

  useEffect(() => {
    if (authToken) {
      localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, authToken);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
    }
  }, [authToken]);

  // Shared Cloud Login: Authenticates against the shared database
  const login = async (email, password) => {
    setIsLoading(true);
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    try {
      // 1. Try shared backend API first (works across all phones and devices)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass })
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        const safeUser = {
          ...data.user,
          full_name: data.user.full_name || data.user.name || 'Admin',
          role: data.user.role || 'admin',
          is_active: true
        };
        setProfile(safeUser);
        setAuthToken(data.token || `fg_admin_${Date.now()}`);
        setIsLoading(false);
        refreshStaffList();
        return { success: true };
      } else if (data.error) {
        setIsLoading(false);
        return { success: false, error: data.error };
      }
    } catch (apiErr) {
      console.warn('API login error, trying fallback:', apiErr);
    }

    // 2. Direct Admin Master Fallback (admin@gmail.com / Admin@123)
    if (cleanEmail === 'admin@gmail.com' && cleanPass === 'Admin@123') {
      const adminUser = {
        id: 'usr_admin_master',
        email: 'admin@gmail.com',
        full_name: 'System Administrator',
        role: 'admin',
        is_active: true
      };
      setProfile(adminUser);
      setAuthToken(`fg_admin_${Date.now()}`);
      setIsLoading(false);
      return { success: true };
    }

    // 3. Fallback to Supabase if configured
    if (isConfigured) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass
        });

        if (!authError && authData?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (profileData) {
            setProfile(profileData);
            setIsLoading(false);
            return { success: true };
          }
        }
      } catch (err) {
        console.error('Supabase login error:', err);
      }
    }

    setIsLoading(false);
    return { success: false, error: 'Invalid email or password.' };
  };

  const logout = async () => {
    if (isConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (_) {}
    }
    // Revert to default staff profile (Staff needs no login to record vehicles)
    setProfile(DEFAULT_STAFF_PROFILE);
    setAuthToken('');
    localStorage.removeItem(LOCAL_STORAGE_ACTIVE_USER_KEY);
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
  };

  // Staff Account Management (Admin only)
  const createStaffAccount = async ({ fullName, email, password, role = 'staff' }) => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can create staff accounts.' };
    }

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, role })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        refreshStaffList();
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to create staff account.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateStaffAccount = async (userId, { fullName, email, password, role, isActive }) => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can edit staff accounts.' };
    }

    try {
      const res = await fetch(`/api/staff/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, password, role, is_active: isActive })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        refreshStaffList();
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to update staff account.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteStaffAccount = async (userId) => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can delete staff accounts.' };
    }

    try {
      const res = await fetch(`/api/staff/${userId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        refreshStaffList();
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to delete staff account.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin';
  const isAuthenticated = Boolean(profile && profile.role === 'admin');

  return (
    <AuthContext.Provider
      value={{
        profile,
        authToken,
        isAdmin: Boolean(isAdmin),
        isStaff: Boolean(isStaff),
        isAuthenticated,
        isLoading,
        allStaff,
        login,
        logout,
        refreshStaffList,
        createStaffAccount,
        updateStaffAccount,
        deleteStaffAccount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
