import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  FiUser,
  FiLock,
  FiSave,
  FiEdit2,
  FiMail,
  FiPhone,
  FiShield,
  FiCalendar,
  FiClock,
  FiRefreshCw,
  FiEye,
  FiEyeOff,
  FiCheckCircle,
  FiAlertCircle,
  FiActivity,
  FiUsers,
  FiBriefcase,
  FiShoppingBag,
  FiGlobe,
  FiKey,
  FiLayers,
  FiImage,
  FiPhoneCall,
  FiCamera,
  FiXCircle,
  FiSearch,
  FiCheck,
  FiX,
  FiExternalLink
} from 'react-icons/fi';
import {
  getProfileApi,
  getAdminProfileActivityApi,
  patchAdminProfileApi,
  putAdminProfileApi,
  changeAdminPasswordApi,
  uploadAdminAvatarApi
} from '@/api/axios';
import {
  PageHeader,
  SegmentedTabs,
  StatusBadge,
  CopyButton,
  GmailLink,
  Card,
  EmptyState
} from '@/components/ui';
import { ProfileSkeleton } from '@/components/ui/Skeleton';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import { formatPhone } from '@/utils/formatters';

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
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDateDDMMYYYY(dateStr);
  } catch {
    return '';
  }
};

const PERMISSION_DETAILS = {
  MANAGE_USERS: {
    title: 'User Management',
    desc: 'Create, modify, and assign credentials and access roles across administrators and sales executives.'
  },
  MANAGE_FIRMS: {
    title: 'Firm Administration',
    desc: 'Oversee registered commercial firms, modify enterprise details, and configure credit profiles.'
  },
  APPROVE_FIRMS: {
    title: 'Firm Verification & Approval',
    desc: 'Review submitted firm KYC documentation, assign operational credit limits, and authorize trading.'
  },
  MANAGE_PURCHASE_ORDERS: {
    title: 'Purchase Order Oversight',
    desc: 'Full administrative authority to evaluate, approve, dispatch, and regulate commercial purchase orders.'
  },
  VIEW_REPORTS: {
    title: 'Analytics & Reporting',
    desc: 'Access consolidated administrative dashboards, revenue trends, fulfillment velocity, and sales metrics.'
  }
};

const DEFAULT_PROFILE = {
  _id: '',
  id: '',
  firstName: 'System',
  lastName: 'Admin',
  fullName: 'System Admin',
  email: 'admin@whatnot.in',
  phone: '+919876543210',
  role: 'ADMIN',
  profileImage: '',
  avatar: '',
  reportingManager: 'Board of Directors',
  territory: 'All Territories (National)',
  emergencyContact: '+919811223344',
  assignedCompanyIds: [],
  companies: [],
  isActive: true,
  permissions: [
    'MANAGE_USERS',
    'MANAGE_FIRMS',
    'APPROVE_FIRMS',
    'MANAGE_PURCHASE_ORDERS',
    'VIEW_REPORTS'
  ],
  stats: {
    totalSalesExecutives: 0,
    totalFirms: 0,
    pendingOnboardings: 0,
    totalPurchaseOrders: 0,
    pendingOrders: 0
  },
  lastLoginAt: '',
  createdAt: '',
  updatedAt: ''
};

const Profile = () => {
  const { user: authUser, updateUser } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  // Core Data States
  const [profileData, setProfileData] = useState(DEFAULT_PROFILE);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Edit Profile Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    profileImage: '',
    reportingManager: '',
    territory: '',
    emergencyContact: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Activity Tab Filters
  const [activitySearch, setActivitySearch] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState('ALL');

  // Security / Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Sync state helper
  const syncProfileToForm = (data) => {
    setFormData({
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone || '',
      profileImage: data.profileImage || data.avatar || '',
      reportingManager: data.reportingManager || '',
      territory: data.territory || '',
      emergencyContact: data.emergencyContact || ''
    });
  };

  // Fetch Profile Data
  const fetchProfile = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await getProfileApi();
      const payload = res.data?.data || res.data?.user || res.data || {};

      const merged = {
        ...DEFAULT_PROFILE,
        ...payload,
        stats: {
          ...DEFAULT_PROFILE.stats,
          ...(payload.stats || {})
        },
        permissions: Array.isArray(payload.permissions) && payload.permissions.length > 0
          ? payload.permissions
          : DEFAULT_PROFILE.permissions,
        companies: Array.isArray(payload.companies)
          ? payload.companies
          : DEFAULT_PROFILE.companies
      };

      setProfileData(merged);
      syncProfileToForm(merged);
      setImgError(false);

      if (updateUser) {
        updateUser({
          ...merged,
          name: merged.fullName || `${merged.firstName} ${merged.lastName}`.trim(),
          avatar: merged.profileImage || merged.avatar
        });
      }
    } catch (err) {
      console.error('Error fetching admin profile:', err);
      toast.error(err.response?.data?.message || 'Failed to load profile details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch Activity Timeline
  const fetchActivities = async () => {
    setActivitiesLoading(true);
    try {
      const res = await getAdminProfileActivityApi();
      const items = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
      setActivities(items);
    } catch (err) {
      console.warn('Could not fetch activity timeline:', err);
    } finally {
      setActivitiesLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchActivities();
  }, []);

  // Avatar Upload Handler
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Avatar file size must be less than 10MB.');
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload an image file (JPEG, PNG, WEBP).');
      return;
    }

    setUploadingAvatar(true);
    try {
      const res = await uploadAdminAvatarApi(file);
      const resData = res.data || {};
      const payload = resData.data || resData.user || resData;

      const newAvatarUrl =
        payload.avatarUrl ||
        payload.avatar ||
        payload.profileImage ||
        payload.url ||
        payload.imageUrl ||
        resData.avatarUrl ||
        resData.avatar ||
        resData.profileImage ||
        resData.url;

      if (newAvatarUrl) {
        setProfileData((prev) => ({
          ...prev,
          profileImage: newAvatarUrl,
          avatar: newAvatarUrl
        }));
        setFormData((prev) => ({
          ...prev,
          profileImage: newAvatarUrl
        }));
        setImgError(false);

        if (updateUser) {
          updateUser({
            profileImage: newAvatarUrl,
            avatar: newAvatarUrl
          });
        }
      }

      toast.success(resData.message || 'Avatar updated successfully!');
    } catch (err) {
      console.error('Error uploading avatar:', err);
      toast.error(err.response?.data?.message || 'Failed to upload avatar image.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Form Field Change Handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'phone' || name === 'emergencyContact') {
      formattedValue = formatPhone(value);
    }
    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue
    }));
  };

  // Profile Save Handler (PATCH / PUT)
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);

    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      profileImage: formData.profileImage.trim(),
      reportingManager: formData.reportingManager.trim(),
      territory: formData.territory.trim(),
      emergencyContact: formData.emergencyContact.trim()
    };

    try {
      let res;
      try {
        res = await patchAdminProfileApi(payload);
      } catch (patchErr) {
        if (patchErr.response?.status === 405 || patchErr.response?.status === 404) {
          res = await putAdminProfileApi(payload);
        } else {
          throw patchErr;
        }
      }

      const resData = res.data || {};
      const updated = resData.data || resData.user || resData;

      setProfileData((prev) => ({
        ...prev,
        ...payload,
        ...(typeof updated === 'object' ? updated : {})
      }));

      setIsEditing(false);

      if (updateUser) {
        updateUser({
          ...payload,
          name: `${payload.firstName} ${payload.lastName}`.trim()
        });
      }

      toast.success(resData.message || 'Profile information updated successfully!');
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error(err.response?.data?.message || 'Failed to update profile information.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Password Change Handler
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!passwordForm.currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (!passwordForm.newPassword) {
      toast.error('Please enter your new password.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password and confirmation password do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await changeAdminPasswordApi({
        currentPassword: passwordForm.currentPassword,
        oldPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      toast.success(res.data?.message || 'Password changed successfully!');
    } catch (err) {
      console.error('Error changing password:', err);
      toast.error(
        err.response?.data?.message ||
        'Failed to update password. Please check your current password.'
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const matchesType =
        activityTypeFilter === 'ALL' || act.type === activityTypeFilter;
      const matchesSearch =
        !activitySearch.trim() ||
        (act.title && act.title.toLowerCase().includes(activitySearch.toLowerCase())) ||
        (act.details && act.details.toLowerCase().includes(activitySearch.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [activities, activityTypeFilter, activitySearch]);

  // Derived user display properties
  const displayName =
    profileData.fullName ||
    `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() ||
    'System Administrator';

  const avatarUrl = profileData.profileImage || profileData.avatar;
  const initials = `${profileData.firstName?.[0] || 'A'}${profileData.lastName?.[0] || ''}`.toUpperCase();

  // Tabs configuration for SegmentedTabs
  const tabs = [
    { id: 'overview', label: 'Overview & Info', icon: FiUser },
    { id: 'activity', label: 'Activity Timeline', icon: FiActivity, count: activities.length },
    { id: 'permissions', label: 'Permissions', icon: FiShield, count: profileData.permissions?.length || 0 },
    { id: 'companies', label: 'Assigned Companies', icon: FiLayers, count: profileData.companies?.length || 0 },
    { id: 'security', label: 'Security & Password', icon: FiLock }
  ];

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader
          title="Admin Profile"
          icon={FiShield}
          subtitle="Loading your profile credentials and organizational configuration..."
        />
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <PageHeader
        title="Admin Profile"
        icon={FiShield}
        subtitle="Manage your personal credentials, organizational assignments, security settings, and audit activity."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchProfile(true);
                fetchActivities();
              }}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-xs"
              title="Refresh Profile Data"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Hero Banner: Profile Identity & Metadata */}
      <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 shadow-xl shadow-slate-900/5">
        {/* Subtle Decorative Ambient Background Glow */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-blue-500/10 dark:bg-blue-600/10 filter blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-purple-500/10 dark:bg-purple-600/10 filter blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Avatar + Main Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
            {/* Avatar with Camera upload button */}
            <div className="relative shrink-0 group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-xl bg-white flex items-center justify-center text-white text-3xl font-black">
                {avatarUrl && !imgError ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>

              {/* Status Ring / Indicator */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-md">
                <span className={`w-3.5 h-3.5 rounded-full ${profileData.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Camera Upload Overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-2xl bg-black/50 backdrop-blur-xs text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                title="Change Avatar Image"
              >
                {uploadingAvatar ? (
                  <FiRefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <FiCamera className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                  </>
                )}
              </button>
            </div>

            {/* Profile Credentials */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {displayName}
                </h1>
                <StatusBadge status={profileData.role || 'ADMIN'} size="sm" />
                <StatusBadge status={profileData.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
              </div>

              {/* Meta Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {profileData.email && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <FiMail className="text-blue-500 shrink-0" />
                    <GmailLink
                      email={profileData.email}
                      copySize={12}
                      className="truncate max-w-xs hover:underline"
                    />
                  </div>
                )}

                {profileData.phone && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <FiPhone className="text-emerald-500 shrink-0" />
                    <span>{profileData.phone}</span>
                    <CopyButton text={profileData.phone} size={12} />
                  </div>
                )}

                {profileData.territory && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <FiGlobe className="text-purple-500 shrink-0" />
                    <span>{profileData.territory}</span>
                  </div>
                )}

                {profileData.reportingManager && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <FiBriefcase className="text-amber-500 shrink-0" />
                    <span>Reports to: {profileData.reportingManager}</span>
                  </div>
                )}

                {profileData.emergencyContact && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200/80 dark:border-rose-500/20 text-xs font-semibold text-rose-700 dark:text-rose-400">
                    <FiPhoneCall className="text-rose-500 shrink-0" />
                    <span>Emergency SOS: {profileData.emergencyContact}</span>
                    <CopyButton text={profileData.emergencyContact} size={12} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right ID & Timestamp Badges */}
          <div className="flex md:flex-col items-start md:items-end justify-between w-full md:w-auto gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-slate-200/80 dark:border-white/10">
            {profileData._id && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono text-[11px] bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-slate-200/80 dark:border-white/10">
                  ID: {profileData._id}
                </span>
                <CopyButton text={profileData._id} size={12} />
              </div>
            )}

            {profileData.lastLoginAt && (
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400" title={formatDateTimeDDMMYYYY(profileData.lastLoginAt)}>
                <FiClock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Last Login: <strong>{formatRelativeTime(profileData.lastLoginAt)}</strong></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Sales Executives */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-md relative overflow-hidden group hover:shadow-lg transition-all duration-200 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="kpi-card-title text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Sales Executives
            </span>
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl kpi-icon-blue flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
              <FiUsers />
            </span>
          </div>
          <div>
            <p className="kpi-card-value text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate font-mono">
              {profileData.stats?.totalSalesExecutives ?? 0}
            </p>
            <p className="kpi-card-subtitle text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              Active field workforce
            </p>
          </div>
        </div>

        {/* Total Firms */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-md relative overflow-hidden group hover:shadow-lg transition-all duration-200 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="kpi-card-title text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Total Firms
            </span>
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl kpi-icon-emerald flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
              <FiBriefcase />
            </span>
          </div>
          <div>
            <p className="kpi-card-value text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate font-mono">
              {profileData.stats?.totalFirms ?? 0}
            </p>
            <p className="kpi-card-subtitle text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              Registered enterprises
            </p>
          </div>
        </div>

        {/* Pending Onboardings */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-md relative overflow-hidden group hover:shadow-lg transition-all duration-200 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="kpi-card-title text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Pending Onboarding
            </span>
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl kpi-icon-amber flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
              <FiClock />
            </span>
          </div>
          <div>
            <p className="kpi-card-value text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate font-mono">
              {profileData.stats?.pendingOnboardings ?? 0}
            </p>
            <p className="kpi-card-subtitle text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              Awaiting KYC review
            </p>
          </div>
        </div>

        {/* Total Purchase Orders */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-md relative overflow-hidden group hover:shadow-lg transition-all duration-200 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="kpi-card-title text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Total POs
            </span>
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl kpi-icon-purple flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
              <FiShoppingBag />
            </span>
          </div>
          <div>
            <p className="kpi-card-value text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate font-mono">
              {profileData.stats?.totalPurchaseOrders ?? 0}
            </p>
            <p className="kpi-card-subtitle text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              Consolidated procurement
            </p>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-md relative overflow-hidden group hover:shadow-lg transition-all duration-200 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="kpi-card-title text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Pending POs
            </span>
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl kpi-icon-rose flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
              <FiAlertCircle />
            </span>
          </div>
          <div>
            <p className="kpi-card-value text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate font-mono">
              {profileData.stats?.pendingOrders ?? 0}
            </p>
            <p className="kpi-card-subtitle text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              Needs review & dispatch
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <SegmentedTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ========================================================
          TAB 1: OVERVIEW & PERSONAL INFORMATION
          ======================================================== */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* Main Edit Form (8 cols) */}
          <div className="lg:col-span-8 rounded-3xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-7 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200/80 dark:border-white/10 mb-6 gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Personal & Organizational Details
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Update your contact details, administrative assignments, and profile metadata.
                </p>
              </div>

              {/* Edit / Save Actions on Top Right */}
              <div className="flex items-center gap-2 shrink-0">
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all cursor-pointer shadow-xs hover:shadow-md"
                  >
                    <FiEdit2 className="w-3.5 h-3.5" />
                    <span>Edit Details</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        syncProfileToForm(profileData);
                        setIsEditing(false);
                      }}
                      disabled={savingProfile}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <FiX className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="submit"
                      form="profile-form"
                      disabled={savingProfile}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                    >
                      {savingProfile ? (
                        <>
                          <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <FiSave className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <form id="profile-form" onSubmit={handleProfileSave} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      required
                      placeholder="e.g. System"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${!isEditing
                        ? 'border-slate-200/60 dark:border-white/5 bg-slate-50/70 dark:bg-white/2 text-slate-700 dark:text-slate-300 cursor-not-allowed'
                        : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                        }`}
                    />
                  </div>
                </div>

                {/* Last Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      required
                      placeholder="e.g. Admin"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${!isEditing
                        ? 'border-slate-200/60 dark:border-white/5 bg-slate-50/70 dark:bg-white/2 text-slate-700 dark:text-slate-300 cursor-not-allowed'
                        : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                        }`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      required
                      placeholder="admin@whatnot.in"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${!isEditing
                        ? 'border-slate-200/60 dark:border-white/5 bg-slate-50/70 dark:bg-white/2 text-slate-700 dark:text-slate-300 cursor-not-allowed'
                        : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                        }`}
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Phone Number
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="+91 98765 43210"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${!isEditing
                        ? 'border-slate-200/60 dark:border-white/5 bg-slate-50/70 dark:bg-white/2 text-slate-700 dark:text-slate-300 cursor-not-allowed'
                        : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                        }`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Reporting Manager */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Reporting Manager
                  </label>
                  <div className="relative">
                    <FiBriefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="reportingManager"
                      value={formData.reportingManager}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="e.g. Board of Directors"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${!isEditing
                        ? 'border-slate-200/60 dark:border-white/5 bg-slate-50/70 dark:bg-white/2 text-slate-700 dark:text-slate-300 cursor-not-allowed'
                        : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                        }`}
                    />
                  </div>
                </div>

                {/* Territory */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Territory
                  </label>
                  <div className="relative">
                    <FiGlobe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="territory"
                      value={formData.territory}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="e.g. All Territories (National)"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${!isEditing
                        ? 'border-slate-200/60 dark:border-white/5 bg-slate-50/70 dark:bg-white/2 text-slate-700 dark:text-slate-300 cursor-not-allowed'
                        : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                        }`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Emergency Contact */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Emergency Contact (SOS)
                  </label>
                  <div className="relative">
                    <FiPhoneCall className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="+91 98112 23344"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${!isEditing
                        ? 'border-slate-200/60 dark:border-white/5 bg-slate-50/70 dark:bg-white/2 text-slate-700 dark:text-slate-300 cursor-not-allowed'
                        : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                        }`}
                    />
                  </div>
                </div>

                {/* Profile Image URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Profile Image URL
                  </label>
                  <div className="relative">
                    <FiImage className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="url"
                      name="profileImage"
                      value={formData.profileImage}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="https://... or upload above"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${!isEditing
                        ? 'border-slate-200/60 dark:border-white/5 bg-slate-50/70 dark:bg-white/2 text-slate-700 dark:text-slate-300 cursor-not-allowed'
                        : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                        }`}
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons (Visible when editing) */}
              {isEditing && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      syncProfileToForm(profileData);
                      setIsEditing(false);
                    }}
                    disabled={savingProfile}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => syncProfileToForm(profileData)}
                    disabled={savingProfile}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Reset Form
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <>
                        <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <FiSave className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Side Info Cards (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Account Details Card */}
            <div className="rounded-3xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 p-6 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FiShield className="text-blue-500" />
                <span>Account Specification</span>
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400">Account Role</span>
                  <StatusBadge status={profileData.role || 'ADMIN'} size="sm" />
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400">System Status</span>
                  <StatusBadge status={profileData.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400">Registration Date</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatDateDDMMYYYY(profileData.createdAt) || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400">Last Profile Update</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatDateDDMMYYYY(profileData.updatedAt) || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Assigned Companies</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {profileData.companies?.length || 0} Enterprises
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Security Prompt */}
            <div className="rounded-3xl bg-linear-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border border-blue-200/70 dark:border-blue-500/20 p-6 space-y-3">
              <div className="flex items-center gap-2.5 text-blue-700 dark:text-blue-400 font-bold text-sm">
                <FiLock className="w-4 h-4" />
                <span>Security Reminder</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                As a national administrator, your credentials carry critical operational permissions.
                Ensure you rotate passwords periodically and never share administrative credentials.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline pt-1 cursor-pointer"
              >
                <span>Change Password</span>
                <FiExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: ACTIVITY TIMELINE
          ======================================================== */}
      {activeTab === 'activity' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm">
            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActivityTypeFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activityTypeFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                All Activities ({activities.length})
              </button>
              <button
                type="button"
                onClick={() => setActivityTypeFilter('PURCHASE_ORDER_REVIEW')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activityTypeFilter === 'PURCHASE_ORDER_REVIEW'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                Purchase Orders
              </button>
              <button
                type="button"
                onClick={() => setActivityTypeFilter('FIRM_REVIEW')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activityTypeFilter === 'FIRM_REVIEW'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                Firm Reviews
              </button>
            </div>

            {/* Search Input */}
            <div className="relative sm:w-72">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Search audit trail..."
                className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              {activitySearch && (
                <button
                  type="button"
                  onClick={() => setActivitySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Activity Stream Container */}
          <div className="rounded-3xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 p-6 shadow-sm">
            {activitiesLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <FiRefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs font-semibold">Loading activity stream...</span>
              </div>
            ) : filteredActivities.length === 0 ? (
              <EmptyState
                icon={FiActivity}
                title="No activities recorded"
                description={
                  activitySearch || activityTypeFilter !== 'ALL'
                    ? 'No matching activities found for the selected filter.'
                    : 'There are no logged administrative actions recorded for this account yet.'
                }
              />
            ) : (
              <div className="space-y-4">
                {filteredActivities.map((act, index) => {
                  const isPO = act.type === 'PURCHASE_ORDER_REVIEW';
                  const isApproved = act.title?.includes('APPROVED');
                  const isRejected = act.title?.includes('REJECTED');
                  const isDispatched = act.title?.includes('DISPATCHED');

                  return (
                    <div
                      key={index}
                      className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 hover:border-blue-500/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 ${isPO
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                          {isPO ? <FiShoppingBag /> : <FiBriefcase />}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {act.title}
                            </span>
                            {isApproved && <StatusBadge status="APPROVED" size="sm" />}
                            {isRejected && <StatusBadge status="REJECTED" size="sm" />}
                            {isDispatched && <StatusBadge status="DISPATCHED" size="sm" />}
                          </div>

                          {act.details && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {act.details}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0 self-end sm:self-center">
                        <FiClock className="w-3.5 h-3.5" />
                        <span title={formatDateTimeDDMMYYYY(act.timestamp)}>
                          {formatRelativeTime(act.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: PERMISSIONS
          ======================================================== */}
      {activeTab === 'permissions' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Authorized Role Permissions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                These privileges are granted by system role ({profileData.role || 'ADMIN'}) across all commercial operations.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {profileData.permissions?.length || 0} Active Keys
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profileData.permissions?.map((permKey) => {
              const meta = PERMISSION_DETAILS[permKey] || {
                title: permKey.replace(/_/g, ' '),
                desc: 'Administrative authority granted to your system account.'
              };

              return (
                <div
                  key={permKey}
                  className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-base">
                      <FiKey />
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <FiCheckCircle className="w-3 h-3" />
                      <span>Active</span>
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {meta.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {meta.desc}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 uppercase">
                      {permKey}
                    </span>
                    <CopyButton text={permKey} size={12} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 4: ASSIGNED COMPANIES
          ======================================================== */}
      {activeTab === 'companies' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Assigned Corporate Entities
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Companies linked to your administrative workspace for inventory and order management.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {profileData.companies?.length || 0} Registered
            </span>
          </div>

          {(!profileData.companies || profileData.companies.length === 0) ? (
            <EmptyState
              icon={FiLayers}
              title="No companies assigned"
              description="Your account currently operates at the national level with overarching system access."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profileData.companies.map((comp, idx) => (
                <div
                  key={comp._id || idx}
                  className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-sm space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                      {comp.logo ? (
                        <img src={comp.logo} alt={comp.name} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <span>{comp.name?.[0] || 'C'}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {comp.name || 'Company Name'}
                      </h4>
                      {comp.code && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md">
                          {comp.code}
                        </span>
                      )}
                    </div>
                  </div>

                  {comp._id && (
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-[11px] truncate max-w-[180px]">
                        ID: {comp._id}
                      </span>
                      <CopyButton text={comp._id} size={12} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 5: SECURITY & PASSWORD
          ======================================================== */}
      {activeTab === 'security' && (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
          <div className="rounded-3xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-200/80 dark:border-white/10 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg">
                <FiLock />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Change Account Password
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update your security credentials to protect administrative access.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FiKey className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                    required
                    placeholder="Enter current password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                    required
                    placeholder="Enter new password (min. 6 chars)"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    {showNewPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    required
                    placeholder="Repeat new password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  {passwordForm.newPassword.length >= 6 ? (
                    <FiCheck className="text-emerald-500 font-bold" />
                  ) : (
                    <FiAlertCircle className="text-slate-400" />
                  )}
                  <span
                    className={
                      passwordForm.newPassword.length >= 6
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-slate-500'
                    }
                  >
                    At least 6 characters in length
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordForm.newPassword &&
                    passwordForm.newPassword === passwordForm.confirmPassword ? (
                    <FiCheck className="text-emerald-500 font-bold" />
                  ) : (
                    <FiAlertCircle className="text-slate-400" />
                  )}
                  <span
                    className={
                      passwordForm.newPassword &&
                        passwordForm.newPassword === passwordForm.confirmPassword
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-slate-500'
                    }
                  >
                    Passwords match
                  </span>
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                >
                  {passwordLoading ? (
                    <>
                      <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <FiLock className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
