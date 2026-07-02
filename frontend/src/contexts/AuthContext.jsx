import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ✅ Check auth function
  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('token');
    const email = localStorage.getItem('adminEmail');
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';

    if (token && isAuth && email) {
      setUser({ email, token });
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();

    // Listen for storage changes (login/logout from another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'isAuthenticated') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-token-cleared', checkAuth);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-token-cleared', checkAuth);
    };
  }, [checkAuth]);

  // ✅ Login function
  const login = useCallback((token, email) => {
    localStorage.setItem('token', token);
    localStorage.setItem('adminEmail', email);
    localStorage.setItem('isAuthenticated', 'true');
    setUser({ email, token });
    navigate('/');
  }, [navigate]);

  // ✅ Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('isAuthenticated');
    setUser(null);
    navigate('/login');
  }, [navigate]);

  // ✅ Check if user is authenticated
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      isAuthenticated,
      checkAuth
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;