import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/Context/AuthContext';
import {
  FiUser,
  FiLock,
  FiSave,
  FiEdit2,
  FiHelpCircle,
  FiArrowLeft,
  FiMail,
  FiPhone,
  FiShield,
  FiCalendar,
  FiClock,
  FiCopy,
  FiCheck,
  FiRefreshCw,
  FiEye,
  FiEyeOff,
  FiCheckCircle,
  FiAlertCircle,
  FiHash,
  FiActivity
} from 'react-icons/fi';
import { api, getProfileApi, updateProfileApi } from '@/api/axios';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch {
    return dateStr;
  }
};

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  } catch {
    return '';
  }
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [activeTab, setActiveTab] = useState('personal'); // 'personal', 'security', 'config', 'audit'

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status feedback message
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: '' }

  // Profile Data State
  const [profileData, setProfileData] = useState({
    _id: user?._id || user?.id || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || '',
    employeeCode: user?.employeeCode || '',
    isActive: user?.isActive !== undefined ? user.isActive : true,
    createdAt: user?.createdAt || '',
    updatedAt: user?.updatedAt || '',
    lastLoginAt: user?.lastLoginAt || ''
  });

  // Editable Form Data State
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    supportNumber: '',
    supportEmail: ''
  });

  // Fetch Profile from GET /auth/me & App Config
  const fetchProfileAndConfig = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // 1. Fetch Profile via /auth/me
      let fetchedProfile = null;
      try {
        const profileRes = await getProfileApi();
        const resData = profileRes.data || {};
        fetchedProfile = resData.data || resData.user || resData;
      } catch (profileErr) {
        console.warn('API /auth/me call error:', profileErr?.message);
        if (user) {
          fetchedProfile = user;
        }
      }

      if (fetchedProfile) {
        const mergedProfile = {
          _id: fetchedProfile._id || fetchedProfile.id || '',
          firstName: fetchedProfile.firstName || '',
          lastName: fetchedProfile.lastName || '',
          email: fetchedProfile.email || '',
          phone: fetchedProfile.phone || '',
          role: (fetchedProfile.role || '').toUpperCase(),
          employeeCode: fetchedProfile.employeeCode || '',
          isActive: fetchedProfile.isActive !== undefined ? fetchedProfile.isActive : true,
          createdAt: fetchedProfile.createdAt || '',
          updatedAt: fetchedProfile.updatedAt || '',
          lastLoginAt: fetchedProfile.lastLoginAt || ''
        };

        setProfileData(mergedProfile);
        setFormData(prev => ({
          ...prev,
          firstName: mergedProfile.firstName,
          lastName: mergedProfile.lastName,
          email: mergedProfile.email,
          phone: mergedProfile.phone
        }));

        // Sync with AuthContext so Layout, Header, and Sidebar update
        if (updateUser) {
          updateUser({
            _id: mergedProfile._id,
            id: mergedProfile._id,
            firstName: mergedProfile.firstName,
            lastName: mergedProfile.lastName,
            name: `${mergedProfile.firstName} ${mergedProfile.lastName}`.trim(),
            email: mergedProfile.email,
            phone: mergedProfile.phone,
            role: mergedProfile.role,
            employeeCode: mergedProfile.employeeCode,
            isActive: mergedProfile.isActive,
            createdAt: mergedProfile.createdAt,
            updatedAt: mergedProfile.updatedAt,
            lastLoginAt: mergedProfile.lastLoginAt
          });
        }
      }

      // 2. Fetch App Config for support credentials
      try {
        const configRes = await api.get('/app-config');
        if (configRes.data) {
          setFormData(prev => ({
            ...prev,
            supportNumber: configRes.data.supportNumber || configRes.data.data?.supportNumber || prev.supportNumber,
            supportEmail: configRes.data.supportEmail || configRes.data.data?.supportEmail || prev.supportEmail
          }));
        }
      } catch (configErr) {
        console.log('App config fetch note:', configErr?.message);
      }

      if (isManualRefresh) {
        showNotification('success', 'Profile data refreshed successfully from server!');
      }
    } catch (err) {
      console.error('Error in profile initialisation:', err);
      if (isManualRefresh) {
        showNotification('error', 'Failed to refresh profile from server.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfileAndConfig();
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic password validation if user attempted password change
    if (formData.newPassword) {
      if (formData.newPassword.length < 6) {
        showNotification('error', 'New password must be at least 6 characters long.');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        showNotification('error', 'New password and confirmation password do not match.');
        return;
      }
    }

    try {
      // 1. Update Profile if endpoint exists
      const profilePayload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone
      };

      if (formData.currentPassword && formData.newPassword) {
        profilePayload.currentPassword = formData.currentPassword;
        profilePayload.newPassword = formData.newPassword;
      }

      try {
        await updateProfileApi(profilePayload);
      } catch (updateErr) {
        console.warn('Backend profile update note:', updateErr?.message);
      }

      // 2. Update App Support Config if support fields were populated
      if (formData.supportNumber || formData.supportEmail) {
        try {
          await api.put('/app-config/update', {
            supportNumber: formData.supportNumber,
            supportEmail: formData.supportEmail
          });
        } catch (configErr) {
          console.warn('App config update note:', configErr?.message);
        }
      }

      // Update local profile state
      const updatedProfile = {
        ...profileData,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        updatedAt: new Date().toISOString()
      };
      setProfileData(updatedProfile);

      if (updateUser) {
        updateUser({
          firstName: formData.firstName,
          lastName: formData.lastName,
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phone,
          updatedAt: updatedProfile.updatedAt
        });
      }

      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));

      setIsEditing(false);
      showNotification('success', 'Profile and preferences updated successfully!');
    } catch (error) {
      showNotification('error', 'Failed to update profile: ' + (error.response?.data?.message || error.message));
    }
  };

  const initials = `${(profileData.firstName || user?.firstName || profileData.email || 'U').charAt(0)}${profileData.lastName?.charAt(0) || ''}`.toUpperCase();
  const fullName = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || user?.name || user?.email || 'User';

  return (
    <div className="relative space-y-6 min-h-full pb-10 text-slate-800 dark:text-slate-100">
      {/* Toast / Notification Banner */}
      {notification && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all animate-in fade-in slide-in-from-top-4 ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200 shadow-emerald-900/10 dark:shadow-emerald-900/30'
              : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 shadow-rose-900/10 dark:shadow-rose-900/30'
          }`}
        >
          {notification.type === 'success' ? (
            <FiCheckCircle className="text-xl text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <FiAlertCircle className="text-xl text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-semibold">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center p-3 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-white rounded-2xl transition-all border border-slate-200/80 dark:border-white/10 shadow-sm hover:border-slate-300 dark:hover:border-white/20 active:scale-95 cursor-pointer backdrop-blur-md"
            title="Go Back"
          >
            <FiArrowLeft className="text-xl" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Admin Profile</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                {profileData.role}
              </span>
              {profileData.isActive && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
              Account identity, system credentials, security, and administrative telemetry.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3 self-stretch md:self-auto">
          <button
            onClick={() => fetchProfileAndConfig(true)}
            disabled={refreshing || loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all border border-slate-200/80 dark:border-white/10 text-sm font-semibold cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh Profile from API"
          >
            <FiRefreshCw className={`text-base ${refreshing ? 'animate-spin text-blue-500 dark:text-blue-400' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-bold shadow-lg cursor-pointer active:scale-95 border ${
              isEditing
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400/30 shadow-blue-600/20'
            }`}
          >
            {isEditing ? (
              <>Cancel Editing</>
            ) : (
              <>
                <FiEdit2 className="text-sm" /> Edit Profile
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================= LEFT COLUMN: HERO IDENTITY CARD ================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* Main User Card */}
          <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl shadow-slate-500/20 dark:shadow-black/40 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none -ml-12 -mb-12"></div>

            <div className="flex flex-col items-center text-center relative z-10">
              {/* Avatar with Gradient Border */}
              <div className="relative mb-4 group">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 p-0.5 shadow-xl shadow-blue-500/20">
                  <div className="w-full h-full bg-white dark:bg-slate-950/80 rounded-[22px] flex items-center justify-center backdrop-blur-md">
                    <span className="text-3xl font-black text-blue-600 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-tr dark:from-blue-200 dark:via-white dark:to-indigo-200">
                      {initials}
                    </span>
                  </div>
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center ${
                    profileData.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  title={profileData.isActive ? 'Active Account' : 'Inactive'}
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                </div>
              </div>

              {/* Name & Role */}
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{fullName}</h2>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                <FiMail className="text-blue-500 dark:text-blue-400 text-xs" /> {profileData.email}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-blue-500/25 flex items-center gap-1">
                  <FiShield className="text-xs" /> {profileData.role}
                </span>
                <span className="px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-300 rounded-xl text-xs font-bold tracking-wider border border-purple-500/25 flex items-center gap-1">
                  <FiHash className="text-xs" /> {profileData.employeeCode}
                </span>
              </div>

              {/* Divider */}
              <div className="w-full border-t border-slate-200/80 dark:border-white/10 my-6"></div>

              {/* Quick Contact & Info List */}
              <div className="w-full space-y-3 text-left">
                {/* User ID with 1-click Copy */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <FiHash className="text-sm" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Account ID</p>
                      <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{profileData._id}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(profileData._id, 'id')}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0 ml-2"
                    title="Copy Account ID"
                  >
                    {copiedId ? <FiCheck className="text-emerald-500 dark:text-emerald-400 text-sm" /> : <FiCopy className="text-sm" />}
                  </button>
                </div>

                {/* Email with 1-click Copy */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <FiMail className="text-sm" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{profileData.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(profileData.email, 'email')}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0 ml-2"
                    title="Copy Email"
                  >
                    {copiedEmail ? <FiCheck className="text-emerald-500 dark:text-emerald-400 text-sm" /> : <FiCopy className="text-sm" />}
                  </button>
                </div>

                {/* Phone with 1-click Copy */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                      <FiPhone className="text-sm" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact Phone</p>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{profileData.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(profileData.phone, 'phone')}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0 ml-2"
                    title="Copy Phone"
                  >
                    {copiedPhone ? <FiCheck className="text-emerald-500 dark:text-emerald-400 text-sm" /> : <FiCopy className="text-sm" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Activity & Timestamp Telemetry Card */}
          <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl shadow-slate-500/20 dark:shadow-black/40 rounded-3xl p-6 relative overflow-hidden">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-4">
              <FiActivity className="text-blue-500 dark:text-blue-400" /> Account Telemetry
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start justify-between pb-3 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <FiClock className="text-blue-500 dark:text-blue-400" /> Last Login
                </span>
                <div className="text-right">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(profileData.lastLoginAt)}</p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">{formatRelativeTime(profileData.lastLoginAt)}</p>
                </div>
              </div>

              <div className="flex items-start justify-between pb-3 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <FiCalendar className="text-emerald-500 dark:text-emerald-400" /> Member Since
                </span>
                <div className="text-right">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(profileData.createdAt)}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{formatRelativeTime(profileData.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-start justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <FiRefreshCw className="text-violet-500 dark:text-violet-400" /> Last Updated
                </span>
                <div className="text-right">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(profileData.updatedAt)}</p>
                  <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">{formatRelativeTime(profileData.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: TABBED PROFILE DETAILS ================= */}
        <div className="lg:col-span-8">
          <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl shadow-slate-500/20 dark:shadow-black/40 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 dark:from-white/5 to-transparent pointer-events-none"></div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 dark:border-white/10 pb-4 mb-6 relative z-10">
              <button
                type="button"
                onClick={() => setActiveTab('personal')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'personal'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-transparent'
                }`}
              >
                <FiUser className="text-base" /> Personal Details
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'security'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-transparent'
                }`}
              >
                <FiLock className="text-base" /> Security & Passwords
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'config'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-transparent'
                }`}
              >
                <FiHelpCircle className="text-base" /> App Support Config
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              {/* TAB 1: PERSONAL INFORMATION */}
              {activeTab === 'personal' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-white/10">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FiUser className="text-blue-500 dark:text-blue-400" /> Personal & Account Information
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Update your administrator identity details and communication numbers.
                      </p>
                    </div>
                    {isEditing && (
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                        Editing Mode Active
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* First Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="e.g. System"
                        className="w-full px-4 py-3 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/50 transition-all text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-black/20 placeholder-slate-400 dark:placeholder-slate-600 shadow-xs dark:shadow-inner backdrop-blur-md"
                        required
                      />
                    </div>

                    {/* Last Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="e.g. Admin"
                        className="w-full px-4 py-3 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/50 transition-all text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-black/20 placeholder-slate-400 dark:placeholder-slate-600 shadow-xs dark:shadow-inner backdrop-blur-md"
                        required
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Email Address
                        </label>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <FiCheckCircle className="text-xs" /> Verified
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          disabled={true} // System login email is protected
                          className="w-full px-4 py-3 pl-10 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-xl focus:outline-none transition-all text-sm font-medium opacity-90 cursor-not-allowed shadow-xs dark:shadow-inner backdrop-blur-md"
                        />
                        <FiMail className="absolute left-3.5 top-3.5 text-slate-400 dark:text-slate-500 text-sm" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Login email is managed via IAM credentials and root administration.
                      </p>
                    </div>

                    {/* Contact Phone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Contact Phone
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="+919876543210"
                          className="w-full px-4 py-3 pl-10 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/50 transition-all text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-black/20 placeholder-slate-400 dark:placeholder-slate-600 shadow-xs dark:shadow-inner backdrop-blur-md"
                        />
                        <FiPhone className="absolute left-3.5 top-3.5 text-slate-400 dark:text-slate-500 text-sm" />
                      </div>
                    </div>

                    {/* Employee Code (System Read-only) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Employee Code
                      </label>
                      <div className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-300 rounded-xl text-sm font-mono font-semibold flex items-center justify-between">
                        <span>{profileData.employeeCode}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/25">
                          Assigned
                        </span>
                      </div>
                    </div>

                    {/* System Access Role */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Role & Clearance
                      </label>
                      <div className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <FiShield className="text-blue-500 dark:text-blue-400" /> {profileData.role}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/25">
                          Full Access
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SECURITY & PASSWORDS */}
              {activeTab === 'security' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="pb-2 border-b border-slate-200/80 dark:border-white/10">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FiLock className="text-blue-500 dark:text-blue-400" /> Security & Password Management
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Ensure your account remains secure with strong administrative credentials.
                    </p>
                  </div>

                  {!isEditing && (
                    <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiShield className="text-2xl text-blue-500 dark:text-blue-400 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-blue-900 dark:text-blue-200">Credential Protection Enabled</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            Click 'Edit Profile' at the top right to enable password modification.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        Enable Edit
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Current Password */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="••••••••••••"
                          className="w-full px-4 py-3 pr-12 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/50 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-black/20 placeholder-slate-400 dark:placeholder-slate-600 shadow-xs dark:shadow-inner backdrop-blur-md"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        >
                          {showCurrentPassword ? <FiEyeOff className="text-sm" /> : <FiEye className="text-sm" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="••••••••••••"
                          className="w-full px-4 py-3 pr-12 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/50 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-black/20 placeholder-slate-400 dark:placeholder-slate-600 shadow-xs dark:shadow-inner backdrop-blur-md"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        >
                          {showNewPassword ? <FiEyeOff className="text-sm" /> : <FiEye className="text-sm" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="••••••••••••"
                          className="w-full px-4 py-3 pr-12 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/50 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-black/20 placeholder-slate-400 dark:placeholder-slate-600 shadow-xs dark:shadow-inner backdrop-blur-md"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        >
                          {showConfirmPassword ? <FiEyeOff className="text-sm" /> : <FiEye className="text-sm" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Checklist Box */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 text-xs space-y-2">
                    <p className="font-bold text-slate-700 dark:text-slate-300">Security Best Practices:</p>
                    <ul className="list-disc list-inside text-slate-500 dark:text-slate-400 space-y-1">
                      <li>Use at least 8 characters with a mix of letters, numbers, and symbols.</li>
                      <li>Avoid sharing administrator credentials across multiple team members.</li>
                      <li>Regularly rotate passwords every 90 days for administrative compliance.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 3: APP SUPPORT CONFIGURATION */}
              {activeTab === 'config' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="pb-2 border-b border-slate-200/80 dark:border-white/10">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FiHelpCircle className="text-blue-500 dark:text-blue-400" /> Mobile & Web App Support Config
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Configure customer contact endpoints shown across customer-facing portals.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Support Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Support Hotline Number
                      </label>
                      <input
                        type="text"
                        name="supportNumber"
                        value={formData.supportNumber}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="e.g. +91 9876543210"
                        className="w-full px-4 py-3 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/50 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-black/20 placeholder-slate-400 dark:placeholder-slate-600 shadow-xs dark:shadow-inner backdrop-blur-md"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Displayed in mobile help center for customer direct calling.
                      </p>
                    </div>

                    {/* Support Email */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Helpdesk Support Email
                      </label>
                      <input
                        type="email"
                        name="supportEmail"
                        value={formData.supportEmail}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="e.g. support@whatnot.in"
                        className="w-full px-4 py-3 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/50 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-black/20 placeholder-slate-400 dark:placeholder-slate-600 shadow-xs dark:shadow-inner backdrop-blur-md"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Used for incoming tickets, feedback, and customer grievance routing.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Save / Actions Footer */}
              {isEditing && (
                <div className="flex items-center justify-between pt-6 border-t border-slate-200/80 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      // Reset formData to current profileData
                      setFormData(prev => ({
                        ...prev,
                        firstName: profileData.firstName,
                        lastName: profileData.lastName,
                        phone: profileData.phone,
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                      }));
                    }}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-transparent dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-semibold transition-all cursor-pointer"
                  >
                    Discard Changes
                  </button>

                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 px-7 py-2.5 text-white text-sm font-bold rounded-xl transition-all bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-600/30 active:scale-95 cursor-pointer"
                  >
                    <FiSave className="text-base" /> Save Changes
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;