import React, { createContext, useState, useContext, useEffect } from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [chatCount, setChatCount] = useState(0);
  const [newUserCount, setNewUserCount] = useState(0);
  const [newOrderCount, setNewOrderCount] = useState(0);

  useEffect(() => {
    // Example: listen to WebSocket events here if you have real-time updates
    // socket.on('new_message', () => setChatCount(prev => prev + 1));
    // socket.on('new_user', () => setNewUserCount(prev => prev + 1));
    // socket.on('new_order', () => setNewOrderCount(prev => prev + 1));
    
    // Cleanup on unmount
    return () => {
      // socket.off('new_message');
      // socket.off('new_user');
      // socket.off('new_order');
    };
  }, []);

  // Expose functions to reset the counts when the user visits those pages
  const clearChatCount = () => setChatCount(0);
  const clearNewUserCount = () => setNewUserCount(0);
  const clearNewOrderCount = () => setNewOrderCount(0);

  return (
    <NotificationContext.Provider value={{
      chatCount, setChatCount, clearChatCount,
      newUserCount, setNewUserCount, clearNewUserCount,
      newOrderCount, setNewOrderCount, clearNewOrderCount
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);