import React, { useState } from 'react';
import { useLorryData } from '../../context/LorryDataContext';
import { useAuth } from '../../context/AuthContext';
import { VEHICLE_TYPES } from '../../constants';
import { formatLorryNumber } from '../../utils/vehicleFormatter';
import { TipperTruckIcon } from '../common/TipperTruckIcon';
import { 
  Search, 
  Plus, 
  Edit3, 
  Building, 
  Phone, 
  User, 
  X
} from 'lucide-react';

export const LorriesDirectory = () => {
  const { lorries, addOrUpdateLorry } = useLorryData();
  const { isAdmin } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLorry, setEditingLorry] = useState(null);

  const [plateNumber, setPlateNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [vehicleType, setVehicleType] = useState('10-Wheeler');
  const [defaultDriverName, setDefaultDriverName] = useState('');
  const [defaultDriverPhone, setDefaultDriverPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState(null);

  const handleOpenAdd = () => {
    setEditingLorry(null);
    setPlateNumber('');
    setTransporterName('');
    setVehicleType('10-Wheeler');
    setDefaultDriverName('');
    setDefaultDriverPhone('');
    setNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lorry) => {
    setEditingLorry(lorry);
    setPlateNumber(lorry.plate_number);
    setTransporterName(lorry.transporter_name || '');
    setVehicleType(lorry.vehicle_type || '10-Wheeler');
    setDefaultDriverName(lorry.default_driver_name || '');
    setDefaultDriverPhone(lorry.default_driver_phone || '');
    setNotes(lorry.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const normPlate = (plateNumber || '').trim().toUpperCase();
    if (!normPlate) {
      setFormError('Plate number is required.');
      return;
    }

    const res = await addOrUpdateLorry({
      plate_number: normPlate,
      transporter_name: transporterName.trim() || 'Direct / Unknown',
      vehicle_type: vehicleType,
      default_driver_name: defaultDriverName.trim(),
      default_driver_phone: defaultDriverPhone.trim(),
      notes: notes.trim()
    });

    if (!res.success) {
      setFormError(res.error || 'Failed to save lorry');
    } else {
      setIsModalOpen(false);
    }
  };

  const filtered = lorries.filter(l => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      l.plate_number.toLowerCase().includes(q) ||
      (l.transporter_name && l.transporter_name.toLowerCase().includes(q)) ||
      (l.default_driver_name && l.default_driver_name.toLowerCase().includes(q)) ||
      (l.vehicle_type && l.vehicle_type.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      
      {/* View Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-100 flex items-center">
              <TipperTruckIcon className="w-6 h-6 mr-2 text-emerald-400" />
              Registered Lorries Directory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {lorries.length} Fleet
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Master registry of authorized vehicles, transporter fleets, and total completed visits.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-xs shadow-md shadow-emerald-950/40 transition self-start md:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>ADD NEW LORRY</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by plate, transporter, or vehicle type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <TipperTruckIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No Lorries Found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or register a new lorry.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((l) => (
            <div
              key={l.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-base font-extrabold text-slate-100 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 tracking-wider">
                      {l.plate_number}
                    </span>
                    <p className="text-xs font-semibold text-slate-300 mt-2 flex items-center">
                      <Building className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      {l.transporter_name || 'Direct / Independent'}
                    </p>
                  </div>

                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                    l.is_currently_inside 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {l.is_currently_inside ? 'Inside Now' : 'Off-Premises'}
                  </span>
                </div>

                <div className="mt-4 bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vehicle Type:</span>
                    <span className="font-medium text-slate-200">{l.vehicle_type || 'Standard'}</span>
                  </div>

                  {l.default_driver_name && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex items-center">
                        <User className="w-3 h-3 mr-1" /> Default Driver:
                      </span>
                      <span className="font-medium text-slate-200">{l.default_driver_name}</span>
                    </div>
                  )}

                  {l.default_driver_phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex items-center">
                        <Phone className="w-3 h-3 mr-1" /> Phone:
                      </span>
                      <span className="text-slate-300">{l.default_driver_phone}</span>
                    </div>
                  )}

                  {l.notes && (
                    <div className="pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                      {l.notes}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider block">
                    Lifetime Completed Visits
                  </span>
                  <span className="text-sm font-extrabold font-mono text-emerald-400">
                    {l.total_completed_visits || 0} visits
                  </span>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => handleOpenEdit(l)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Edit Lorry Details"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
            
            <div className="flex items-center justify-between px-6 py-4 bg-slate-850 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100 flex items-center">
                <TipperTruckIcon className="w-5 h-5 mr-2 text-emerald-400" />
                {editingLorry ? 'Edit Lorry Details' : 'Register New Lorry'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Plate Number <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TN 21 BV 1234"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(formatLorryNumber(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold uppercase text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Transporter Company
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Blue Dart Logistics"
                    value={transporterName}
                    onChange={(e) => setTransporterName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {VEHICLE_TYPES.map(vt => (
                      <option key={vt} value={vt}>{vt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Default Driver Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={defaultDriverName}
                    onChange={(e) => setDefaultDriverName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Default Driver Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98450 12345"
                    value={defaultDriverPhone}
                    onChange={(e) => setDefaultDriverPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Notes / Vehicle Specifications
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Heavy container rated, GPS tracking installed"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-bold shadow-lg transition"
                >
                  Save Lorry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
