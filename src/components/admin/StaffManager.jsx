import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  UserPlus, 
  UserCheck, 
  UserX, 
  Lock, 
  Mail, 
  CheckCircle2, 
  X,
  KeyRound
} from 'lucide-react';

export const StaffManager = () => {
  const { allStaff, profile, createStaffAccount, toggleStaffStatus, updateStaffRole } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [password, setPassword] = useState('Staff@Gate2026');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleOpenModal = () => {
    setFullName('');
    setEmail('');
    setRole('staff');
    setPassword('Staff@Gate2026');
    setFormError(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim() || !email.trim()) {
      setFormError('Please enter full name and email.');
      return;
    }

    setIsSubmitting(true);
    const res = await createStaffAccount({
      fullName: fullName.trim(),
      email: email.trim(),
      role,
      password: password.trim()
    });
    setIsSubmitting(false);

    if (!res.success) {
      setFormError(res.error || 'Failed to create staff account');
    } else {
      setSuccessMsg(`Account created for ${fullName}!`);
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1200);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-100 flex items-center">
              <Users className="w-6 h-6 mr-2 text-amber-400" />
              Staff & Access Authorization
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Admin Exclusive
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Private Access Control: No public signup. Only Admin can create and authorize gate staff accounts.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-950/40 transition self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span>AUTHORIZE NEW STAFF</span>
        </button>
      </div>

      {/* Security Info Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-start space-x-3 text-xs text-slate-400">
        <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-slate-300 font-semibold">Row Level Security (RLS) Policy Active</p>
          <p>
            Deactivating a staff account immediately revokes access to all Supabase tables. Unauthenticated or deactivated users are rejected at the database level.
          </p>
        </div>
      </div>

      {/* Staff Members List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-200">
            Authorized Users ({allStaff.length})
          </h3>
          <span className="text-xs text-slate-400">
            {allStaff.filter(s => s.is_active).length} Active / {allStaff.filter(s => !s.is_active).length} Inactive
          </span>
        </div>

        <div className="divide-y divide-slate-800">
          {allStaff.map((staff) => {
            const isSelf = staff.id === profile?.id;

            return (
              <div 
                key={staff.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-850/50 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    staff.role === 'admin' 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {staff.full_name ? staff.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-200">
                        {staff.full_name}
                      </span>
                      {isSelf && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                          You
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center">
                        <Mail className="w-3 h-3 mr-1 text-slate-500" />
                        {staff.email}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-auto">
                  <select
                    value={staff.role}
                    disabled={isSelf}
                    onChange={(e) => updateStaffRole(staff.id, e.target.value)}
                    className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border focus:outline-none ${
                      staff.role === 'admin'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-slate-950 text-slate-300 border-slate-700'
                    } ${isSelf ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <option value="staff">STAFF (Gate Keeper)</option>
                    <option value="admin">ADMIN (Full Access)</option>
                  </select>

                  <button
                    disabled={isSelf}
                    onClick={() => toggleStaffStatus(staff.id, !staff.is_active)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                      staff.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                    } ${isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
                    title={isSelf ? 'Cannot deactivate yourself' : 'Toggle access'}
                  >
                    {staff.is_active ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        <span>Deactivated</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto">
            
            <div className="flex items-center justify-between px-6 py-4 bg-amber-950/40 border-b border-amber-900/30">
              <h2 className="text-base font-bold text-slate-100 flex items-center">
                <UserPlus className="w-5 h-5 mr-2 text-amber-400" />
                Authorize New Staff Account
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              
              {formError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Full Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. David Miller"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Email Address <span className="text-amber-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. staff.gate2@lorrytrackpro.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Role Permission
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="staff">STAFF (Record IN/OUT, search permitted history)</option>
                  <option value="admin">ADMIN (Full access, manage users, lorries, settings)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Temporary Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm font-mono text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Provide this password to the staff member to log in.</p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg transition"
                >
                  {isSubmitting ? 'Creating...' : 'Create Staff User'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
