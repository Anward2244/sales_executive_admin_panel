import { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getUsersApi, createUserApi, updateUserStatusApi, updateUserApi } from '@/api/axios';
import {
  FiCheck, FiLoader, FiAlertCircle,
  FiSearch, FiUser, FiRefreshCcw, FiX,
  FiChevronDown, FiCopy, FiCalendar, FiClock, FiPhone,
  FiMail, FiEye, FiEyeOff, FiExternalLink, FiHash, FiBriefcase,
  FiLayers, FiUserCheck, FiUserX, FiShield, FiDownload, FiCheckCircle, FiXCircle
} from 'react-icons/fi';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
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

  const [formData,setFormData] = useState(initialFormstate);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
          <button
            onClick={() => fetchUsers(false)}
            disabled={loading}
            className="p-2.5 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-xs shrink-0"
            title="Refresh Users"
          >
            <FiRefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

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
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected
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
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer shrink-0 ${
              isBulkMode
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
        <div className="h-72 flex flex-col justify-center items-center bg-white/40 dark:bg-slate-950/15 border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs dark:shadow-none">
          <FiLoader className="animate-spin text-3xl text-blue-600 dark:text-blue-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading users...</p>
        </div>
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
        <div className="relative z-10 bg-white/10 dark:bg-transparent border border-slate-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl shadow-slate-500/30 dark:shadow-black/50 rounded-3xl overflow-hidden flex flex-col h-full isolate will-change-transform">
          <div className="overflow-auto custom-scrollbar max-h-[70vh]">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-200">
              <thead className="sticky top-0 z-20 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md shadow-xs dark:shadow-md border-b border-slate-200/80 dark:border-white/10">
                <tr className="border-b border-slate-200/80 dark:border-white/10 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {isBulkMode && (
                    <th className="p-3 pl-4 text-center w-10">
                      <input
                        type="checkbox"
                        checked={currentUsers.length > 0 && currentUsers.every((u) => selectedUserIds.has(u._id))}
                        onChange={toggleSelectAllCurrentPageUsers}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                  )}
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
                        className={`hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors group ${
                          selectedUserIds.has(user._id) ? 'bg-blue-500/[0.06] dark:bg-blue-500/10' : ''
                        }`}
                      >
                        {isBulkMode && (
                          <td className="p-3 pl-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.has(user._id)}
                              onChange={() => toggleSelectUser(user._id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center font-medium">
                          {indexOfFirstUser + index + 1}
                        </td>

                        {/* Name & ID */}
                        <td className="p-4 text-sm text-slate-900 dark:text-white font-medium">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 !text-white flex items-center justify-center text-xs font-extrabold shrink-0 shadow-sm">
                              {initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {fullName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
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
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 ${
                              user.isActive
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
                              onClick={() => navigate(`/users/${user._id}`)}
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
                        className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium border transition-colors shrink-0 transform-gpu ${
                          page === currentPage
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
        </div>, document.body
      )}
      {/* ================= BULK ACTION BAR ================= */}
      {isBulkMode && (
        <BulkActionBar
          selectedCount={selectedUserIds.size}
          totalCount={currentUsers.length}
          onClear={() => setSelectedUserIds(new Set())}
          onExit={() => {
            setIsBulkMode(false);
            setSelectedUserIds(new Set());
          }}
          quickSelectors={[
            {
              label: `Select Inactive (${inactiveCount})`,
              onClick: selectAllInactiveUsers
            },
            {
              label: 'Select Page',
              onClick: selectAllPageUsers
            }
          ]}
          actions={[
            {
              label: 'Activate Selected',
              icon: FiUserCheck,
              variant: 'success',
              onClick: handleBulkActivate
            },
            {
              label: 'Deactivate Selected',
              icon: FiUserX,
              variant: 'danger',
              onClick: handleBulkDeactivate
            },
            {
              label: 'Change Role',
              icon: FiShield,
              variant: 'info',
              onClick: () => {
                if (selectedUserIds.size === 0) return;
                setBulkRoleModalOpen(true);
              }
            },
            {
              label: 'Export to Excel',
              icon: FiDownload,
              variant: 'secondary',
              onClick: handleBulkExport
            }
          ]}
        />
      )}

      {/* ================= BATCH PROGRESS MODAL ================= */}
      <BatchProgressModal
        isOpen={batchProgress.isOpen}
        taskTitle={batchProgress.taskTitle}
        total={batchProgress.total}
        current={batchProgress.current}
        successCount={batchProgress.successCount}
        failureCount={batchProgress.failureCount}
        logs={batchProgress.logs}
        isFinished={batchProgress.isFinished}
        onAbort={() => {
          abortBatchRef.current = true;
        }}
        onClose={() => setBatchProgress((p) => ({ ...p, isOpen: false }))}
      />

      {/* ================= BULK ROLE MODAL ================= */}
      {bulkRoleModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold">
                  <FiShield size={18} />
                  <span className="text-sm">Bulk Change User Role</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkRoleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <FiX size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Select the target role to batch assign to <span className="font-bold font-mono text-sky-600">{selectedUserIds.size}</span> selected user(s).
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Role
                </label>
                <select
                  value={bulkSelectedRole}
                  onChange={(e) => setBulkSelectedRole(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="tsm">Territory Sales Manager (TSM)</option>
                  <option value="sales_head">Sales Head</option>
                  <option value="billing">Billing Officer</option>
                  <option value="warehouse">Warehouse Manager</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkRoleModalOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkChangeRole}
                  className="flex-1 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Apply Role
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default UsersList;