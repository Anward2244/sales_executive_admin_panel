import { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getUsersApi, getUserByIdApi, createUserApi, updateUserStatusApi, updateUserApi } from '@/api/axios';
import {
  FiCheck, FiLoader, FiAlertCircle,
  FiSearch, FiUser, FiRefreshCcw, FiX,
  FiChevronDown, FiCopy, FiCalendar, FiClock, FiPhone,
  FiMail, FiEye, FiEyeOff, FiExternalLink, FiHash, FiBriefcase,
  FiLayers, FiUserCheck, FiUserX, FiShield, FiDownload, FiCheckCircle, FiXCircle,
  FiEdit2, FiEdit3, FiPower, FiMapPin, FiChevronLeft, FiChevronRight, FiImage, FiTag
} from 'react-icons/fi';
import { useOutletContext, useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import { useConfirm } from '@/Context/ConfirmationContext';
import CopyButton from '@/components/ui/CopyButton';
import CustomDropdown from '@/components/ui/CustomDropdown';
import GmailLink from '@/components/ui/GmailLink';
import { BulkActionBar, BatchProgressModal } from '@/components/ui';
import { useDisplayPreferences } from '@/utils/displayPreferences';
import { createPortal } from 'react-dom';
import { formatPhone, formatEntityCode } from '@/utils/formatters';
import { validateEmail, validatePhone, validateEntityCode } from '@/utils/validators';
import { TableSkeleton } from '@/components/ui/Skeleton';

const getUserFullName = (user) => {
  if (!user) return '';
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return user.name || 'User';
};

const getRoleBadgeClass = (role) => {
  switch ((role || '').toUpperCase()) {
    case 'ADMIN':
      return 'bg-purple-500/60 dark:bg-purple-500/10 text-white dark:text-purple-600 border-purple-500/20';
    case 'SALES_EXECUTIVE':
      return 'bg-blue-500/60 dark:bg-blue-500/10 text-white dark:text-blue-600 border-blue-500/20';
    case 'SALES_HEAD':
      return 'bg-indigo-500/60 dark:bg-indigo-500/10 text-white dark:text-indigo-600 border-indigo-500/20';
    case 'WAREHOUSE':
      return 'bg-amber-500/60 dark:bg-amber-500/10 text-white dark:text-amber-600 border-amber-500/20';
    case 'BILLING':
      return 'bg-emerald-500/60 dark:bg-emerald-500/10 text-white dark:text-emerald-600 border-emerald-500/20';
    default:
      return 'bg-slate-500/60 dark:bg-slate-500/10 text-white dark:text-slate-600 border-slate-500/20';
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

const UsersList = () => {
  const { showAlert: showGlobalAlert, confirm } = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const navigate = useNavigate();
  const { id: urlUserId } = useParams();

  // Search and Filter Params
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSearchParam = searchParams.get('search') || searchParams.get('userId') || '';
  const [searchInput, setSearchInput] = useState(rawSearchParam);
  const lastPushedSearchRef = useRef(rawSearchParam);
  const searchTerm = rawSearchParam;
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const selectedRole = searchParams.get('role') || '';
  const selectedStatus = searchParams.get('status') || '';
  const sortKey = searchParams.get('sortKey') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const userTab = searchParams.get('tab') || 'all';


  // Pagination State
  const { preferences: displayPrefs } = useDisplayPreferences();
  const usersPerPage = displayPrefs.rowsPerPage || 10;
  const [paginationMeta, setPaginationMeta] = useState(null);

  const { setUsersUnreadCount } = useOutletContext() || {};

  const setCurrentPage = (pageVal) => {
    const pageNum = typeof pageVal === 'function' ? pageVal(currentPage) : pageVal;
    setSearchParams(prev => {
      prev.set('page', String(pageNum));
      return prev;
    });
  };

  const handleFilterChange = (key, value) => {
    setSearchParams(prev => {
      if (value) {
        prev.set(key, value);
      } else {
        prev.delete(key);
      }
      prev.set('page', '1');
      return prev;
    });
  };

  const handleSortChange = (key) => {
    setSearchParams(prev => {
      const currentKey = prev.get('sortKey') || '';
      const currentOrder = prev.get('sortOrder') || 'asc';

      if (currentKey === key) {
        if (currentOrder === 'asc') {
          prev.set('sortOrder', 'desc');
        } else {
          prev.delete('sortKey');
          prev.delete('sortOrder');
        }
      } else {
        prev.set('sortKey', key);
        prev.set('sortOrder', 'asc');
      }
      prev.set('page', '1');
      return prev;
    });
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearchParams(prev => {
      prev.delete('search');
      prev.delete('userId');
      prev.delete('role');
      prev.delete('status');
      prev.delete('sortKey');
      prev.delete('sortOrder');
      prev.delete('tab');
      prev.set('page', '1');
      return prev;
    });
  };

  // Sync local input with URL search param
  useEffect(() => {
    const urlSearch = searchParams.get('search') || searchParams.get('userId') || '';
    if (urlSearch !== lastPushedSearchRef.current) {
      setSearchInput(urlSearch);
      lastPushedSearchRef.current = urlSearch;
    }
  }, [searchParams]);

  // Debounce search updates to URL
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setSearchParams(prev => {
        const currentSearch = prev.get('search') || '';
        if (searchInput === currentSearch) return prev;

        if (searchInput) {
          prev.set('search', searchInput);
        } else {
          prev.delete('search');
        }
        prev.set('page', '1');
        lastPushedSearchRef.current = searchInput;
        return prev;
      }, { replace: true });
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchInput, setSearchParams]);

  // Fetch users from GET /users
  const fetchUsers = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    setError('');
    try {
      const response = await getUsersApi();
      let userList = [];
      let meta = null;

      if (response.data) {
        if (Array.isArray(response.data.data)) {
          userList = response.data.data;
          meta = response.data.meta || null;
        } else if (Array.isArray(response.data)) {
          userList = response.data;
        } else if (Array.isArray(response.data.users)) {
          userList = response.data.users;
        } else if (response.data.data && Array.isArray(response.data.data.users)) {
          userList = response.data.data.users;
          meta = response.data.data.meta || response.data.meta || null;
        }
      }

      setUsers(userList);
      if (meta) {
        setPaginationMeta(meta);
      }

      if (setUsersUnreadCount) {
        setUsersUnreadCount(0);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      if (!isPoll) {
        setError(err.response?.data?.message || 'Failed to load users data.');
      }
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(false);

    // Auto-refresh every 30 seconds
    const intervalId = setInterval(() => {
      fetchUsers(true);
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);


  // Tab Filtering
  const tabFilteredUsers = useMemo(() => {
    switch (userTab) {
      case 'active':
        return users.filter(u => u.isActive === true);
      case 'inactive':
        return users.filter(u => u.isActive === false);
      case 'SALES_EXECUTIVE':
        return users.filter(u => (u.role || '').toUpperCase() === 'SALES_EXECUTIVE');
      case 'ADMIN':
        return users.filter(u => (u.role || '').toUpperCase() === 'ADMIN');
      case 'assigned':
        return users.filter(u => Array.isArray(u.assignedCompanyIds) && u.assignedCompanyIds.length > 0);
      default:
        return users;
    }
  }, [users, userTab]);

  // Search & Secondary Filter
  const filteredUsers = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();

    return tabFilteredUsers.filter(user => {
      // Role Filter
      if (selectedRole && (user.role || '').toUpperCase() !== selectedRole.toUpperCase()) {
        return false;
      }

      // Status Filter
      if (selectedStatus && selectedStatus !== 'all') {
        const isActiveStr = user.isActive ? 'active' : 'inactive';
        if (isActiveStr !== selectedStatus.toLowerCase()) {
          return false;
        }
      }

      // Search Query
      if (term) {
        const fullName = getUserFullName(user).toLowerCase();
        const firstName = (user.firstName || '').toLowerCase();
        const lastName = (user.lastName || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const phone = (user.phone || '').toLowerCase();
        const id = (user._id || '').toLowerCase();
        const employeeCode = (user.employeeCode || '').toLowerCase();
        const role = (user.role || '').toLowerCase();
        const statusText = user.isActive ? 'active' : 'inactive';
        const reportingManager = (user.reportingManager || '').toLowerCase();
        const assignedCompaniesMatch = Array.isArray(user.assignedCompanyIds) &&
          user.assignedCompanyIds.some(cid => String(cid).toLowerCase().includes(term));

        const createdAtStr = user.createdAt ? formatDateDDMMYYYY(user.createdAt).toLowerCase() : '';

        const matches = fullName.includes(term) ||
          firstName.includes(term) ||
          lastName.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          id.includes(term) ||
          employeeCode.includes(term) ||
          role.includes(term) ||
          statusText.includes(term) ||
          reportingManager.includes(term) ||
          assignedCompaniesMatch ||
          createdAtStr.includes(term);

        if (!matches) return false;
      }

      return true;
    });
  }, [tabFilteredUsers, selectedRole, selectedStatus, searchTerm]);

  // Sorting
  const sortedUsers = useMemo(() => {
    if (!sortKey) return filteredUsers;
    const list = [...filteredUsers];

    list.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === 'name') {
        aVal = getUserFullName(a).toLowerCase();
        bVal = getUserFullName(b).toLowerCase();
      } else if (sortKey === 'assignedCompanies') {
        aVal = Array.isArray(a.assignedCompanyIds) ? a.assignedCompanyIds.length : 0;
        bVal = Array.isArray(b.assignedCompanyIds) ? b.assignedCompanyIds.length : 0;
      } else if (sortKey === 'createdAt' || sortKey === 'updatedAt' || sortKey === 'lastLoginAt') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [filteredUsers, sortKey, sortOrder]);

  // Role dropdown options
  const roleOptions = useMemo(() => {
    const roles = Array.from(new Set(users.map(u => u.role).filter(Boolean)));
    return [
      { value: '', label: selectedRole ? `Role: ${formatRoleName(selectedRole)}` : 'All Roles' },
      ...roles.map(r => ({ value: r, label: formatRoleName(r) }))
    ];
  }, [users, selectedRole]);

  // Status counts for segmented filter
  const { activeCount, inactiveCount } = useMemo(() => {
    let active = 0;
    let inactive = 0;
    users.forEach((u) => {
      if (u.isActive) active++;
      else inactive++;
    });
    return { activeCount: active, inactiveCount: inactive };
  }, [users]);

  // Pagination logic
  const totalPages = Math.ceil(sortedUsers.length / usersPerPage) || 1;

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);

  // Initial Create form state
  const initialFormstate = {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    role: "SALES_EXECUTIVE",
    employeeCode: "",
    isActive: true
  };

  const [formData, setFormData] = useState(initialFormstate);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Right-side User Details & Edit Drawer State
  const [drawerUser, setDrawerUser] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview'); // 'overview' | 'edit'
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerSaveError, setDrawerSaveError] = useState('');
  const [drawerEditForm, setDrawerEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    role: 'SALES_EXECUTIVE',
    employeeCode: '',
    profileImage: '',
    reportingManager: '',
    territory: '',
    emergencyContact: '',
    isActive: true
  });

  // Open User Drawer handler
  const handleOpenUserDrawer = async (user, targetTab = 'overview') => {
    if (!user) return;
    setDrawerUser(user);
    setDrawerTab(targetTab);
    setIsDrawerOpen(true);
    setDrawerSaveError('');

    setDrawerEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      role: user.role || 'SALES_EXECUTIVE',
      employeeCode: user.employeeCode || '',
      profileImage: user.profileImage || '',
      reportingManager: user.reportingManager || '',
      territory: user.territory || '',
      emergencyContact: user.emergencyContact || '',
      isActive: user.isActive !== undefined ? user.isActive : true
    });

    // Fetch full fresh details (for assignedCompanyIds, reportingManager, etc.)
    try {
      setDrawerLoading(true);
      const res = await getUserByIdApi(user._id);
      const fetched = res.data?.data || res.data;
      if (fetched && typeof fetched === 'object' && fetched._id) {
        setDrawerUser((prev) => (prev && prev._id === user._id ? { ...prev, ...fetched } : fetched));
        setDrawerEditForm({
          firstName: fetched.firstName || '',
          lastName: fetched.lastName || '',
          phone: fetched.phone || '',
          role: fetched.role || 'SALES_EXECUTIVE',
          employeeCode: fetched.employeeCode || '',
          profileImage: fetched.profileImage || '',
          reportingManager: fetched.reportingManager || '',
          territory: fetched.territory || '',
          emergencyContact: fetched.emergencyContact || '',
          isActive: fetched.isActive !== undefined ? fetched.isActive : true
        });
      }
    } catch (err) {
      console.error('Failed to fetch full user details:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Close User Drawer handler
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setDrawerUser(null);
    setDrawerSaveError('');
    if (urlUserId) {
      navigate('/users', { replace: true });
    }
  };

  // Sync with URL parameter (/users/:id)
  useEffect(() => {
    if (urlUserId) {
      const match = users.find((u) => u._id === urlUserId);
      if (match) {
        handleOpenUserDrawer(match);
      } else {
        getUserByIdApi(urlUserId)
          .then((res) => {
            const data = res.data?.data || res.data;
            if (data && data._id) {
              handleOpenUserDrawer(data);
            }
          })
          .catch((err) => {
            console.error('Failed to load user from URL param:', err);
          });
      }
    }
  }, [urlUserId, users]);

  // Stepper navigation among sortedUsers
  const selectedUserIndex = useMemo(() => {
    if (!drawerUser) return -1;
    return sortedUsers.findIndex((u) => u._id === drawerUser._id);
  }, [drawerUser, sortedUsers]);

  const canGoPrevUser = selectedUserIndex > 0;
  const canGoNextUser = selectedUserIndex >= 0 && selectedUserIndex < sortedUsers.length - 1;

  const handlePrevUser = () => {
    if (canGoPrevUser) {
      handleOpenUserDrawer(sortedUsers[selectedUserIndex - 1], drawerTab);
    }
  };

  const handleNextUser = () => {
    if (canGoNextUser) {
      handleOpenUserDrawer(sortedUsers[selectedUserIndex + 1], drawerTab);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isDrawerOpen) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Escape') {
        handleCloseDrawer();
      } else if (e.key === 'ArrowLeft' && canGoPrevUser && drawerTab === 'overview') {
        handlePrevUser();
      } else if (e.key === 'ArrowRight' && canGoNextUser && drawerTab === 'overview') {
        handleNextUser();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, canGoPrevUser, canGoNextUser, drawerTab, selectedUserIndex]);

  // Drawer status toggle
  const handleToggleDrawerUserStatus = async () => {
    if (!drawerUser) return;
    const targetId = drawerUser._id;
    const newStatus = !drawerUser.isActive;
    const actionText = newStatus ? 'activate' : 'deactivate';

    const isConfirmed = await confirm(`Are you sure you want to ${actionText} user "${getUserFullName(drawerUser)}"?`);
    if (!isConfirmed) return;

    setActionLoadingId(targetId);
    try {
      const res = await updateUserStatusApi(targetId, newStatus);
      showGlobalAlert(res.data?.message || `User ${actionText}d successfully!`, 'success');
      setDrawerUser((prev) => (prev ? { ...prev, isActive: newStatus } : null));
      setUsers((prev) => prev.map((u) => (u._id === targetId ? { ...u, isActive: newStatus } : u)));
    } catch (err) {
      console.error('Status toggle error:', err);
      showGlobalAlert(err.response?.data?.message || `Failed to ${actionText} user.`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Drawer edit input change
  const handleDrawerInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let formattedValue = value;
    if (name === 'phone') {
      formattedValue = formatPhone(value);
    } else if (name === 'employeeCode') {
      formattedValue = formatEntityCode(value);
    }
    setDrawerEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : formattedValue
    }));
    if (drawerSaveError) setDrawerSaveError('');
  };

  // Drawer edit submit handler
  const handleSaveDrawerUser = async (e) => {
    e.preventDefault();
    setDrawerSaveError('');

    if (!drawerEditForm.firstName.trim()) {
      return setDrawerSaveError('First name is required.');
    }
    const phoneVal = validatePhone(drawerEditForm.phone);
    if (!phoneVal.isValid) {
      return setDrawerSaveError(phoneVal.error);
    }
    if (drawerEditForm.employeeCode) {
      const codeVal = validateEntityCode(drawerEditForm.employeeCode);
      if (!codeVal.isValid) {
        return setDrawerSaveError(`Employee code: ${codeVal.error}`);
      }
    }

    setDrawerSaving(true);
    try {
      const payload = {
        firstName: drawerEditForm.firstName.trim(),
        lastName: drawerEditForm.lastName.trim(),
        phone: drawerEditForm.phone.trim(),
        role: drawerEditForm.role,
        employeeCode: drawerEditForm.employeeCode.trim(),
        profileImage: drawerEditForm.profileImage.trim(),
        reportingManager: drawerEditForm.reportingManager.trim(),
        territory: drawerEditForm.territory.trim(),
        emergencyContact: drawerEditForm.emergencyContact.trim(),
        isActive: Boolean(drawerEditForm.isActive)
      };

      const res = await updateUserApi(drawerUser._id, payload);
      const updatedUser = res.data?.data ? res.data.data : { ...drawerUser, ...payload };

      showGlobalAlert(res.data?.message || 'User profile updated successfully!', 'success');
      setDrawerUser(updatedUser);
      setUsers((prev) => prev.map((u) => (u._id === drawerUser._id ? { ...u, ...updatedUser } : u)));
      setDrawerTab('overview');
    } catch (err) {
      console.error('Update user error:', err);
      setDrawerSaveError(err.response?.data?.message || 'Failed to update user profile. Please try again.');
    } finally {
      setDrawerSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let formattedValue = value;
    if (name === 'phone') {
      formattedValue = formatPhone(value);
    } else if (name === 'employeeCode') {
      formattedValue = formatEntityCode(value);
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : formattedValue,
    }));
    if (formError) setFormError('');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError('');

    // 1. Client-side Validations
    if (!formData.firstName.trim()) {
      return setFormError('First name is required.');
    }
    const emailVal = validateEmail(formData.email);
    if (!emailVal.isValid) {
      return setFormError(emailVal.error);
    }
    if (!formData.password || formData.password.length < 6) {
      return setFormError('Password must be at least 6 characters.');
    }
    const phoneVal = validatePhone(formData.phone);
    if (!phoneVal.isValid) {
      return setFormError(phoneVal.error);
    }
    if (formData.employeeCode?.trim()) {
      const codeVal = validateEntityCode(formData.employeeCode);
      if (!codeVal.isValid) {
        return setFormError(`Employee Code: ${codeVal.error}`);
      }
    }

    setSubmitting(true);
    try {
      // 2. Send payload to backend
      const payload = {
        firstName: formData.firstName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        role: formData.role || 'SALES_EXECUTIVE',
        isActive: formData.isActive !== false,
        assignedCompanyIds: []
      };
      if (formData.lastName?.trim()) {
        payload.lastName = formData.lastName.trim();
      }
      if (formData.employeeCode?.trim()) {
        payload.employeeCode = formData.employeeCode.trim();
      }

      const response = await createUserApi(payload);

      // 3. User feedback
      showGlobalAlert(response.data?.message || 'User created successfully!', 'success');

      // 4. Reset form & close modal
      setFormData(initialFormstate);
      setShowPassword(false);
      setIsCreateModalOpen(false);

      // 5. Re-fetch table so the new user appears immediately
      fetchUsers(false);
    } catch (err) {
      console.error('Create user error:', err);
      setFormError(err.response?.data?.message || 'Failed to create user. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle User Active Status (PATCH /users/{id}/status)
  const handleToggleUserStatus = async (user) => {
    if (!user) return;
    const targetId = user._id;
    const newStatus = !user.isActive;
    const actionText = newStatus ? 'activate' : 'deactivate';

    const isConfirmed = await confirm(`Are you sure you want to ${actionText} user "${getUserFullName(user)}"?`);
    if (!isConfirmed) return;

    setActionLoadingId(targetId);
    try {
      const res = await updateUserStatusApi(targetId, newStatus);
      showGlobalAlert(res.data?.message || `User ${actionText}d successfully!`, 'success');
      setUsers(prev => prev.map(u => u._id === targetId ? { ...u, isActive: newStatus } : u));
    } catch (err) {
      console.error('Status toggle error:', err);
      showGlobalAlert(err.response?.data?.message || `Failed to ${actionText} user.`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Bulk Operations State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [bulkRoleModalOpen, setBulkRoleModalOpen] = useState(false);
  const [bulkSelectedRole, setBulkSelectedRole] = useState('TSM');
  const [batchProgress, setBatchProgress] = useState({
    isOpen: false,
    taskTitle: '',
    total: 0,
    current: 0,
    successCount: 0,
    failureCount: 0,
    logs: [],
    isFinished: false
  });
  const abortBatchRef = useRef(false);

  const toggleSelectUser = (id) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCurrentPageUsers = () => {
    const pageIds = currentUsers.map((u) => u._id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedUserIds.has(id));
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAllInactiveUsers = () => {
    const inactiveIds = sortedUsers.filter((u) => u.isActive === false).map((u) => u._id);
    setSelectedUserIds(new Set(inactiveIds));
  };

  const selectAllPageUsers = () => {
    setSelectedUserIds(new Set(currentUsers.map((u) => u._id)));
  };

  const runBatchTask = async ({ taskTitle, items, processItemFn }) => {
    abortBatchRef.current = false;
    setBatchProgress({
      isOpen: true,
      taskTitle,
      total: items.length,
      current: 0,
      successCount: 0,
      failureCount: 0,
      logs: [
        {
          time: new Date().toLocaleTimeString(),
          text: `Starting "${taskTitle}" on ${items.length} users...`,
          type: 'info'
        }
      ],
      isFinished: false
    });

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < items.length; i++) {
      if (abortBatchRef.current) {
        setBatchProgress((p) => ({
          ...p,
          logs: [
            ...p.logs,
            { time: new Date().toLocaleTimeString(), text: 'Batch execution halted by user.', type: 'error' }
          ]
        }));
        break;
      }

      const item = items[i];
      try {
        await processItemFn(item, i);
        successCount++;
        setBatchProgress((p) => ({
          ...p,
          current: i + 1,
          successCount,
          logs: [
            ...p.logs,
            {
              time: new Date().toLocaleTimeString(),
              text: `Success: ${getUserFullName(item)}`,
              type: 'success'
            }
          ]
        }));
      } catch (err) {
        failureCount++;
        setBatchProgress((p) => ({
          ...p,
          current: i + 1,
          failureCount,
          logs: [
            ...p.logs,
            {
              time: new Date().toLocaleTimeString(),
              text: `Error on ${getUserFullName(item)}: ${err.response?.data?.message || err.message}`,
              type: 'error'
            }
          ]
        }));
      }
      await new Promise((r) => setTimeout(r, 40));
    }

    setBatchProgress((p) => ({ ...p, isFinished: true }));
    await fetchUsers(false);
    setSelectedUserIds(new Set());
  };

  const handleBulkActivate = async () => {
    const selectedUsers = users.filter((u) => selectedUserIds.has(u._id));
    const isConfirmed = await confirm(`Are you sure you want to ACTIVATE ${selectedUsers.length} selected user account(s)?`);
    if (!isConfirmed) return;

    await runBatchTask({
      taskTitle: `Bulk Activate ${selectedUsers.length} Users`,
      items: selectedUsers,
      processItemFn: async (userItem) => {
        await updateUserStatusApi(userItem._id, true);
      }
    });
  };

  const handleBulkDeactivate = async () => {
    const selectedUsers = users.filter((u) => selectedUserIds.has(u._id));
    const isConfirmed = await confirm(`Are you sure you want to DEACTIVATE ${selectedUsers.length} selected user account(s)?`);
    if (!isConfirmed) return;

    await runBatchTask({
      taskTitle: `Bulk Deactivate ${selectedUsers.length} Users`,
      items: selectedUsers,
      processItemFn: async (userItem) => {
        await updateUserStatusApi(userItem._id, false);
      }
    });
  };

  const handleBulkChangeRole = async () => {
    const selectedUsers = users.filter((u) => selectedUserIds.has(u._id));
    setBulkRoleModalOpen(false);

    await runBatchTask({
      taskTitle: `Bulk Reassign Role (${bulkSelectedRole}) to ${selectedUsers.length} Users`,
      items: selectedUsers,
      processItemFn: async (userItem) => {
        await updateUserApi(userItem._id, { role: bulkSelectedRole });
      }
    });
  };

  const handleBulkExport = () => {
    const listToExport =
      selectedUserIds.size > 0 ? users.filter((u) => selectedUserIds.has(u._id)) : sortedUsers;
    if (listToExport.length === 0) {
      alert('No users available to export.');
      return;
    }

    const rows = listToExport.map((u, idx) => ({
      'S.No': idx + 1,
      Name: getUserFullName(u),
      'Employee Code': u.employeeCode || u.employeeId || '-',
      Email: u.email || '-',
      Phone: u.phone || u.mobile || '-',
      Role: formatRoleName(u.role),
      Status: u.isActive !== false ? 'ACTIVE' : 'INACTIVE',
      'Assigned Companies': Array.isArray(u.assignedCompanies) ? u.assignedCompanies.map((c) => c.name || c).join(', ') : '-',
      'Joined Date': formatDateDDMMYYYY(u.createdAt)
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, `Auric_Users_Export_${Date.now()}.xlsx`);
  };

  return (
      <div className="relative space-y-4 min-h-full z-0 isolate w-full">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <FiUser className="text-blue-600 dark:text-blue-400" />
              Users List
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
              Manage system administrators, sales executives, and user accounts.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">

            <div className="relative w-full md:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400 z-10" />
              <input
                type="text"
                placeholder="Search by name, email, code, role..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <button
              onClick={() => fetchUsers(false)}
              disabled={loading}
              className="p-2.5 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-xs shrink-0"
              title="Refresh Users"
            >
              <FiRefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Users Count, Filters & Action Bar */}
        <div className="relative z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-white/40 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-2xl backdrop-blur-xl shadow-md shadow-slate-500/30 dark:shadow-none text-xs font-semibold text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-full shadow-xs dark:shadow-none text-slate-600 dark:text-slate-400">
              Total Users: <strong className="text-slate-900 dark:text-white">{users.length}</strong>
            </span>
            {(searchTerm || selectedRole || selectedStatus || userTab !== 'all') && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
                Showing: <strong>{sortedUsers.length}</strong>
              </span>
            )}
          </div>

          {/* Status Segmented Filter, Role Filter & Actions */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Segmented Status Pill Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10">
              {[
                { id: 'all', label: 'All', count: users.length },
                { id: 'active', label: 'Active', count: activeCount },
                { id: 'inactive', label: 'Inactive', count: inactiveCount }
              ].map((tab) => {
                const isSelected = (!selectedStatus && tab.id === 'all') || selectedStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleFilterChange('status', tab.id === 'all' ? '' : tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isSelected
                        ? 'bg-white/20 text-white'
                        : tab.id === 'active'
                          ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : tab.id === 'inactive'
                            ? 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                            : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                        }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="min-w-[130px]">
              <CustomDropdown
                value=""
                onChange={(val) => handleFilterChange('role', val)}
                options={roleOptions}
                statusColor={`!px-3 !py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 font-bold ${selectedRole ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}
              />
            </div>
            {(searchTerm || selectedRole || (selectedStatus && selectedStatus !== 'all') || userTab !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:hover:text-white text-xs font-bold rounded-xl border border-slate-300 dark:border-white/10 transition-all cursor-pointer"
                title="Reset Filters"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsBulkMode((prev) => !prev);
                if (isBulkMode) setSelectedUserIds(new Set());
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer shrink-0 ${isBulkMode
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                : 'bg-white dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-blue-500/40'
                }`}
            >
              <FiLayers className="text-sm" />
              <span>{isBulkMode ? 'Exit Bulk' : 'Bulk Operations'}</span>
              {isBulkMode && selectedUserIds.size > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-mono">
                  {selectedUserIds.size}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError('');
                setFormData(initialFormstate);
                setShowPassword(false);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer shrink-0"
            >
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <TableSkeleton columns={7} rows={7} />
        ) : error ? (
          <div className="text-rose-600 dark:text-red-400 bg-rose-50 dark:bg-red-900/20 p-5 rounded-2xl border border-rose-200 dark:border-red-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FiAlertCircle className="text-xl shrink-0" />
              <span className="font-medium text-sm">{error}</span>
            </div>
            <button
              onClick={() => fetchUsers(false)}
              className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="relative z-10 bg-white/40 dark:bg-transparent border border-slate-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl shadow-slate-500/30 dark:shadow-black/50 rounded-3xl overflow-hidden flex flex-col h-full isolate will-change-transform">
            <div className="overflow-auto custom-scrollbar max-h-[70vh]">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-200">
                <thead className="sticky top-0 z-20 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md shadow-xs dark:shadow-md border-b border-slate-200/80 dark:border-white/10">
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <th className="p-3 font-bold text-center w-14">S.No</th>

                    {/* Name Sort */}
                    <th
                      onClick={() => handleSortChange('name')}
                      className="p-4 font-bold text-left cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={sortKey === 'name' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>User</span>
                        {sortKey === 'name' ? (
                          sortOrder === 'asc' ? <span className="text-blue-600 dark:text-blue-400">▲</span> : <span className="text-blue-600 dark:text-blue-400">▼</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">⇅</span>
                        )}
                      </div>
                    </th>

                    {/* Employee Code */}
                    <th
                      onClick={() => handleSortChange('employeeCode')}
                      className="p-4 font-bold text-left cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={sortKey === 'employeeCode' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>Emp Code</span>
                        {sortKey === 'employeeCode' ? (
                          sortOrder === 'asc' ? <span className="text-blue-600 dark:text-blue-400">▲</span> : <span className="text-blue-600 dark:text-blue-400">▼</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">⇅</span>
                        )}
                      </div>
                    </th>

                    {/* Email */}
                    <th className="p-4 font-bold text-left">Email</th>

                    <th className="p-4 font-bold text-center">Phone</th>

                    {/* Role */}
                    <th className="p-4 font-bold text-center">Role</th>

                    {/* Assigned Companies */}
                    <th
                      onClick={() => handleSortChange('assignedCompanies')}
                      className="p-4 font-bold text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={sortKey === 'assignedCompanies' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>Companies</span>
                        {sortKey === 'assignedCompanies' ? (
                          sortOrder === 'asc' ? <span className="text-blue-600 dark:text-blue-400">▲</span> : <span className="text-blue-600 dark:text-blue-400">▼</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">⇅</span>
                        )}
                      </div>
                    </th>

                    <th className="p-4 font-bold text-center">Status</th>

                    {/* Last Login */}
                    <th
                      onClick={() => handleSortChange('lastLoginAt')}
                      className="p-4 font-bold text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={sortKey === 'lastLoginAt' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>Last Login</span>
                        {sortKey === 'lastLoginAt' ? (
                          sortOrder === 'asc' ? <span className="text-blue-600 dark:text-blue-400">▲</span> : <span className="text-blue-600 dark:text-blue-400">▼</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">⇅</span>
                        )}
                      </div>
                    </th>

                    {/* Created At */}
                    <th
                      onClick={() => handleSortChange('createdAt')}
                      className="p-4 font-bold text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={sortKey === 'createdAt' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>Created At</span>
                        {sortKey === 'createdAt' ? (
                          sortOrder === 'asc' ? <span className="text-blue-600 dark:text-blue-400">▲</span> : <span className="text-blue-600 dark:text-blue-400">▼</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">⇅</span>
                        )}
                      </div>
                    </th>

                    <th className="p-4 font-bold text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-300/80 dark:divide-white/5">
                  {currentUsers.length > 0 ? (
                    currentUsers.map((user, index) => {
                      const fullName = getUserFullName(user);
                      const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U';

                      return (
                        <tr
                          key={user._id}
                          className="hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors group"
                        >
                          <td className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center font-medium">
                            {indexOfFirstUser + index + 1}
                          </td>

                          {/* Name & ID */}
                          <td className="p-4 text-sm text-slate-900 dark:text-white font-medium">
                            <div
                              onClick={() => handleOpenUserDrawer(user)}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 !text-white flex items-center justify-center text-xs font-extrabold shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                {initials}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {fullName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono font-medium">
                                    {user._id}
                                  </span>
                                  <CopyButton text={user._id} />
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Employee Code */}
                          <td className="p-4 text-sm">
                            {user.employeeCode ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 text-xs font-mono font-bold">
                                <FiHash className="text-[10px] text-slate-400" />
                                {user.employeeCode}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-mono">-</span>
                            )}
                          </td>

                          {/* Email */}
                          <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                            <GmailLink email={user.email} />
                          </td>

                          {/* Phone */}
                          <td className="p-4 text-sm text-center text-slate-700 dark:text-slate-300 font-mono">
                            {user.phone ? (
                              <a
                                href={`tel:${user.phone}`}
                                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              >
                                {user.phone}
                              </a>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>

                          {/* Role */}
                          <td className="p-4 text-sm text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${getRoleBadgeClass(user.role)}`}>
                              {formatRoleName(user.role)}
                            </span>
                          </td>

                          {/* Assigned Companies */}
                          <td className="p-4 text-sm text-center">
                            {Array.isArray(user.assignedCompanyIds) && user.assignedCompanyIds.length > 0 ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/60 dark:bg-blue-500/10 text-white dark:text-blue-400 border border-blue-500/20"
                                title={`${user.assignedCompanyIds.length} Assigned ${user.assignedCompanyIds.length === 1 ? 'Company' : 'Companies'}: ${user.assignedCompanyIds.join(', ')}`}
                              >
                                <FiBriefcase className="text-xs" />
                                <span>{user.assignedCompanyIds.length} {user.assignedCompanyIds.length === 1 ? 'Company' : 'Companies'}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 text-xs font-mono">-</span>
                            )}
                          </td>

                          {/* Status Toggle (PATCH /users/{id}/status) */}
                          <td className="p-4 text-sm text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(user)}
                              disabled={actionLoadingId === user._id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 ${user.isActive
                                ? 'bg-emerald-500/60 dark:bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-white dark:text-emerald-600'
                                : 'bg-rose-500/60 dark:bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-white dark:text-rose-600'
                                }`}
                              title={`Click to ${user.isActive ? 'deactivate' : 'activate'} user`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                              <span>{user.isActive ? 'Active' : 'Inactive'}</span>
                            </button>
                          </td>

                          {/* Last Login */}
                          <td className="p-4 text-sm text-center font-medium">
                            {user.lastLoginAt ? (
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                  <FiClock className="text-blue-600 dark:text-blue-400 text-[11px]" />
                                  {formatRelativeTime(user.lastLoginAt)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5" title={new Date(user.lastLoginAt).toLocaleString()}>
                                  {formatDateDDMMYYYY(user.lastLoginAt)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 text-xs font-mono">Never</span>
                            )}
                          </td>

                          {/* Created At */}
                          <td className="p-4 text-sm text-center font-medium">
                            {user.createdAt ? (
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                  <FiCalendar className="text-blue-600 dark:text-blue-400 text-[11px]" />
                                  {formatDateDDMMYYYY(user.createdAt)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {formatDateTimeDDMMYYYY(user.createdAt).split(', ')[1] || ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs font-mono">-</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => handleOpenUserDrawer(user)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white dark:text-blue-400 bg-blue-500/75 dark:bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                                title="View Details"
                              >
                                <FiEye size={13} />
                                <span>View</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-slate-500 dark:text-slate-400 italic">
                        {searchTerm || selectedRole || selectedStatus || userTab !== 'all'
                          ? 'No matching users found for current filters.'
                          : 'No users found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!loading && !error && sortedUsers.length > 0 && (
              <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-white/[0.02] backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
                    Showing <span className="font-bold text-slate-800 dark:text-white">{indexOfFirstUser + 1}</span> to <span className="font-bold text-slate-800 dark:text-white">{Math.min(indexOfLastUser, sortedUsers.length)}</span> of <span className="font-bold text-slate-800 dark:text-white">{sortedUsers.length}</span> users
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 sm:px-4 py-2 bg-white dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs sm:text-sm font-bold border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-none transform-gpu cursor-pointer"
                  >
                    &larr;
                  </button>
                  <div className="flex gap-1 mx-1 sm:mx-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 items-center">
                    {(() => {
                      const pageNumbers = [];
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
                      } else {
                        if (currentPage <= 4) {
                          for (let i = 1; i <= 5; i++) pageNumbers.push(i);
                          pageNumbers.push('...');
                          pageNumbers.push(totalPages);
                        } else if (currentPage >= totalPages - 3) {
                          pageNumbers.push(1);
                          pageNumbers.push('...');
                          for (let i = totalPages - 4; i <= totalPages; i++) pageNumbers.push(i);
                        } else {
                          pageNumbers.push(1);
                          pageNumbers.push('...');
                          for (let i = currentPage - 1; i <= currentPage + 1; i++) pageNumbers.push(i);
                          pageNumbers.push('...');
                          pageNumbers.push(totalPages);
                        }
                      }
                      return pageNumbers.map((page, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            if (page !== '...') setCurrentPage(page);
                          }}
                          disabled={page === '...'}
                          className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium border transition-colors shrink-0 transform-gpu ${page === currentPage
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                            : page === '...'
                              ? 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent cursor-default'
                              : 'bg-white dark:bg-slate-950/20 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                            }`}
                        >
                          {page}
                        </button>
                      ));
                    })()}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-3 sm:px-4 py-2 bg-white dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs sm:text-sm font-bold border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-none transform-gpu cursor-pointer"
                  >
                    &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Create User Modal */}
        {isCreateModalOpen && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 dark:bg-slate-950/50 backdrop-blur-lg animate-fade-in"
              onClick={() => !submitting && setIsCreateModalOpen(false)}
            />

            {/* Modal Box */}
            <div className="relative bg-white/20 dark:bg-slate-950/25 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">

              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/10 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create New User</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Add a new admin or sales executive account.</p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Error Message */}
              {formError && (
                <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <FiAlertCircle className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      placeholder="Vikram"
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Mehta"
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="vikram.mehta@whatnot.in"
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      placeholder="+919877001122"
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Role *</label>
                    <div className="mt-1">
                      <CustomDropdown
                        value={formData.role}
                        onChange={(val) => setFormData((prev) => ({ ...prev, role: val }))}
                        options={[
                          { value: 'SALES_EXECUTIVE', label: 'Sales Executive' },
                          { value: 'ADMIN', label: 'Admin' }
                        ]}
                        statusColor="!p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Employee Code <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      name="employeeCode"
                      value={formData.employeeCode}
                      onChange={handleInputChange}
                      placeholder="SE-105"
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password *</label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      placeholder="Sales@123456"
                      className="w-full p-2.5 pr-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg focus:outline-none cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="createIsActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="createIsActive" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Active Account
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
                  >
                    {submitting && <FiLoader className="animate-spin text-xs" />}
                    <span>{submitting ? 'Creating...' : 'Create User'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* ================= USER DETAILS & EDIT SLIDE-OVER DRAWER ================= */}
        {isDrawerOpen && drawerUser &&
          createPortal(
            <div className="fixed inset-0 z-[9999] overflow-hidden">
              {/* Backdrop */}
              <div
                className="fixed inset-0 dark:bg-slate-950/50 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
                onClick={handleCloseDrawer}
              />

              {/* Slide-over Container (Pinned to Right) */}
              <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-6 md:pl-10">
                <div className="w-screen max-w-full sm:max-w-2xl md:max-w-3xl bg-white/40 dark:bg-slate-900/40 border-l border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 z-10 text-left">
                  {/* Sticky Drawer Header */}
                  <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 shrink-0 space-y-3">
                    {/* Top Bar: User Avatar + Name + Actions + Close */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        {drawerUser.profileImage ? (
                          <img
                            src={drawerUser.profileImage}
                            alt={getUserFullName(drawerUser)}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl object-cover border border-slate-200 dark:border-white/10 shadow-xs shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm sm:text-base font-extrabold shrink-0 border border-blue-500/20 shadow-xs">
                            {[drawerUser.firstName?.[0], drawerUser.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                              {getUserFullName(drawerUser)}
                            </h2>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                                drawerUser.isActive !== false
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${drawerUser.isActive !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                              {drawerUser.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold border ${getRoleBadgeClass(drawerUser.role)}`}>
                              {formatRoleName(drawerUser.role)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                            <GmailLink email={drawerUser.email} showIcon={true} iconSize={12} className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium" />
                            {drawerUser.employeeCode && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600 text-xs">•</span>
                                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                                  #{drawerUser.employeeCode}
                                </span>
                                <CopyButton text={drawerUser.employeeCode} size={11} title="Copy Employee Code" />
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleToggleDrawerUserStatus}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            drawerUser.isActive !== false
                              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          }`}
                          title={drawerUser.isActive !== false ? 'Deactivate Account' : 'Activate Account'}
                        >
                          <FiPower size={13} />
                          <span className="hidden sm:inline">{drawerUser.isActive !== false ? 'Deactivate' : 'Activate'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCloseDrawer}
                          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
                          title="Close drawer (Esc)"
                        >
                          <FiX size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Sub-Bar: Mode Selector Tabs & Stepper Navigation */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/40 dark:border-white/5 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center p-0.5 sm:p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerTab('overview');
                            setDrawerSaveError('');
                          }}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            drawerTab === 'overview'
                              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <FiEye className="text-xs" />
                          <span>Overview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerTab('edit');
                            setDrawerSaveError('');
                          }}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            drawerTab === 'edit'
                              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <FiEdit2 className="text-xs" />
                          <span>Edit Profile</span>
                        </button>
                      </div>

                      {/* User Stepper Navigation */}
                      {selectedUserIndex >= 0 && sortedUsers.length > 1 && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5 sm:p-1 text-xs">
                          <button
                            type="button"
                            onClick={handlePrevUser}
                            disabled={!canGoPrevUser}
                            title="Previous User (Left Arrow)"
                            className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <FiChevronLeft size={15} />
                          </button>
                          <span className="px-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold select-none">
                            {selectedUserIndex + 1} of {sortedUsers.length}
                          </span>
                          <button
                            type="button"
                            onClick={handleNextUser}
                            disabled={!canGoNextUser}
                            title="Next User (Right Arrow)"
                            className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <FiChevronRight size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scrollable Body Content */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-7 custom-scrollbar space-y-5 sm:space-y-6">
                    {drawerLoading && (
                      <div className="flex items-center justify-center p-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <FiLoader className="animate-spin mr-2" />
                        <span>Refreshing live user profile...</span>
                      </div>
                    )}

                    {drawerTab === 'overview' ? (
                      <>
                        {/* Hero Info Card */}
                        <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                              <FiUser className="text-blue-500" />
                              <span>Account Details</span>
                            </h3>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-[11px] font-bold text-slate-400">User ID:</span>
                              <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 select-all truncate max-w-[140px]" title={drawerUser._id}>
                                {drawerUser._id}
                              </span>
                              <CopyButton text={drawerUser._id} size={11} title="Copy User ID" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">First Name</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {drawerUser.firstName || '-'}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Name</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {drawerUser.lastName || '-'}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role</p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${getRoleBadgeClass(drawerUser.role)}`}>
                                {formatRoleName(drawerUser.role)}
                              </span>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Employee Code</p>
                              <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">
                                {drawerUser.employeeCode || '-'}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reporting Manager</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {drawerUser.reportingManager || 'Not Assigned'}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Territory / Region</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {drawerUser.territory || 'Unassigned'}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Account Status</p>
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                                drawerUser.isActive !== false
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${drawerUser.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {drawerUser.isActive !== false ? 'Active Account' : 'Deactivated'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Contact & Media Card */}
                        <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
                          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <FiMail className="text-blue-500" />
                            <span>Contact Information</span>
                          </h3>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Email Address</span>
                                <div className="mt-1">
                                  <GmailLink email={drawerUser.email} className="text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold" />
                                </div>
                              </div>
                              <CopyButton text={drawerUser.email} />
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Phone Number</span>
                                <p className="text-slate-900 dark:text-white font-semibold text-xs mt-1 font-mono">{drawerUser.phone || 'N/A'}</p>
                              </div>
                              {drawerUser.phone && <CopyButton text={drawerUser.phone} />}
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Emergency Contact</span>
                                <p className="text-slate-900 dark:text-white font-semibold text-xs mt-1 font-mono">{drawerUser.emergencyContact || 'Not provided'}</p>
                              </div>
                              {drawerUser.emergencyContact && <CopyButton text={drawerUser.emergencyContact} />}
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                              <div className="min-w-0 flex-1 pr-2">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Profile Image URL</span>
                                <p className="text-slate-700 dark:text-slate-300 text-xs mt-1 truncate font-mono" title={drawerUser.profileImage || 'None'}>
                                  {drawerUser.profileImage || 'No image URL provided'}
                                </p>
                              </div>
                              {drawerUser.profileImage && (
                                <img
                                  src={drawerUser.profileImage}
                                  alt="Preview"
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-white/10 shrink-0"
                                />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Assigned Companies Card */}
                        <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                              <FiBriefcase className="text-blue-500" />
                              <span>Assigned Companies</span>
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {Array.isArray(drawerUser.assignedCompanyIds) ? drawerUser.assignedCompanyIds.length : 0} Assigned
                            </span>
                          </div>

                          {Array.isArray(drawerUser.assignedCompanyIds) && drawerUser.assignedCompanyIds.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {drawerUser.assignedCompanyIds.map((companyId, idx) => {
                                const cId = typeof companyId === 'object' && companyId !== null ? companyId._id : companyId;
                                const cName = typeof companyId === 'object' && companyId !== null ? companyId.name : null;
                                return (
                                  <div
                                    key={cId || idx}
                                    className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs shrink-0 font-bold">
                                        <FiBriefcase size={13} />
                                      </div>
                                      <div className="min-w-0">
                                        {cName && <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{cName}</p>}
                                        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate select-all" title={cId}>
                                          {cId}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <CopyButton text={cId} size={11} title="Copy Company ID" />
                                      <button
                                        type="button"
                                        onClick={() => navigate(`/companies/${cId}`)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                        title="View Company"
                                      >
                                        <FiExternalLink size={12} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-6 text-center bg-white/40 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                              <FiBriefcase className="text-2xl text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Companies Assigned</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">This user is not mapped to any specific companies.</p>
                            </div>
                          )}
                        </div>

                        {/* Timestamps & Activity Card */}
                        <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <FiClock className="text-blue-500" />
                            <span>Timestamps & Activity</span>
                          </h3>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Created Date</span>
                              <p className="text-slate-900 dark:text-white font-semibold text-xs mt-1 font-mono">
                                {drawerUser.createdAt ? formatDateTimeDDMMYYYY(drawerUser.createdAt) : 'N/A'}
                              </p>
                              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                                {formatRelativeTime(drawerUser.createdAt)}
                              </span>
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Last Updated</span>
                              <p className="text-slate-900 dark:text-white font-semibold text-xs mt-1 font-mono">
                                {drawerUser.updatedAt ? formatDateTimeDDMMYYYY(drawerUser.updatedAt) : 'N/A'}
                              </p>
                              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                                {formatRelativeTime(drawerUser.updatedAt)}
                              </span>
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Last Login</span>
                              <p className="text-slate-900 dark:text-white font-semibold text-xs mt-1 font-mono">
                                {drawerUser.lastLoginAt ? formatDateTimeDDMMYYYY(drawerUser.lastLoginAt) : 'Never logged in'}
                              </p>
                              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                                {formatRelativeTime(drawerUser.lastLoginAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Edit Form */
                      <form onSubmit={handleSaveDrawerUser} className="space-y-4">
                        {drawerSaveError && (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                            <FiAlertCircle className="shrink-0 text-sm" />
                            <span>{drawerSaveError}</span>
                          </div>
                        )}

                        <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
                          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <FiEdit2 className="text-blue-500" />
                            <span>Personal & Profile Information</span>
                          </h3>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                First Name *
                              </label>
                              <input
                                type="text"
                                name="firstName"
                                value={drawerEditForm.firstName}
                                onChange={handleDrawerInputChange}
                                placeholder="e.g. Rahul"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Last Name
                              </label>
                              <input
                                type="text"
                                name="lastName"
                                value={drawerEditForm.lastName}
                                onChange={handleDrawerInputChange}
                                placeholder="e.g. Sharma"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Phone Number *
                              </label>
                              <input
                                type="tel"
                                name="phone"
                                value={drawerEditForm.phone}
                                onChange={handleDrawerInputChange}
                                placeholder="+919876543210"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Role *
                              </label>
                              <CustomDropdown
                                value={drawerEditForm.role}
                                onChange={(val) => setDrawerEditForm((prev) => ({ ...prev, role: val }))}
                                options={[
                                  { value: 'SALES_EXECUTIVE', label: 'Sales Executive' },
                                  { value: 'SALES_HEAD', label: 'Sales Head' },
                                  { value: 'ADMIN', label: 'Admin' },
                                  { value: 'WAREHOUSE', label: 'Warehouse' },
                                  { value: 'BILLING', label: 'Billing' }
                                ]}
                                statusColor="!px-3 !py-2 !bg-white dark:!bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white font-medium"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Employee Code
                              </label>
                              <input
                                type="text"
                                name="employeeCode"
                                value={drawerEditForm.employeeCode}
                                onChange={handleDrawerInputChange}
                                placeholder="e.g. SE-105"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 uppercase"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Reporting Manager
                              </label>
                              <input
                                type="text"
                                name="reportingManager"
                                value={drawerEditForm.reportingManager}
                                onChange={handleDrawerInputChange}
                                placeholder="e.g. Vansh Jain"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Territory / Region
                              </label>
                              <input
                                type="text"
                                name="territory"
                                value={drawerEditForm.territory}
                                onChange={handleDrawerInputChange}
                                placeholder="e.g. North Region"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Emergency Contact
                              </label>
                              <input
                                type="tel"
                                name="emergencyContact"
                                value={drawerEditForm.emergencyContact}
                                onChange={handleDrawerInputChange}
                                placeholder="+919876543210"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Profile Image URL
                            </label>
                            <input
                              type="url"
                              name="profileImage"
                              value={drawerEditForm.profileImage}
                              onChange={handleDrawerInputChange}
                              placeholder="https://example.com/avatar.jpg"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                            />
                          </div>

                          <div className="pt-2 border-t border-slate-200/60 dark:border-white/5">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                name="isActive"
                                checked={drawerEditForm.isActive}
                                onChange={handleDrawerInputChange}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Active Account Status
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Form Actions */}
                        <div className="flex items-center justify-end gap-3 pt-3">
                          <button
                            type="button"
                            disabled={drawerSaving}
                            onClick={() => {
                              setDrawerTab('overview');
                              setDrawerSaveError('');
                            }}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={drawerSaving}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                          >
                            {drawerSaving && <FiLoader className="animate-spin text-xs" />}
                            <span>{drawerSaving ? 'Saving Changes...' : 'Save Changes'}</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    );
};

export default UsersList;