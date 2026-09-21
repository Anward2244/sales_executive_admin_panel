import React, { createContext, useState, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertCircle, FiX, FiCheckCircle, FiInfo } from 'react-icons/fi';

const ConfirmationContext = createContext(null);

export const ConfirmationProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    message: '',
    type: 'confirm', // 'confirm' or 'alert'
    alertType: 'info' // 'success', 'error', 'info'
  });

  const resolverRef = useRef(null);

  const confirm = (msg) => {
    setModalState({
      isOpen: true,
      message: msg,
      type: 'confirm',
      alertType: 'info'
    });
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const showAlert = (msg, alertType = 'info') => {
    setModalState({
      isOpen: true,
      message: msg,
      type: 'alert',
      alertType
    });
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const handleConfirm = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
    if (resolverRef.current) resolverRef.current(true);
  };

  React.useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg) => {
      let alertType = 'info';
      if (typeof msg === 'string') {
        const msgLower = msg.toLowerCase();
        if (msgLower.includes('success') || msgLower.includes('✅') || msgLower.includes('successfully') || msgLower.includes('updated') || msgLower.includes('saved')) {
          alertType = 'success';
        } else if (msgLower.includes('failed') || msgLower.includes('error') || msgLower.includes('invalid') || msgLower.includes('cannot') || msgLower.includes('please') || msgLower.includes('only') || msgLower.includes('alert')) {
          alertType = 'error';
        }
      }
      showAlert(String(msg), alertType);
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const handleCancel = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
    if (resolverRef.current) resolverRef.current(false);
  };

  const getAlertIcon = () => {
    if (modalState.alertType === 'success') return <FiCheckCircle size={24} className="text-emerald-600 dark:text-emerald-400" />;
    if (modalState.alertType === 'error') return <FiAlertCircle size={24} className="text-rose-600 dark:text-rose-400" />;
    return <FiInfo size={24} className="text-blue-600 dark:text-blue-400" />;
  };

  const getAlertThemeClass = () => {
    if (modalState.alertType === 'success') return 'from-emerald-500 to-teal-600';
    if (modalState.alertType === 'error') return 'from-rose-500 to-red-600';
    return 'from-blue-500 to-indigo-600';
  };

  const getAlertBgClass = () => {
    if (modalState.alertType === 'success') return 'bg-emerald-50 dark:bg-emerald-500/10';
    if (modalState.alertType === 'error') return 'bg-rose-50 dark:bg-rose-500/10';
    return 'bg-blue-50 dark:bg-blue-500/10';
  };

  const getAlertShadowClass = () => {
    if (modalState.alertType === 'success') return 'shadow-emerald-500/20';
    if (modalState.alertType === 'error') return 'shadow-rose-500/20';
    return 'shadow-blue-500/20';
  };

  return (
    <ConfirmationContext.Provider value={{ confirm, showAlert }}>
      {children}
      {modalState.isOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in duration-200">
          <div className={`relative w-full max-w-md bg-white/20 dark:bg-slate-950/25 border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-2xl ${getAlertShadowClass()} p-6 overflow-hidden animate-in zoom-in-95 duration-200 text-left`}>
            {/* Ambient indicator header */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r ${getAlertThemeClass()} shadow-sm ${getAlertShadowClass()}`}></div>

            <div className="flex gap-4">
              <div className={`p-3 rounded-xl shrink-0 h-fit ${getAlertBgClass()}`}>
                {getAlertIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {modalState.type === 'confirm' ? 'Confirm Action' : 'Notification'}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap">{modalState.message}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              {modalState.type === 'confirm' ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className={`px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all cursor-pointer`}
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConfirm}
                  className={`px-5 py-2 text-xs font-bold text-white bg-linear-to-r ${getAlertThemeClass()} rounded-xl shadow-lg ${getAlertShadowClass()} transition-all cursor-pointer`}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfirmationContext.Provider>
  );
};

export const useConfirm = () => useContext(ConfirmationContext);
