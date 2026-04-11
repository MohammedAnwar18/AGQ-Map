import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { friendService, messageService } from '../services/api';
import './Modal.css';
import './ChatModalStyles.css';

const ChatModal = ({ onClose }) => {
    const { user, socket } = useAuth();
    const navigate = useNavigate();
    const [friends, setFriends] = useState([]);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [uploading, setUploading] = useState(false);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        loadFriends();
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('receive-message', (message) => {
            if (selectedFriend &&
                (message.sender_id === selectedFriend.id || message.receiver_id === selectedFriend.id)) {
                setMessages(prev => {
                    // Avoid duplicate messages if API and socket both deliver
                    if (prev.find(m => m.id === message.id)) return prev;
                    return [...prev, message];
                });
                // If we receive a message from them, they stopped typing
                if (message.sender_id === selectedFriend.id) setIsTyping(false);
            }
        });

        socket.on('message-updated', (updatedMsg) => {
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        });

        socket.on('user-typing', ({ userId }) => {
            if (selectedFriend && userId === selectedFriend.id) {
                setIsTyping(true);
            }
        });

        socket.on('user-stop-typing', ({ userId }) => {
            if (selectedFriend && userId === selectedFriend.id) {
                setIsTyping(false);
            }
        });

        socket.on('user-online', (userId) => {
            setFriends(prev => prev.map(f =>
                f.id === userId ? { ...f, is_online: true } : f
            ));
        });

        socket.on('user-offline', (userId) => {
            setFriends(prev => prev.map(f =>
                f.id === userId ? { ...f, is_online: false } : f
            ));
        });

        return () => {
            socket.off('receive-message');
            socket.off('message-updated');
            socket.off('user-typing');
            socket.off('user-stop-typing');
            socket.off('user-online');
            socket.off('user-offline');
        };
    }, [socket, selectedFriend]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadFriends = async () => {
        try {
            const data = await friendService.getFriends();
            setFriends(data.friends);
        } catch (error) {
            console.error('Failed to load friends:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (friend) => {
        setSelectedFriend(friend);
        setMessages([]);
        setLoading(true);

        try {
            const data = await messageService.getMessages(friend.id);
            setMessages(data.messages);
            
            // Also notify via socket about reading messages if connected
            if (socket) {
                socket.emit('get-messages', { friendId: friend.id, userId: user.id });
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = (message) => {
        if (!socket || !selectedFriend) return;

        // Optimistic update
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_liked: !m.is_liked } : m));

        socket.emit('like-message', {
            messageId: message.id,
            receiverId: selectedFriend.id
        });
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);

        if (!socket || !selectedFriend) return;

        socket.emit('typing', { receiverId: selectedFriend.id });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stop-typing', { receiverId: selectedFriend.id });
        }, 3000);
    };

    const sendMessage = async (e) => {
        e.preventDefault();

        if (!newMessage.trim() || !selectedFriend) return;

        const messageContent = newMessage.trim();
        setNewMessage('');

        if (socket) {
            socket.emit('stop-typing', { receiverId: selectedFriend.id });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }

        try {
            // Send via API (primary persistence)
            const response = await messageService.sendMessage({
                receiverId: selectedFriend.id,
                content: messageContent
            });

            // Update UI with the real saved message
            setMessages(prev => [...prev, response.message]);

            // Also emit via socket for immediate real-time delivery if socket is connected
            if (socket) {
                socket.emit('send-message', {
                    receiverId: selectedFriend.id,
                    content: messageContent,
                    senderId: user.id
                });
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('فشل إرسال الرسالة، يرجى المحاولة لاحقاً');
        }
    };

    const formatMessageTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessageContent = (content) => {
        if (!content) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = content.split(urlRegex);

        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                return (
                    <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#fbab15', textDecoration: 'underline', wordBreak: 'break-all' }}
                        onClick={(e) => {
                            // If it's an internal map link, let the deep linking logic in Map.jsx handle it
                            if (part.includes(window.location.origin + '/map?')) {
                                e.preventDefault();
                                const url = new URL(part);
                                navigate('/map' + url.search);
                                onClose(); // Close chat to show the map/profile
                            }
                        }}
                    >
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container chat-modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2> الرسائل</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                {!selectedFriend ? (
                    <div className="modal-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                <div className="spinner"></div>
                            </div>
                        ) : friends.length === 0 ? (
                            <div className="empty-state">
                                <span className="empty-state-icon">👥</span>
                                <p>ليس لديك أصدقاء بعد</p>
                                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                    أضف أصدقاء لبدء المحادثات
                                </p>
                            </div>
                        ) : (
                            <div className="chat-list">
                                {friends.map(friend => (
                                    <div
                                        key={friend.id}
                                        className="chat-item"
                                        onClick={() => loadMessages(friend)}
                                    >
                                        <div className="chat-avatar">
                                            {friend.profile_picture ? (
                                                <img src={friend.profile_picture} alt={friend.username} />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {friend.username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            {friend.is_online && <div className="online-indicator" />}
                                        </div>
                                        <div className="chat-info">
                                            <div className="chat-name">
                                                {friend.full_name || friend.username}
                                            </div>
                                            <div className="chat-last-message">
                                                {friend.is_online ? 'متصل الآن' : 'غير متصل'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="messages-container">
                        <div className="messages-header">
                            <button className="back-button" onClick={() => setSelectedFriend(null)}>
                                ←
                            </button>
                            <div className="chat-avatar" style={{ width: '40px', height: '40px' }}>
                                {selectedFriend.profile_picture ? (
                                    <img src={selectedFriend.profile_picture} alt={selectedFriend.username} />
                                ) : (
                                    <div className="avatar-placeholder">
                                        {selectedFriend.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                {selectedFriend.is_online && <div className="online-indicator" />}
                            </div>
                            <div>
                                <div className="chat-name">
                                    {selectedFriend.full_name || selectedFriend.username}
                                </div>
                                <div className="chat-last-message" style={{ fontSize: '0.8rem' }}>
                                    {selectedFriend.is_online ? 'متصل الآن' : 'غير متصل'}
                                </div>
                            </div>
                        </div>

                        <div className="messages-list">
                            {messages.map((message, index) => (
                                <div
                                    key={message.id || index}
                                    className={`message-item ${message.sender_id === user.id ? 'own' : ''}`}
                                >
                                    <div className="message-avatar">
                                        {message.sender_id === user.id ? (
                                            user.profile_picture ? (
                                                <img src={user.profile_picture} alt="You" />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                            )
                                        ) : (
                                            selectedFriend.profile_picture ? (
                                                <img src={selectedFriend.profile_picture} alt={selectedFriend.username} />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {selectedFriend.username.charAt(0).toUpperCase()}
                                                </div>
                                            )
                                        )}
                                    </div>
                                    <div
                                        className="message-bubble"
                                        onDoubleClick={() => handleLike(message)}
                                        style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
                                    >
                                        {message.image_url && (
                                            <img
                                                src={message.image_url}
                                                alt="مرفق"
                                                onLoad={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                                style={{
                                                    maxWidth: '100%',
                                                    borderRadius: '8px',
                                                    marginBottom: message.content ? '8px' : '0',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => window.open(message.image_url, '_blank')}
                                            />
                                        )}
                                        {message.content && (
                                            <div className="message-text">
                                                {renderMessageContent(message.content)}
                                            </div>
                                        )}
                                        {message.is_liked && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '-10px',
                                                [message.sender_id === user.id ? 'left' : 'right']: '-6px',
                                                zIndex: 10,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))'
                                            }}>
                                                <svg width="24px" height="24px" viewBox="0 0 48 48" version="1" xmlns="http://www.w3.org/2000/svg" enableBackground="new 0 0 48 48">
                                                    <path fill="#ff1100" stroke="#fbab15" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M34,9c-4.2,0-7.9,2.1-10,5.4C21.9,11.1,18.2,9,14,9C7.4,9,2,14.4,2,21c0,11.9,22,24,22,24s22-12,22-24 C46,14.4,40.6,9,34,9z"></path>
                                                </svg>
                                            </div>
                                        )}
                                        <div className="message-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', marginTop: '4px' }}>
                                            <span className="message-time">
                                                {formatMessageTime(message.created_at)}
                                            </span>
                                            {message.sender_id === user.id && (
                                                <span className="message-status" title={message.status === 'failed' ? 'لم تصل' : (message.is_read ? 'تمت القراءة' : 'تم الاستلام')} style={{ display: 'flex', alignItems: 'center' }}>
                                                    {message.status === 'failed' ? (
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <line x1="12" y1="8" x2="12" y2="12"></line>
                                                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                                        </svg>
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={message.is_read ? "#10b981" : "#ef4444"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M20 6L9 17l-5-5"></path>
                                                            <path d="M20 12L13 19l-2-2" style={{ opacity: message.is_read ? 1 : 0.7 }}></path>
                                                        </svg>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {isTyping && (
                                <div className="typing-indicator" style={{ padding: '10px', color: '#666', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                    {selectedFriend.username} يكتب الآن...
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={sendMessage} className="message-input-container">
                            <button
                                type="button"
                                className="btn-icon"
                                style={{
                                    background: '#fbab15',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    flexShrink: 0,
                                    opacity: uploading ? 0.7 : 1
                                }}
                                title="إرسال صورة"
                                onClick={() => !uploading && document.getElementById('chat-image-input').click()}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                        <polyline points="21 15 16 10 5 21"></polyline>
                                    </svg>
                                )}
                            </button>
                            <input
                                type="file"
                                id="chat-image-input"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                    if (e.target.files[0]) {
                                        const file = e.target.files[0];
                                        setUploading(true);
                                        try {
                                            const formData = new FormData();
                                            formData.append('image', file);
                                            const response = await friendService.uploadChatImage(formData);

                                            // Send via API
                                            const apiResponse = await messageService.sendMessage({
                                                receiverId: selectedFriend.id,
                                                content: '',
                                                imageUrl: response.imageUrl
                                            });

                                            setMessages(prev => [...prev, apiResponse.message]);

                                            // Also emit via socket
                                            if (socket) {
                                                socket.emit('send-message', {
                                                    receiverId: selectedFriend.id,
                                                    content: '',
                                                    imageUrl: response.imageUrl,
                                                    senderId: user.id
                                                });
                                            }
                                        } catch (error) {
                                            console.error('Error uploading image:', error);
                                            alert('فشل رفع الصورة');
                                        } finally {
                                            setUploading(false);
                                            e.target.value = null;
                                        }
                                    }
                                }}
                            />
                            <input
                                type="text"
                                value={newMessage}
                                onChange={handleTyping}
                                className="input"
                                placeholder="اكتب رسالة..."
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="send-button"
                                disabled={!newMessage.trim()}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '42px', height: '42px', padding: 0, borderRadius: '50%',
                                    flexShrink: 0
                                }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatModal;
