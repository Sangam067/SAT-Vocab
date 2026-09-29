import React, { createContext, useContext, useState } from 'react';
import { syncGuestProgressToUser } from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('sat_vocab_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const saveUserSession = async (user) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem('sat_vocab_user', JSON.stringify(user));
      // Seamlessly transfer any guest practice/mastered words to their database account
      await syncGuestProgressToUser(user.id);
    } else {
      localStorage.removeItem('sat_vocab_user');
    }
  };

  const logout = () => {
    saveUserSession(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, saveUserSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
