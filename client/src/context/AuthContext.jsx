import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

const getCachedUser = () => {
    try {
        const raw = localStorage.getItem('user_cache');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const setCachedUser = (user) => {
    if (user) localStorage.setItem('user_cache', JSON.stringify(user));
    else localStorage.removeItem('user_cache');
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);

    // Refs so event listeners always have the latest values
    const socketRef = useRef(null);
    const userRef = useRef(null);
    const tokenRef = useRef(null);

    useEffect(() => { socketRef.current = socket; }, [socket]);
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { tokenRef.current = token; }, [token]);

    // ── Startup: validate token ─────────────────────────────────────────────
    useEffect(() => {
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (!payload.role) {
                    // Old token format — force re-login
                    hardLogout();
                    return;
                }
                // JWT expired check
                if (payload.exp && payload.exp * 1000 < Date.now()) {
                    hardLogout();
                    return;
                }
            } catch {
                hardLogout();
                return;
            }
            fetchUserData();
        } else {
            setLoading(false);
        }
    }, [token]);

    // ── WebSocket setup with auto-reconnect ─────────────────────────────────
    useEffect(() => {
        if (!user || !token) return;

        const newSocket = io(import.meta.env.VITE_WS_URL || window.location.origin || 'http://localhost:5000', {
            auth: { token },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 8000,
        });

        const onConnect = () => newSocket.emit('register', user.id);
        const onReconnect = () => newSocket.emit('register', user.id);

        newSocket.on('connect', onConnect);
        newSocket.on('reconnect', onReconnect);

        setSocket(newSocket);
        socketRef.current = newSocket;

        return () => {
            newSocket.off('connect', onConnect);
            newSocket.off('reconnect', onReconnect);
            newSocket.close();
        };
    }, [user?.id, token]);

    // ── Re-register / reconnect when app comes back to foreground ───────────
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return;

            // Reconnect WebSocket if needed
            const s = socketRef.current;
            const u = userRef.current;
            if (s && u) {
                if (!s.connected) s.connect();
                else s.emit('register', u.id);
            }

            // Silently refresh user data from server
            const t = tokenRef.current;
            if (t && u) {
                const apiUrl = import.meta.env.VITE_API_URL || '/api';
                fetch(`${apiUrl}/auth/me`, {
                    headers: { Authorization: `Bearer ${t}` }
                })
                    .then(r => (r.ok ? r.json() : null))
                    .then(data => {
                        if (data?.user) {
                            setUser(data.user);
                            setCachedUser(data.user);
                        }
                    })
                    .catch(() => {});
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    // ── Keep session alive with ping every 4 minutes ────────────────────────
    useEffect(() => {
        if (!token || !user) return;

        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        const ping = () => {
            if (document.visibilityState !== 'visible') return;
            fetch(`${apiUrl}/auth/me`, {
                headers: { Authorization: `Bearer ${tokenRef.current}` }
            })
                .then(r => (r.ok ? r.json() : null))
                .then(data => {
                    if (data?.user) {
                        setUser(data.user);
                        setCachedUser(data.user);
                    }
                })
                .catch(() => {});
        };

        const interval = setInterval(ping, 4 * 60 * 1000);
        return () => clearInterval(interval);
    }, [!!user, !!token]);

    // ── Register periodic background sync (Chrome Android) ─────────────────
    useEffect(() => {
        if (!user) return;
        if ('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.ready
                .then(reg => reg.periodicSync.register('session-keepalive', { minInterval: 5 * 60 * 1000 }))
                .catch(() => {});
        }
    }, [!!user]);

    // ── Fetch fresh user data ───────────────────────────────────────────────
    const fetchUserData = async () => {
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        try {
            const response = await fetch(`${apiUrl}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                setCachedUser(data.user);
            } else if (response.status === 401 || response.status === 403) {
                // Token truly invalid
                setCachedUser(null);
                hardLogout();
            }
            // Other server errors (500) — don't log out
        } catch {
            // No network — load from local cache so app works offline
            const cached = getCachedUser();
            if (cached) {
                setUser(cached);
            } else {
                hardLogout();
            }
        } finally {
            setLoading(false);
        }
    };

    const hardLogout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        setCachedUser(null);
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
        setLoading(false);
    };

    const login = (userData, userToken) => {
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('token', userToken);
        setCachedUser(userData);
    };

    const updateUser = (updates) => {
        setUser(prev => {
            const next = { ...prev, ...updates };
            setCachedUser(next);
            return next;
        });
    };

    const logout = () => hardLogout();

    const value = {
        user,
        token,
        loading,
        socket,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
