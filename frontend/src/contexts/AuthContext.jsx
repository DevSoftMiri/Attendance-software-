import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadSession() {
            try {
                const { data } = await api.get('/auth/me');
                if (mounted) {
                    setUser(data.user);
                }
            } catch {
                if (mounted) {
                    const cached = localStorage.getItem('attendance-user');
                    setUser(cached ? JSON.parse(cached) : null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadSession();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (user) {
            localStorage.setItem('attendance-user', JSON.stringify(user));
        } else {
            localStorage.removeItem('attendance-user');
        }
    }, [user]);

    async function login(credentials) {
        const { data } = await api.post('/auth/login', credentials);
        setUser(data.user);
        return data;
    }

    async function logout() {
        try {
            await api.post('/auth/logout');
        } finally {
            setUser(null);
        }
    }

    const value = useMemo(
        () => ({ user, loading, login, logout, isAuthenticated: Boolean(user) }),
        [user, loading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider');
    }

    return context;
}
