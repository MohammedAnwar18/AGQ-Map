import React, { createContext, useState, useContext, useEffect } from 'react';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // التحقق من Token عند تحميل التطبيق
        if (token) {
            // Check if token has role field (new token format)
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (!payload.role) {
                    // Old token without role - force logout to get new token
                    console.log('⚠️ Old token detected without role. Forcing logout...');
                    logout();
                    return;
                }
            } catch (error) {
                console.error('Invalid token format:', error);
                logout();
                return;
            }

            fetchUserData();
        } else {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        // إنشاء اتصال WebSocket عند تسجيل الدخول
        if (user && token) {
            const newSocket = io(import.meta.env.VITE_WS_URL || 'http://localhost:5000', {
                auth: { token }
            });

            newSocket.on('connect', () => {
                console.log('✅ Connected to WebSocket');
                newSocket.emit('register', user.id);
            });

            newSocket.on('disconnect', () => {
                console.log('❌ Disconnected from WebSocket');
            });

            setSocket(newSocket);

            return () => {
                newSocket.close();
            };
        }
    }, [user, token]);

    const fetchUserData = async () => {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            } else {
                logout();
            }
        } catch (error) {
            console.error('Failed to fetch user data:', error);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = (userData, userToken) => {
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('token', userToken);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        if (socket) {
            socket.close();
        }
    };

    const value = {
        user,
        token,
        loading,
        socket,
        login,
        logout,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
