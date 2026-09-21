import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  FiArrowLeft, FiCheck, FiX, FiLoader, FiAlertCircle,
  FiUser, FiMail, FiPhone, FiBriefcase, FiHash, FiCalendar,
  FiClock, FiEdit3, FiCopy, FiShield, FiImage, FiPower
} from 'react-icons/fi';
import { getUserByIdApi, updateUserApi, updateUserStatusApi } from '@/api/axios';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import { useConfirm } from '@/Context/ConfirmationContext';
import CopyButton from '@/components/ui/CopyButton';
import GmailLink from '@/components/ui/GmailLink';

const getUserFullName = (user) => {
  if (!user) return '';
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return user.name || 'User';
};

const getRoleBadgeClass = (role) => {
  switch ((role || '').toUpperCase()) {
    case 'ADMIN':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    case 'SALES_EXECUTIVE':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    case 'SALES_HEAD':
      return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
    case 'WAREHOUSE':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    case 'BILLING':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    default:
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  }
};

const formatRoleName = (role) => {
  if (!role) return 'N/A';
  return role.replace(/_/g, ' ');
};

const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (isNaN(date.getTime()) || date.getTime() === 0) return 'Never';

  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDateDDMMYYYY(date);
};

const UserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert: showGlobalAlert, confirm } = useConfirm();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Profile Modal State (PUT /users/{id})
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    role: 'SALES_EXECUTIVE',
    employeeCode: '',
    profileImage: '',
    isActive: true
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Fetch User Details via GET /users/{id}
  const fetchUserDetails = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    try {
      const response = await getUserByIdApi(id);
      let userData = null;

      if (response.data?.data) {
        userData = response.data.data;
      } else if (response.data && typeof response.data === 'object') {
        userData = response.data;
      }

      if (userData) {
        setUser(userData);
        setError('');
      } else {
        setError('User not found.');
      }
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      if (!isPoll) {
        setError(err.response?.data?.message || 'Failed to load user details.');
      }
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetails(false);
  }, [id]);

  // Open Edit Modal and prefill form
  const handleOpenEditModal = () => {
    if (!user) return;
    setEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      role: user.role || 'SALES_EXECUTIVE',
      employeeCode: user.employeeCode || '',
      profileImage: user.profileImage || '',
      isActive: user.isActive !== undefined ? user.isActive : true
    });
    setSaveError('');
    setEditModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Submit PATCH /users/{id}
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setSaveError('');

    if (!editForm.firstName.trim()) {
      return setSaveError('First name is required.');
    }
    if (!editForm.phone.trim()) {
      return setSaveError('Phone number is required.');
    }
    if (!editForm.employeeCode.trim()) {
      return setSaveError('Employee code is required.');
    }

    setSaving(true);
    try {
      const payload = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
        role: editForm.role,
        employeeCode: editForm.employeeCode.trim(),
        profileImage: editForm.profileImage.trim(),
        isActive: Boolean(editForm.isActive)
      };

      const res = await updateUserApi(id, payload);

      showGlobalAlert(res.data?.message || 'User profile updated successfully!', 'success');
      setEditModalOpen(false);

      // Refresh or update state directly
      if (res.data?.data) {
        setUser(res.data.data);
      } else {
        setUser(prev => ({ ...prev, ...payload }));
        fetchUserDetails(true);
      }
    } catch (err) {
      console.error('Update user error:', err);
      setSaveError(err.response?.data?.message || 'Failed to update user profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Quick Toggle Active/Inactive Status (PATCH /users/{id}/status)
  const handleToggleStatus = async () => {
    if (!user) return;
    const newStatus = !user.isActive;
    const actionText = newStatus ? 'activate' : 'deactivate';

    const isConfirmed = await confirm(`Are you sure you want to ${actionText} the account for "${getUserFullName(user)}"?`);
    if (!isConfirmed) return;

    try {
      const res = await updateUserStatusApi(id, newStatus);
      showGlobalAlert(res.data?.message || `User ${actionText}d successfully!`, 'success');
      setUser(prev => ({ ...prev, isActive: newStatus }));
    } catch (err) {
      console.error('Toggle status error:', err);
      showGlobalAlert(err.response?.data?.message || `Failed to ${actionText} user.`, 'error');
    }
  };

  const fullName = getUserFullName(user);
  const initials = user ? [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U' : '';

  return (
    <div className="relative space-y-6 min-h-full z-0 isolate w-full pb-12">

      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80 dark:border-white/10">
        <div>
          <button
            onClick={() => navigate('/users')}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-white/10 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <FiArrowLeft size={14} />
            <span>Back to Users</span>
          </button>
        </div>

        {user && (
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleToggleStatus}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                user.isActive
                  ? 'bg-rose-600/60 dark:bg-rose-500/10 hover:bg-rose-500/20 text-white dark:text-rose-400 border-rose-500/20'
                  : 'bg-emerald-600/60 dark:bg-emerald-500/10 hover:bg-emerald-500/20 text-white dark:text-emerald-400 border-emerald-500/20'
              }`}
            >
              <FiPower size={13} />
              <span>{user.isActive ? 'Deactivate' : 'Activate'}</span>
            </button>

            <button
              onClick={handleOpenEditModal}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <FiEdit3 size={14} />
              <span>Edit Profile</span>
            </button>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="h-72 flex flex-col justify-center items-center bg-white/40 dark:bg-slate-950/20 border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-xs">
          <FiLoader className="animate-spin text-3xl text-blue-600 dark:text-blue-400 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">Loading user details...</p>
        </div>
      ) : error ? (
        <div className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 p-6 rounded-3xl border border-rose-200 dark:border-rose-500/25 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-4">
            <FiAlertCircle className="text-2xl shrink-0" />
            <div>
              <p className="font-bold text-base text-rose-700 dark:text-rose-300">Error Loading User</p>
              <p className="text-xs text-rose-600/90 dark:text-rose-400/90 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchUserDetails(false)}
            className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : user ? (
        <div className="space-y-6">

          {/* Hero Profile Card */}
          <div className="relative bg-white/40 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-5">
                {/* User Avatar */}
                {user.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={fullName}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-slate-200 dark:border-white/10 shadow-md shrink-0"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white border border-blue-500/20 flex items-center justify-center text-2xl sm:text-3xl font-black shadow-md shadow-blue-500/20 shrink-0 select-none">
                    {initials}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {fullName}
                    </h2>

                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${getRoleBadgeClass(user.role)}`}>
                      {formatRoleName(user.role)}
                    </span>

                    {user.employeeCode && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold border border-slate-200 dark:border-white/10">
                        <FiHash className="text-[10px] text-slate-400" />
                        {user.employeeCode}
                      </span>
                    )}

                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <GmailLink email={user.email} showIcon={true} iconSize={13} className="text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium" />
                    </div>

                    {user.phone && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <FiPhone size={12} className="text-slate-400" />
                        <a href={`tel:${user.phone}`} className="text-slate-700 dark:text-slate-300 font-mono hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          {user.phone}
                        </a>
                        <CopyButton text={user.phone} size={11} title="Copy Phone Number" />
                      </div>
                    )}

                    {user.createdAt && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <FiCalendar size={12} className="text-slate-400" />
                        <span>Created {formatDateDDMMYYYY(user.createdAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Database ID Chip */}
              <div className="flex items-center gap-3 bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 rounded-2xl p-3.5 shadow-xs shrink-0">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Database ID</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 select-all truncate max-w-[160px]" title={user._id}>
                      {user._id}
                    </span>
                    <CopyButton text={user._id} size={11} title="Copy User ID" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Account Profile Card */}
            <div className="bg-white/40 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-xl dark:shadow-2xl backdrop-blur-xl space-y-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FiUser className="text-blue-600 dark:text-blue-400" />
                <span>Account Profile</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">First Name</span>
                  <p className="text-slate-900 dark:text-white font-semibold text-sm mt-1">{user.firstName || 'N/A'}</p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Last Name</span>
                  <p className="text-slate-900 dark:text-white font-semibold text-sm mt-1">{user.lastName || 'N/A'}</p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Role</span>
                  <p className="text-slate-900 dark:text-white font-semibold text-sm mt-1">{formatRoleName(user.role)}</p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Employee Code</span>
                  <p className="text-slate-900 dark:text-white font-semibold text-sm mt-1 font-mono">{user.employeeCode || 'N/A'}</p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl col-span-1 sm:col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Account Status</span>
                  <div className="mt-1">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active User
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Deactivated User
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Contact & Image Card */}
            <div className="bg-white/40 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-xl dark:shadow-2xl backdrop-blur-xl space-y-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FiMail className="text-blue-600 dark:text-blue-400" />
                <span>Contact & Media</span>
              </h3>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Email Address</span>
                    <div className="mt-1">
                      <GmailLink email={user.email} className="text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-sm font-semibold" />
                    </div>
                  </div>
                  <CopyButton text={user.email} />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Phone Number</span>
                    <p className="text-slate-900 dark:text-white font-semibold text-sm mt-1 font-mono">{user.phone || 'N/A'}</p>
                  </div>
                  {user.phone && <CopyButton text={user.phone} />}
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Profile Image URL</span>
                    <p className="text-slate-700 dark:text-slate-300 text-xs mt-1 truncate font-mono" title={user.profileImage || 'None'}>
                      {user.profileImage || 'No profile image URL provided'}
                    </p>
                  </div>
                  {user.profileImage && (
                    <img
                      src={user.profileImage}
                      alt="Profile preview"
                      className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-white/10 shrink-0"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Timestamps & Audit Card */}
            <div className="bg-white/40 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-xl dark:shadow-2xl backdrop-blur-xl space-y-4 md:col-span-2">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FiClock className="text-blue-600 dark:text-blue-400" />
                <span>Timestamps & Activity</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Created At</span>
                  <p className="text-slate-900 dark:text-white font-semibold text-xs mt-1 font-mono">
                    {user.createdAt ? formatDateTimeDDMMYYYY(user.createdAt) : 'N/A'}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                    {formatRelativeTime(user.createdAt)}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Last Updated</span>
                  <p className="text-slate-900 dark:text-white font-semibold text-xs mt-1 font-mono">
                    {user.updatedAt ? formatDateTimeDDMMYYYY(user.updatedAt) : 'N/A'}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                    {formatRelativeTime(user.updatedAt)}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Last Login</span>
                  <p className="text-slate-900 dark:text-white font-semibold text-xs mt-1 font-mono">
                    {user.lastLoginAt ? formatDateTimeDDMMYYYY(user.lastLoginAt) : 'Never logged in'}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                    {formatRelativeTime(user.lastLoginAt)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : null}

      {/* Edit User Modal (PATCH /users/{id}) */}
      {editModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 dark:bg-slate-950/50 backdrop-blur-lg animate-fade-in"
            onClick={() => !saving && setEditModalOpen(false)}
          />

          <div className="relative bg-white/40 dark:bg-slate-950/25 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/10 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FiEdit3 className="text-blue-600 dark:text-blue-400" />
                  <span>Edit User Profile</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Update personal details, role, employee code, and status.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setEditModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Error Message */}
            {saveError && (
              <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <FiAlertCircle className="shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Edit Form */}
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={editForm.firstName}
                    onChange={handleInputChange}
                    required
                    placeholder="First Name"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={editForm.lastName}
                    onChange={handleInputChange}
                    placeholder="Last Name"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleInputChange}
                    required
                    placeholder="+919876543210"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Role *</label>
                  <select
                    name="role"
                    value={editForm.role}
                    onChange={handleInputChange}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/50 outline-none cursor-pointer"
                  >
                    <option value="SALES_EXECUTIVE">Sales Executive</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Employee Code *</label>
                <input
                  type="text"
                  name="employeeCode"
                  value={editForm.employeeCode}
                  onChange={handleInputChange}
                  required
                  placeholder="SE-105"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Profile Image URL</label>
                <input
                  type="url"
                  name="profileImage"
                  value={editForm.profileImage}
                  onChange={handleInputChange}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  name="isActive"
                  checked={editForm.isActive}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="editIsActive" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Active Account Status
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
                >
                  {saving && <FiLoader className="animate-spin text-xs" />}
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default UserDetails;
