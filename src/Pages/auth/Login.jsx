import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/Context/AuthContext';
import { useTheme } from '@/Context/ThemeContext';
import CustomDropdown from '@/components/ui/CustomDropdown';
import {
  FiMail,
  FiLock,
  FiArrowRight,
  FiAlertCircle,
  FiCheckCircle,
  FiLoader,
  FiSun,
  FiMoon,
  FiUser,
  FiPhone,
  FiTag,
  FiBriefcase,
  FiKey,
  FiArrowLeft,
  FiEye,
  FiEyeOff
} from 'react-icons/fi';
import auricLoginDark from '@/assets/Auric_login_dark.png';
import auricLoginLight from '@/assets/Auric_login_light.png';
import auricLightLogo from '@/assets/auric_light.png';
import auricDarkLogo from '@/assets/auric_dark.png';

const ROLE_OPTIONS = [
  { value: 'SALES_EXECUTIVE', label: 'Sales Executive' },
  { value: 'ADMIN', label: 'Admin' }
];

const Login = () => {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+91');
  const [role, setRole] = useState('SALES_EXECUTIVE');
  const [employeeCode, setEmployeeCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register, forgotPassword, resetPassword, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const isRegisterMode = authMode === 'register';
  const isForgotMode = authMode === 'forgot';
  const isResetMode = authMode === 'reset';

  // If already logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (authMode === 'register') {
        await register({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          role,
          employeeCode: employeeCode.trim()
        });
      } else if (authMode === 'login') {
        await login(email.trim(), password);
      } else if (authMode === 'forgot') {
        const res = await forgotPassword(email.trim());
        const devToken = res?.data?.devResetToken;
        if (devToken) {
          setResetToken(devToken);
        }
        setSuccessMsg(res?.message || 'Password reset instructions dispatched. Please enter your reset token below.');
        setAuthMode('reset');
      } else if (authMode === 'reset') {
        const res = await resetPassword({
          email: email.trim(),
          resetToken: resetToken.trim(),
          newPassword
        });
        setSuccessMsg(res?.message || 'Password reset successfully! Please sign in with your new password.');
        setPassword('');
        setResetToken('');
        setNewPassword('');
        setAuthMode('login');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        (authMode === 'register' 
          ? 'Registration failed. Please try again.' 
          : authMode === 'forgot'
          ? 'Failed to send reset instructions. Please check email address.'
          : authMode === 'reset'
          ? 'Failed to reset password. Please check your token.'
          : 'Invalid email or password. Please try again.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`h-screen w-full flex font-sans overflow-hidden relative transition-colors duration-300 ${
      isDark ? 'panel-bg-dark text-slate-300' : 'panel-bg-light text-slate-700'
    }`}>

      {/* Unified Global Background Lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/2 left-[25%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full filter blur-[140px] opacity-20 dark:opacity-45 bg-blue-400/40 dark:bg-blue-600/50"></div>
        <div className="absolute top-1/4 left-[35%] -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full filter blur-[120px] opacity-15 dark:opacity-30 bg-indigo-400/35 dark:bg-indigo-600/40"></div>
        <div className="absolute bottom-1/4 right-[25%] translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] rounded-full filter blur-[140px] opacity-10 dark:opacity-25 bg-blue-300/30 dark:bg-blue-700/30"></div>
      </div>

      {/* Floating Theme Switcher */}
      <div className="absolute top-5 right-5 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border backdrop-blur-md text-xs font-semibold cursor-pointer transition-all duration-200 shadow-md bg-white/90 hover:bg-white border-slate-200 text-slate-700 shadow-slate-500/10 dark:bg-slate-900/80 dark:hover:bg-slate-800 dark:border-white/10 dark:text-slate-200 dark:shadow-black/40 active:scale-95"
          title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <>
              <FiSun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <FiMoon className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Left Image Section */}
      <div className="hidden lg:flex lg:w-1/2 h-full items-center justify-center relative shrink-0 z-10">
        <img
          src={isDark ? auricLoginDark : auricLoginLight}
          alt="Auric Distribution Hub & Brand Ecosystem"
          className="max-h-full max-w-full object-contain select-none pointer-events-none drop-shadow-[0_20px_45px_rgba(30,58,138,0.18)] dark:drop-shadow-[0_0_45px_rgba(37,99,235,0.4)] transition-all duration-500"
          fetchPriority="high"
          loading="eager"
          decoding="async"
        />
      </div>

      {/* Right Form Section */}
      <div className={`w-full lg:w-1/2 h-full flex flex-col items-center relative px-4 ${isRegisterMode || isResetMode ? 'overflow-y-auto' : 'overflow-y-auto justify-center'} z-10`}>

        {/* Auth Card */}
        <div className={`relative w-full ${isRegisterMode || isResetMode
            ? 'max-w-lg my-4 sm:my-6 pb-6 p-4 sm:p-6'
            : 'max-w-[380px] my-auto p-4 sm:p-5'
          } bg-transparent backdrop-blur-xl border border-slate-200/90 dark:border-white/10 transform-gpu shadow-2xl shadow-slate-500/20 dark:shadow-black/50 rounded-3xl z-10 transition-all duration-300 shrink-0`}>

          {/* Branding */}
          <div className={`flex flex-col items-center justify-center ${isRegisterMode || isResetMode ? 'mb-3 sm:mb-4' : 'mb-2 sm:mb-2.5'}`}>
            <img
              src={isDark ? auricDarkLogo : auricLightLogo}
              alt="Auric Logo"
              className={`${isRegisterMode || isResetMode ? 'w-32 sm:w-36' : 'w-28 sm:w-32'} h-auto object-contain transition-opacity duration-300`}
            />
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium text-center">
              {isRegisterMode
                ? 'Create your staff or executive account'
                : isForgotMode
                ? 'Enter your email to receive password reset instructions.'
                : isResetMode
                ? 'Enter your reset token and your new password.'
                : 'Welcome back, please LogIn to your account.'}
            </p>
          </div>

          {/* Mode Switcher Tabs / Back Link */}
          {!isForgotMode && !isResetMode ? (
            <div className={`flex p-1 ${isRegisterMode ? 'mb-4' : 'mb-2.5'} rounded-2xl bg-slate-100/90 dark:bg-white/5 border border-slate-200/80 dark:border-white/10`}>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
                className={`flex-1 ${isRegisterMode ? 'py-2' : 'py-1.5'} text-xs font-bold rounded-xl transition-all cursor-pointer ${authMode === 'login'
                    ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-sm border border-slate-200/60 dark:border-transparent'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg(''); }}
                className={`flex-1 ${isRegisterMode ? 'py-2' : 'py-1.5'} text-xs font-bold rounded-xl transition-all cursor-pointer ${authMode === 'register'
                    ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-sm border border-slate-200/60 dark:border-transparent'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
              >
                Self Registration
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {isForgotMode ? 'Forgot Password' : 'Reset Password'}
              </span>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
                className="flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <FiArrowLeft className="mr-1 text-xs" /> Back to Sign In
              </button>
            </div>
          )}

          {/* Success State */}
          {successMsg && (
            <div className="flex items-center bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-200 p-3.5 rounded-xl mb-3 text-xs font-semibold">
              <FiCheckCircle className="text-base mr-2 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {successMsg}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/50 text-rose-700 dark:text-rose-200 p-3.5 rounded-xl mb-3 text-xs font-semibold animate-pulse">
              <FiAlertCircle className="text-base mr-2 shrink-0 text-rose-600 dark:text-rose-400" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={isRegisterMode || isResetMode ? "space-y-3.5" : "space-y-2.5"}>

            {/* Registration Extra Fields: Name */}
            {isRegisterMode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">
                    First Name
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                      <FiUser className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-base" />
                    </div>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                      placeholder="First name"
                      required={isRegisterMode}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">
                    Last Name
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                      <FiUser className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-base" />
                    </div>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                      placeholder="Last name"
                      required={isRegisterMode}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Email Input (All modes) */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                  <FiMail className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-base" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-10 pr-3 ${isRegisterMode || isResetMode ? 'py-2.5' : 'py-2'} rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner`}
                  placeholder="user@whatnot.in"
                  required
                />
              </div>
            </div>

            {/* Password Input (Login & Register modes) */}
            {(authMode === 'login' || authMode === 'register') && (
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                    <FiLock className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-base" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-10 pr-10 ${isRegisterMode || isResetMode ? 'py-2.5' : 'py-2'} rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner`}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff className="text-base" /> : <FiEye className="text-base" />}
                  </button>
                </div>
                {authMode === 'login' && (
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('forgot'); setError(''); setSuccessMsg(''); }}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Reset Password Extra Fields: Reset Token & New Password */}
            {isResetMode && (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">
                    Reset Token
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                      <FiKey className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-base" />
                    </div>
                    <input
                      type="text"
                      id="resetToken"
                      name="resetToken"
                      autoComplete="off"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                      placeholder="Paste reset token received"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">
                    New Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                      <FiLock className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-base" />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      id="newPassword"
                      name="newPassword"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                      placeholder="NewSecurePass@123"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <FiEyeOff className="text-base" /> : <FiEye className="text-base" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Registration Extra Fields: Phone & Employee Code */}
            {isRegisterMode && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">
                      Phone Number
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                        <FiPhone className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-base" />
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                        placeholder="+1234567890"
                        required={isRegisterMode}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">
                      Employee Code
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                        <FiTag className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-base" />
                      </div>
                      <input
                        type="text"
                        id="employeeCode"
                        name="employeeCode"
                        autoComplete="off"
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                        placeholder="EMP-202"
                        required={isRegisterMode}
                      />
                    </div>
                  </div>
                </div>

                {/* Role Dropdown */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">
                    System Role
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                      <FiBriefcase className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-base" />
                    </div>
                    <CustomDropdown
                      value={role}
                      onChange={(newRole) => setRole(newRole)}
                      options={ROLE_OPTIONS}
                      statusColor="!pl-10 !py-2.5 !rounded-xl !text-sm backdrop-blur-md transition-all duration-300 !bg-white dark:!bg-black/20 !border-slate-200/90 dark:!border-white/10 focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 shadow-xs dark:shadow-inner !text-slate-900 dark:!text-white hover:!bg-slate-50 dark:hover:!bg-black/30"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full ${isRegisterMode || isResetMode ? 'mt-3 py-2.5 sm:py-3' : 'mt-2.5 py-2 sm:py-2.5'} flex items-center justify-center text-white rounded-xl transition-all duration-300 font-semibold group disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 text-sm active:scale-[0.99]`}
            >
              {isLoading ? (
                <FiLoader className="animate-spin text-lg" />
              ) : (
                <>
                  {authMode === 'register'
                    ? 'Register & Sign In'
                    : authMode === 'forgot'
                    ? 'Send Reset Instructions'
                    : authMode === 'reset'
                    ? 'Reset Password'
                    : 'LogIn'}
                  <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Switch Link */}
          <div className={`${isRegisterMode || isResetMode ? 'mt-3.5 sm:mt-4' : 'mt-2.5 sm:mt-3'} text-center text-xs font-medium text-slate-500 dark:text-slate-400`}>
            {authMode === 'register' ? (
              <span>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            ) : authMode === 'forgot' ? (
              <span>
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            ) : authMode === 'reset' ? (
              <span>
                Need another token?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot'); setError(''); setSuccessMsg(''); }}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Request Again
                </button>
              </span>
            ) : (
              <span>
                Need an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg(''); }}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Self Register
                </button>
              </span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;