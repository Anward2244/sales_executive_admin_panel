import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
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
import whatnotLoginFullDark from '@/assets/whatnot_login_full_dark.png';
import whatnotLoginFullLight from '@/assets/whatnot_login_full_light.png';
import whatnotLogoLight from '@/assets/whatnot_logo_light.png';
import whatnotLogoDark from '@/assets/whatnot_logo_dark.png';

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

      {/* Full Background Wallpaper (No floor, elements on left, clean empty right side for form card) */}
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden select-none pointer-events-none">
        <img
          src={isDark ? whatnotLoginFullDark : whatnotLoginFullLight}
          alt="Whatnot Sales Commerce Platform"
          className="w-full h-full object-cover object-left lg:object-center transition-all duration-700"
          style={{
            maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 40%, rgba(0,0,0,0.8) 55%, rgba(0,0,0,0) 85%)',
            WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 40%, rgba(0,0,0,0.8) 55%, rgba(0,0,0,0) 85%)'
          }}
          fetchPriority="high"
          loading="eager"
          decoding="async"
        />
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

      {/* Main Viewport Content: Left spacer for 3D art, Right side for Form Card */}
      <div className="relative z-10 w-full h-full flex flex-col lg:flex-row items-stretch">
        {/* Left Side: Empty spacing area letting the floating 3D elements in the background shine through */}
        <div className="hidden lg:flex lg:w-1/2 h-full items-center justify-center pointer-events-none" />

        {/* Right Form Section: Placed cleanly over the empty right side of the wallpaper */}
        <div className="w-full lg:w-1/2 h-full flex flex-col items-center overflow-y-auto relative px-4 sm:px-6 py-4 sm:py-6">

          {/* Auth Card */}
          <div className={`relative w-full ${isRegisterMode || isResetMode
              ? 'max-w-[450px] my-auto p-4 sm:p-5.5'
              : 'max-w-[380px] my-auto p-4 sm:p-6'
            } bg-white/40 dark:bg-slate-900/50 backdrop-blur-lg border border-slate-200/80 dark:border-white/10 transform-gpu shadow-2xl dark:shadow-black/50 rounded-2xl sm:rounded-3xl z-10 transition-all duration-300 shrink-0`}>

          {/* Branding */}
          <div className="flex flex-col items-center justify-center mb-2.5 sm:mb-3">
            <img
              src={isDark ? whatnotLogoDark : whatnotLogoLight}
              alt="Whatnot Sales Logo"
              className="h-12 sm:h-13 w-auto object-contain transition-opacity duration-300"
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
            <div className="flex p-1 mb-2.5 sm:mb-3 rounded-xl bg-slate-100/90 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${authMode === 'login'
                    ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-xs border border-slate-200/60 dark:border-transparent'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg(''); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${authMode === 'register'
                    ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-xs border border-slate-200/60 dark:border-transparent'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
              >
                Self Registration
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-2.5 sm:mb-3 px-1">
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
            <div className="flex items-center bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-200 p-2.5 rounded-xl mb-2.5 text-xs font-semibold">
              <FiCheckCircle className="text-base mr-2 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {successMsg}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/50 text-rose-700 dark:text-rose-200 p-2.5 rounded-xl mb-2.5 text-xs font-semibold animate-pulse">
              <FiAlertCircle className="text-base mr-2 shrink-0 text-rose-600 dark:text-rose-400" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={isRegisterMode || isResetMode ? "space-y-2 sm:space-y-2.5" : "space-y-2.5"}>

            {/* Registration Extra Fields: Name */}
            {isRegisterMode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 ml-1">
                    First Name
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                      <FiUser className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-sm" />
                    </div>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-xs sm:text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                      placeholder="First name"
                      required={isRegisterMode}
                    />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 ml-1">
                    Last Name
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                      <FiUser className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-sm" />
                    </div>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-xs sm:text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                      placeholder="Last name"
                      required={isRegisterMode}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Email Input (All modes) */}
            <div className="space-y-0.5">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                  <FiMail className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-sm" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-xs sm:text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                  placeholder="admin@whatnot.in"
                  required
                />
              </div>
            </div>

            {/* Password Input (Login & Register modes) */}
            {(authMode === 'login' || authMode === 'register') && (
              <div className="space-y-0.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 ml-1">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                    <FiLock className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-sm" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-xs sm:text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff className="text-sm" /> : <FiEye className="text-sm" />}
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
                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 ml-1">
                    Reset Token
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                      <FiKey className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-sm" />
                    </div>
                    <input
                      type="text"
                      id="resetToken"
                      name="resetToken"
                      autoComplete="off"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-xs sm:text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                      placeholder="Paste reset token received"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 ml-1">
                    New Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                      <FiLock className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-sm" />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      id="newPassword"
                      name="newPassword"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-xs sm:text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                      placeholder="NewSecurePass@123"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <FiEyeOff className="text-sm" /> : <FiEye className="text-sm" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Registration Extra Fields: Phone & Employee Code */}
            {isRegisterMode && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 ml-1">
                      Phone Number
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                        <FiPhone className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-sm" />
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-xs sm:text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                        placeholder="+91"
                        required={isRegisterMode}
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 ml-1">
                      Employee Code
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                        <FiTag className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-sm" />
                      </div>
                      <input
                        type="text"
                        id="employeeCode"
                        name="employeeCode"
                        autoComplete="off"
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 backdrop-blur-md transform-gpu transition-all duration-300 text-xs sm:text-sm bg-white dark:bg-black/20 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner"
                        placeholder="EMP-202"
                        required={isRegisterMode}
                      />
                    </div>
                  </div>
                </div>

                {/* Role Dropdown */}
                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 ml-1">
                    System Role
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                      <FiBriefcase className="text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors text-sm" />
                    </div>
                    <CustomDropdown
                      value={role}
                      onChange={(newRole) => setRole(newRole)}
                      options={ROLE_OPTIONS}
                      statusColor="!pl-9 !py-2 !rounded-xl !text-xs sm:!text-sm backdrop-blur-md transition-all duration-300 !bg-white dark:!bg-black/20 !border-slate-200/90 dark:!border-white/10 focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-blue-600/50 shadow-xs dark:shadow-inner !text-slate-900 dark:!text-white hover:!bg-slate-50 dark:hover:!bg-black/30"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 sm:mt-2.5 py-2.5 flex items-center justify-center text-white rounded-xl transition-all duration-300 font-semibold group disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-600/25 hover:shadow-blue-600/40 text-xs sm:text-sm active:scale-[0.99]"
            >
              {isLoading ? (
                <FiLoader className="animate-spin text-base" />
              ) : (
                <>
                  {authMode === 'register'
                    ? 'Register & Sign In'
                    : authMode === 'forgot'
                    ? 'Send Reset Instructions'
                    : authMode === 'reset'
                    ? 'Reset Password'
                    : 'LogIn'}
                  <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform text-sm" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Switch Link */}
          <div className="mt-2.5 sm:mt-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
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
  </div>
  );
};

export default Login;
