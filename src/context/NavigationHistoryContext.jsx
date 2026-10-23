import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const NavigationHistoryContext = createContext({
  canGoBack: false,
  goBack: () => {},
  markMenuNavigation: () => {},
  previousPage: null,
  historyStack: []
});

export const NavigationHistoryProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Stack of visited locations: Array of { pathname, search, title }
  const [historyStack, setHistoryStack] = useState(() => [
    { pathname: location.pathname, search: location.search, title: typeof document !== 'undefined' ? document.title : '' }
  ]);

  // Flag indicating the upcoming route change was initiated by a menu click
  const isMenuClickRef = useRef(false);
  // Flag indicating we are executing goBack()
  const isBackNavRef = useRef(false);
  // Track last seen pathname to distinguish intra-page parameter updates from page hops
  const lastPathnameRef = useRef(location.pathname);

  // Global capture click listener to reliably detect clicks on any navigation menu element
  useEffect(() => {
    const handleCaptureClick = (e) => {
      // Matches:
      // 1. Any link or button inside the sidebar <aside>
      // 2. Any element explicitly tagged with data-nav-menu="true"
      // 3. Any link inside the top profile dropdown menu
      // 4. Any logo link
      const menuTarget = e.target.closest(
        'aside a, aside button[data-nav-path], [data-nav-menu="true"], #profile-menu a, [data-profile-menu] a, [data-logo-link]'
      );
      if (menuTarget) {
        isMenuClickRef.current = true;
      }
    };

    window.addEventListener('click', handleCaptureClick, true);
    return () => window.removeEventListener('click', handleCaptureClick, true);
  }, []);

  // Listen for location changes
  useEffect(() => {
    const currentLoc = {
      pathname: location.pathname,
      search: location.search,
      title: typeof document !== 'undefined' ? document.title : ''
    };

    // If pathname is identical, it's intra-page navigation (e.g. query parameter filter or tab switch)
    if (location.pathname === lastPathnameRef.current) {
      setHistoryStack((prev) => {
        if (prev.length === 0) return [currentLoc];
        const newStack = [...prev];
        newStack[newStack.length - 1] = currentLoc;
        return newStack;
      });
      return;
    }

    lastPathnameRef.current = location.pathname;

    // Check if navigation was initiated by a menu button click or explicit fromMenu state
    if (isMenuClickRef.current || location.state?.fromMenu) {
      isMenuClickRef.current = false;
      // Reset the navigation history chain to just this root destination
      setHistoryStack([currentLoc]);
      return;
    }

    // Check if this was a programmatic back navigation
    if (isBackNavRef.current) {
      isBackNavRef.current = false;
      return;
    }

    // Otherwise, this was navigated through another page!
    setHistoryStack((prev) => {
      // If the top of the stack is already this path, update it
      if (prev.length > 0 && prev[prev.length - 1].pathname === currentLoc.pathname) {
        const newStack = [...prev];
        newStack[newStack.length - 1] = currentLoc;
        return newStack;
      }
      return [...prev, currentLoc];
    });
  }, [location.pathname, location.search, location.state]);

  // Handle browser native Back/Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      setHistoryStack((prev) => {
        if (prev.length > 1) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Back button should only be visible when navigated through another page (stack length > 1)
  const canGoBack = historyStack.length > 1;
  const previousPage = canGoBack ? historyStack[historyStack.length - 2] : null;

  const markMenuNavigation = () => {
    isMenuClickRef.current = true;
  };

  const goBack = () => {
    if (historyStack.length > 1) {
      isBackNavRef.current = true;
      const target = historyStack[historyStack.length - 2];
      setHistoryStack((prev) => prev.slice(0, -1));
      if (target?.pathname) {
        navigate(target.pathname + (target.search || ''));
      } else {
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  };

  return (
    <NavigationHistoryContext.Provider
      value={{
        canGoBack,
        goBack,
        markMenuNavigation,
        previousPage,
        historyStack
      }}
    >
      {children}
    </NavigationHistoryContext.Provider>
  );
};

export const useNavigationHistory = () => useContext(NavigationHistoryContext);
