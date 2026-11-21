import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, getSupabaseConfig } from '../lib/supabase';
import { INITIAL_PROFILES } from '../data/mockData';

const AuthContext = createContext(undefined);

const LOCAL_STORAGE_PROFILES_KEY = 'ltp_local_profiles';
const LOCAL_STORAGE_ACTIVE_USER_KEY = 'ltp_local_active_user';

// Staff does NOT need login! Default public gate mode.
export const DEFAULT_STAFF_PROFILE = {
  id: 'usr_staff_gate',
  email: 'staff@lorrytrackpro.local',
  full_name: 'Gate Staff',
  role: 'staff',
  is_active: true
};

export const AuthProvider = ({ children }) => {
  // Default to staff mode immediately - no login required for staff!
  const [profile, setProfile] = useState(DEFAULT_STAFF_PROFILE);
  const [isLoading, setIsLoading] = useState(false);
  const [allStaff, setAllStaff] = useState(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
    return saved ? JSON.parse(saved) : INITIAL_PROFILES;
  });

  const { isConfigured } = getSupabaseConfig();
  const [isDemoMode, setIsDemoMode] = useState(!isConfigured);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(allStaff));
  }, [allStaff]);

  useEffect(() => {
    // Check if Admin was previously logged in
    const savedUser = localStorage.getItem(LOCAL_STORAGE_ACTIVE_USER_KEY);
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.role === 'admin' && parsed.email === 'admin@gmail.com') {
          setProfile(parsed);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    // Otherwise keep DEFAULT_STAFF_PROFILE (Staff no login needed!)
    setProfile(DEFAULT_STAFF_PROFILE);
  }, []);

  // ONLY Admin needs login: admin@gmail.com / Admin@123
  const login = async (email, password) => {
    setIsLoading(true);
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // Required Admin Master Credentials
    if (cleanEmail === 'admin@gmail.com' && cleanPass === 'Admin@123') {
      const adminUser = {
        id: 'usr_admin_01',
        email: 'admin@gmail.com',
        full_name: 'Admin',
        role: 'admin',
        is_active: true
      };
      setProfile(adminUser);
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_USER_KEY, JSON.stringify(adminUser));
      setIsLoading(false);
      return { success: true };
    }

    // If Supabase is configured, try Supabase auth fallback
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

          if (profileData && profileData.role === 'admin') {
            setProfile(profileData);
            localStorage.setItem(LOCAL_STORAGE_ACTIVE_USER_KEY, JSON.stringify(profileData));
            setIsLoading(false);
            return { success: true };
          }
        }
      } catch (err) {
        console.warn('Supabase auth attempt:', err);
      }
    }

    setIsLoading(false);
    return { 
      success: false, 
      error: 'Invalid email or password.' 
    };
  };

  const loginAsDemoUser = (role) => {
    if (role === 'admin') {
      const adminUser = {
        id: 'usr_admin_01',
        email: 'admin@gmail.com',
        full_name: 'Admin',
        role: 'admin',
        is_active: true
      };
      setProfile(adminUser);
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_USER_KEY, JSON.stringify(adminUser));
    } else {
      setProfile(DEFAULT_STAFF_PROFILE);
      localStorage.removeItem(LOCAL_STORAGE_ACTIVE_USER_KEY);
    }
  };

  const logout = async () => {
    if (isConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.removeItem(LOCAL_STORAGE_ACTIVE_USER_KEY);
    // Staff no need of login - reverts to default staff mode immediately
    setProfile(DEFAULT_STAFF_PROFILE);
  };

  const createStaffAccount = async ({ email, fullName, role, password }) => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can create staff accounts.' };
    }

    const cleanEmail = email.trim().toLowerCase();

    if (allStaff.some(s => s.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    const newStaffUser = {
      id: `usr_staff_${Date.now()}`,
      email: cleanEmail,
      full_name: fullName.trim(),
      role: role || 'staff',
      is_active: true,
      created_at: new Date().toISOString()
    };

    if (isConfigured) {
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password || 'StaffPass@123',
          options: {
            data: {
              full_name: fullName.trim(),
              role: role || 'staff'
            }
          }
        });

        if (signUpError) {
          return { success: false, error: signUpError.message };
        }

        if (signUpData?.user) {
          newStaffUser.id = signUpData.user.id;
          await supabase.from('profiles').upsert([
            {
              id: signUpData.user.id,
              email: cleanEmail,
              full_name: fullName.trim(),
              role: role || 'staff',
              is_active: true
            }
          ]);
        }
      } catch (err) {
        console.error('Supabase user creation error:', err);
      }
    }

    setAllStaff(prev => [newStaffUser, ...prev]);
    return { success: true };
  };

  const toggleStaffStatus = async (userId, active) => {
    if (!profile || profile.role !== 'admin') return false;

    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ is_active: active, updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (error) throw error;
      } catch (e) {
        console.error('Failed to toggle profile in Supabase:', e);
      }
    }

    setAllStaff(prev => prev.map(s => s.id === userId ? { ...s, is_active: active } : s));
    return true;
  };

  const updateStaffRole = async (userId, role) => {
    if (!profile || profile.role !== 'admin') return false;

    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (error) throw error;
      } catch (e) {
        console.error('Failed to update role in Supabase:', e);
      }
    }

    setAllStaff(prev => prev.map(s => s.id === userId ? { ...s, role } : s));
    return true;
  };

  const updateStaffAccount = async (userId, { fullName, email, role, isActive }) => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can edit staff accounts.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    
    if (allStaff.some(s => s.id !== userId && s.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'This email is already in use by another account.' };
    }

    const updatedFields = {
      full_name: fullName.trim(),
      email: cleanEmail,
      role: role || 'staff',
      is_active: isActive !== undefined ? isActive : true,
      updated_at: new Date().toISOString()
    };

    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update(updatedFields)
          .eq('id', userId);
        if (error) throw error;
      } catch (err) {
        console.error('Supabase updateStaffAccount error:', err);
      }
    }

    setAllStaff(prev => prev.map(s => s.id === userId ? { ...s, ...updatedFields } : s));
    return { success: true };
  };

  const deleteStaffAccount = async (userId) => {
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only Admin can delete staff accounts.' };
    }

    if (userId === profile.id) {
      return { success: false, error: 'Cannot delete your own active admin account.' };
    }

    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);
        if (error) throw error;
      } catch (err) {
        console.error('Supabase deleteStaffAccount error:', err);
      }
    }

    setAllStaff(prev => prev.filter(s => s.id !== userId));
    return { success: true };
  };

  const isAdmin = profile?.role === 'admin' && profile?.is_active;
  const isStaff = (profile?.role === 'staff' || profile?.role === 'admin') && Boolean(profile?.is_active);
  const isAuthenticated = Boolean(profile && profile.is_active);

  return (
    <AuthContext.Provider
      value={{
        profile,
        isAdmin: Boolean(isAdmin),
        isStaff: Boolean(isStaff),
        isAuthenticated,
        isLoading,
        isDemoMode,
        allStaff,
        login,
        loginAsDemoUser,
        logout,
        createStaffAccount,
        toggleStaffStatus,
        updateStaffRole,
        updateStaffAccount,
        deleteStaffAccount,
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
