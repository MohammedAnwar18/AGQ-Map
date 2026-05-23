import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { friendService, messageService } from '../services/api';
import DefaultAvatar from './DefaultAvatar';
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
    const [searchQuery, setSearchQuery] = useState('');
    const [lightboxImage, setLightboxImage] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const pressTimerRef = useRef(null);
    const isLongPressRef = useRef(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());

                if (audioChunksRef.current.length === 0) return;
                if (mediaRecorder.discarded) return;

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setUploading(true);
                try {
                    const formData = new FormData();
                    formData.append('image', audioBlob, `voice-note-${Date.now()}.webm`);
                    
                    const response = await friendService.uploadChatImage(formData);

                    const apiResponse = await messageService.sendMessage({
                        receiverId: selectedFriend.id,
                        content: '🎤 رسالة صوتية',
                        imageUrl: response.imageUrl
                    });

                    setMessages(prev => [...prev, apiResponse.message]);
                } catch (error) {
                    console.error('Error uploading voice note:', error);
                    alert('فشل إرسال الرسالة الصوتية');
                } finally {
                    setUploading(false);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('يرجى السماح بالوصول إلى الميكروفون للتسجيل');
        }
    };

    const stopAndSendRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            clearInterval(recordingTimerRef.current);
            mediaRecorderRef.current.discarded = false;
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            clearInterval(recordingTimerRef.current);
            mediaRecorderRef.current.discarded = true;
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            audioChunksRef.current = [];
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const playNotificationSound = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc1.type = 'sine';
            osc2.type = 'triangle';
            
            osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
            
            osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
            osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.08); // A5
            
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
            
            osc1.connect(gainNode);
            osc2.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc1.start();
            osc2.start();
            osc1.stop(audioCtx.currentTime + 0.25);
            osc2.stop(audioCtx.currentTime + 0.25);
        } catch (e) {
            console.warn('Audio Context failed to play notification sound', e);
        }
    };

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
                if (message.sender_id === selectedFriend.id) {
                    setIsTyping(false);
                    // Mark as read immediately on server
                    socket.emit('get-messages', { friendId: selectedFriend.id, userId: user?.id });
                }
            } else {
                // If message is from someone else, play sound and update friend's unread_count and has_chatted
                if (message.sender_id !== user?.id) {
                    playNotificationSound();
                    setFriends(prev => prev.map(f => {
                        if (f.id === message.sender_id) {
                            return {
                                ...f,
                                has_chatted: true,
                                unread_count: (f.unread_count || 0) + 1
                            };
                        }
                        return f;
                    }));
                }
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

        socket.on('user_online', ({ userId }) => {
            setFriends(prev => prev.map(f =>
                f.id === userId ? { ...f, is_online: true } : f
            ));
        });

        socket.on('user_offline', ({ userId }) => {
            setFriends(prev => prev.map(f =>
                f.id === userId ? { ...f, is_online: false } : f
            ));
        });

        socket.on('message-deleted', ({ messageId }) => {
            setMessages(prev => prev.filter(m => m.id != messageId));
        });

        socket.on('conversation-deleted', ({ friendId }) => {
            if (selectedFriend && selectedFriend.id == friendId) {
                setMessages([]);
            }
            setFriends(prev => prev.map(f => {
                if (f.id == friendId) {
                    return { ...f, has_chatted: false, unread_count: 0 };
                }
                return f;
            }));
        });

        return () => {
            socket.off('receive-message');
            socket.off('message-updated');
            socket.off('user-typing');
            socket.off('user-stop-typing');
            socket.off('user_online');
            socket.off('user_offline');
            socket.off('message-deleted');
            socket.off('conversation-deleted');
        };
    }, [socket, selectedFriend, user?.id]);

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
        // Clear unread count locally for this friend immediately
        setFriends(prev => prev.map(f => f.id === friend.id ? { ...f, unread_count: 0 } : f));

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

    const handleDeleteMessage = async (messageId) => {
        if (window.confirm('هل تريد حذف هذه الرسالة؟')) {
            try {
                await messageService.deleteMessage(messageId);
                setMessages(prev => prev.filter(m => m.id !== messageId));
            } catch (error) {
                console.error('Failed to delete message:', error);
                alert('فشل حذف الرسالة');
            }
        }
    };

    const handlePressStart = (friend) => {
        isLongPressRef.current = false;
        pressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            confirmDeleteConversation(friend);
        }, 800);
    };

    const handlePressEnd = (friend) => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
        }
        if (!isLongPressRef.current) {
            loadMessages(friend);
        }
    };

    const confirmDeleteConversation = async (friend) => {
        const name = friend.full_name || friend.username;
        if (window.confirm(`هل تريد حذف المحادثة بالكامل مع ${name}؟`)) {
            try {
                await messageService.deleteConversation(friend.id);
                setFriends(prev => prev.map(f => {
                    if (f.id === friend.id) {
                        return { ...f, has_chatted: false, unread_count: 0 };
                    }
                    return f;
                }));
                if (selectedFriend && selectedFriend.id === friend.id) {
                    setSelectedFriend(null);
                }
            } catch (error) {
                console.error('Failed to delete conversation:', error);
                alert('فشل حذف المحادثة');
            }
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
            // Send via API (primary persistence and socket broadcast)
            const response = await messageService.sendMessage({
                receiverId: selectedFriend.id,
                content: messageContent
            });

            // Update UI with the real saved message
            setMessages(prev => [...prev, response.message]);
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
                        style={{ color: '#e5e7eb', textDecoration: 'underline', wordBreak: 'break-all', fontWeight: '500' }}
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

    const filteredFriends = friends.filter(friend => {
        if (!searchQuery.trim()) {
            return friend.has_chatted;
        }
        const query = searchQuery.toLowerCase().trim();
        const usernameMatch = friend.username?.toLowerCase().includes(query);
        const fullNameMatch = friend.full_name?.toLowerCase().includes(query);
        return usernameMatch || fullNameMatch;
    });

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
                        ) : (
                            <>
                                <div className="chat-search-container">
                                    <span className="chat-search-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                        </svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="chat-search-input"
                                        placeholder="ابحث عن صديق مضاف..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button className="chat-search-clear" onClick={() => setSearchQuery('')}>✕</button>
                                    )}
                                </div>

                                {filteredFriends.length === 0 ? (
                                    <div className="empty-state">
                                        <span className="empty-state-icon">👥</span>
                                        <p>{searchQuery.trim() ? 'لم يتم العثور على صديق يطابق البحث' : 'لا توجد محادثات نشطة بعد'}</p>
                                        <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                            {searchQuery.trim() ? 'تأكد من كتابة الاسم بشكل صحيح' : 'ابحث عن صديق مضاف بالأعلى للبدء بمحادثة معه'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="chat-list">
                                        {filteredFriends.map(friend => (
                                            <div
                                                key={friend.id}
                                                className="chat-item"
                                                onMouseDown={() => handlePressStart(friend)}
                                                onMouseUp={() => handlePressEnd(friend)}
                                                onTouchStart={() => handlePressStart(friend)}
                                                onTouchEnd={() => handlePressEnd(friend)}
                                                onTouchMove={() => {
                                                    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
                                                }}
                                                onMouseLeave={() => {
                                                    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
                                                }}
                                                style={{ userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer' }}
                                            >
                                                <div className="chat-avatar">
                                                    {friend.profile_picture ? (
                                                        <img src={friend.profile_picture} alt={friend.username} />
                                                    ) : (
                                                        <DefaultAvatar gender={friend.gender} size={50} uid={String(friend.id)} />
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
                                                {friend.unread_count > 0 && (
                                                    <span className="unread-badge">{friend.unread_count}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
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
                                    <DefaultAvatar gender={selectedFriend.gender} size={40} uid={`hdr-${selectedFriend.id}`} />
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
                                                <DefaultAvatar gender={user.gender} size={36} uid={`me-${user.id}`} />
                                            )
                                        ) : (
                                            selectedFriend.profile_picture ? (
                                                <img src={selectedFriend.profile_picture} alt={selectedFriend.username} />
                                            ) : (
                                                <DefaultAvatar gender={selectedFriend.gender} size={36} uid={`fr-${selectedFriend.id}`} />
                                            )
                                        )}
                                    </div>
                                    <div
                                        className="message-bubble"
                                        onDoubleClick={() => handleLike(message)}
                                        onClick={(e) => {
                                            if (e.target.tagName !== 'A' && e.target.tagName !== 'IMG' && !e.target.closest('.message-delete-btn')) {
                                                handleDeleteMessage(message.id);
                                            }
                                        }}
                                        style={{ position: 'relative', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                                    >
                                        {message.image_url && (
                                            (message.content === '🎤 رسالة صوتية' || 
                                             message.image_url.includes('.webm') || 
                                             message.image_url.includes('.mp3') || 
                                             message.image_url.includes('.wav') || 
                                             message.image_url.includes('.ogg') || 
                                             message.image_url.includes('.m4a')) ? (
                                                <div className="message-audio-wrapper" style={{ marginTop: '5px', minWidth: '220px', marginBottom: (message.content && message.content !== '🎤 رسالة صوتية') ? '8px' : '0' }}>
                                                    <audio
                                                        src={message.image_url}
                                                        controls
                                                        controlsList="nodownload"
                                                        onPlay={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                                        style={{ width: '100%', height: '40px', borderRadius: '20px' }}
                                                    />
                                                </div>
                                            ) : (
                                                <img
                                                    src={message.image_url}
                                                    alt="مرفق"
                                                    onLoad={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                                    style={{
                                                        maxWidth: '100%',
                                                        borderRadius: '8px',
                                                        marginBottom: (message.content && message.content !== '🎤 رسالة صوتية') ? '8px' : '0',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => setLightboxImage(message.image_url)}
                                                />
                                            )
                                        )}
                                        {message.content && message.content !== '🎤 رسالة صوتية' && (
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
                                            <button 
                                                type="button" 
                                                className="message-delete-btn" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteMessage(message.id);
                                                }}
                                                title="حذف الرسالة"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                            </button>
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
                            {/* 1. Send Button (Right) */}
                            <button
                                type="submit"
                                className="send-button"
                                disabled={!newMessage.trim()}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '42px', height: '42px', padding: 0, borderRadius: '12px',
                                    flexShrink: 0
                                }}
                                title="إرسال"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                                    <path d="M22 2L11 13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>

                            {/* 2. Text Input / Recording Indicator (Middle) */}
                            {isRecording ? (
                                <div className="recording-status">
                                    <span className="recording-dot"></span>
                                    <span className="recording-timer">{formatTime(recordingTime)}</span>
                                    <span>جاري تسجيل الصوت...</span>
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={handleTyping}
                                    className="input"
                                    placeholder="اكتب رسالة..."
                                    autoFocus
                                />
                            )}

                            {/* 3. Actions / Media (Left) */}
                            <div className="input-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                                {isRecording ? (
                                    <>
                                        <button
                                            type="button"
                                            className="btn-record-cancel"
                                            onClick={cancelRecording}
                                            title="إلغاء"
                                        >
                                            ✕
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-record-send"
                                            onClick={stopAndSendRecording}
                                            title="إرسال التسجيل"
                                        >
                                            ✓
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {/* Voice Note Recorder Button */}
                                        <button
                                            type="button"
                                            className="btn-icon btn-voice"
                                            style={{
                                                background: '#10b981',
                                                border: 'none',
                                                color: 'white',
                                                cursor: 'pointer',
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                            onClick={startRecording}
                                            title="تسجيل صوتي"
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                                <line x1="8" y1="23" x2="16" y2="23"></line>
                                            </svg>
                                        </button>

                                        {/* Image Upload Button */}
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
                                    </>
                                )}
                            </div>

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
                        </form>
                    </div>
                )}
                {lightboxImage && (
                    <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
                        <button className="lightbox-close" onClick={() => setLightboxImage(null)}>✕</button>
                        <img src={lightboxImage} alt="عرض الصورة" className="lightbox-image" onClick={(e) => e.stopPropagation()} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatModal;
