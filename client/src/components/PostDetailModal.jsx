import React, { useState, useEffect } from 'react';
import { commentService, postService, friendService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CommentsSection from './CommentsSection';
import FriendButton from './FriendButton';
import './PostDetailModal.css';

const PostDetailModal = ({ post, onClose, onDelete, onUpdate, isFloraCommunityContext = false }) => {
    const { user } = useAuth();

    // --- Extract plant info from content (Flora Palestina format) ---
    const extractPlantInfo = (text) => {
        if (!text) return null;
        const plantMatch = text.match(/🌿\s*([^\r\n]+)/);
        const sciMatch = text.match(/📋\s*([^\r\n]+)/);
        if (plantMatch) {
            const rawName = plantMatch[1].trim();
            const parts = rawName.split(' / ');
            const arName = parts[0] ? parts[0].trim() : rawName;
            const enName = parts.length > 1 ? parts.slice(1).join(' / ').trim() : null;
            
            return {
                name: rawName,
                ar: arName,
                en: enName,
                sci: sciMatch ? sciMatch[1].trim() : null
            };
        }
        return null;
    };

    // Content without the plant tag (to avoid showing it twice)
    const plantInfo = extractPlantInfo(post?.content);
    const cleanContent = post?.content
        ? post.content
            .replace(/🌿\s*[^\r\n]+(?:\r?\n|$)/g, '')
            .replace(/📋\s*[^\r\n]+(?:\r?\n|$)/g, '')
            .trim()
        : '';
        
    // Apply styling if it's the Flora community OR has plant info
    const isFloraComm = isFloraCommunityContext || post?.community_id === 6 || !!plantInfo;
    // Local state for immediate UI feedback
    const [likesCount, setLikesCount] = useState(post?.likes_count || 0);
    const [isLiked, setIsLiked] = useState(post?.is_liked || false);
    const [likeAnimating, setLikeAnimating] = useState(false);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [showDetails, setShowDetails] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false);
    const [newCommentText, setNewCommentText] = useState('');
    const [commentsRefreshTrigger, setCommentsRefreshTrigger] = useState(0);
    const [replyingTo, setReplyingTo] = useState(null); // New state for tracking replies

    const mediaList = post.media_urls || (post.image_url ? [post.image_url] : []);
    const hasMultipleMedia = mediaList.length > 1;

    useEffect(() => {
        if (post) {
            setLikesCount(post.likes_count || 0);
            setIsLiked(post.is_liked || false);
            setCurrentMediaIndex(0); // Reset index on open
        }
    }, [post]);

    if (!post) return null;

    const nextMedia = (e) => {
        e.stopPropagation();
        setCurrentMediaIndex((prev) => (prev + 1) % mediaList.length);
    };

    const prevMedia = (e) => {
        e.stopPropagation();
        setCurrentMediaIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
    };

    const handleLike = async () => {
        if (!user) return;

        // Optimistic update
        const newIsLiked = !isLiked;
        const newCount = newIsLiked ? likesCount + 1 : (likesCount > 0 ? likesCount - 1 : 0);

        setIsLiked(newIsLiked);
        setLikesCount(newCount);
        setLikeAnimating(true);
        setTimeout(() => setLikeAnimating(false), 300);

        // Notify parent immediately for visual sync in map markers
        if (onUpdate) {
            onUpdate({
                ...post,
                is_liked: newIsLiked,
                likes_count: newCount
            });
        }

        try {
            const data = await postService.toggleLike(post.id);
            // Sync with actual server count if different
            if (data.likes_count !== newCount) {
                setLikesCount(data.likes_count);
                if (onUpdate) onUpdate({ ...post, likes_count: data.likes_count, is_liked: data.is_liked });
            }
        } catch (error) {
            console.error("Failed to toggle like", error);
            // Revert state on error
            setIsLiked(!newIsLiked);
            setLikesCount(likesCount);
            if (onUpdate) onUpdate(post);
        }
    };

    const handleDelete = () => {
        if (window.confirm("هل أنت متأكد من حذف هذا المنشور؟")) {
            if (onDelete) {
                onDelete(post.id);
                onClose();
            }
        }
    };

    const handleSendComment = async (e) => {
        if (e) e.preventDefault();
        const text = newCommentText.trim();
        if (!text) {
            setIsCommenting(false);
            setReplyingTo(null);
            return;
        }

        try {
            const parentId = replyingTo ? replyingTo.id : null;
            await commentService.addComment(post.id, text, parentId);
            setNewCommentText('');
            setIsCommenting(false);
            setReplyingTo(null);
            setShowDetails(true); // Open sidebar to see the new comment
            setCommentsRefreshTrigger(prev => prev + 1); // Trigger refresh
            if (onUpdate) {
                onUpdate({
                    ...post,
                    comments_count: (parseInt(post.comments_count) || 0) + 1
                });
            }
        } catch (error) {
            console.error("Failed to send comment", error);
            alert('حدث خطأ أثناء إرسال التعليق. يرجى المحاولة لاحقاً.');
        }
    };

    const getImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '';
        return `${baseUrl}${url}`;
    };

    const renderMediaItem = (url) => {
        const isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || post.media_type === 'video';
        const fullUrl = getImageUrl(url);

        if (isVideo) {
            return (
                <video
                    src={fullUrl}
                    controls
                    className="post-modal-image"
                    autoPlay
                    loop
                />
            );
        } else {
            return (
                <img
                    src={fullUrl}
                    alt="Post"
                    className="post-modal-image"
                    onError={(e) => {
                        e.target.style.display = 'none';
                    }}
                />
            );
        }
    };

    return (
        <div className="post-modal-overlay" onClick={onClose}>
            {isFloraComm && (
                <style>{`
                    .flora-pill {
                        background: rgba(22, 101, 52, 0.85) !important;
                        border: 1px solid rgba(134, 239, 172, 0.4) !important;
                    }
                    .flora-pill .pill-btn, .flora-pill .pill-comments-btn {
                        color: rgba(255, 255, 255, 0.9) !important;
                    }
                    .flora-pill .pill-count, .flora-pill .pill-comments-text {
                        color: rgba(255, 255, 255, 0.9) !important;
                    }
                    .flora-pill .pill-divider-line {
                        background: rgba(255, 255, 255, 0.2) !important;
                    }
                    .flora-pill .like-btn.liked {
                        color: #86efac !important;
                    }
                    .flora-pill .like-btn.liked svg {
                        fill: #86efac !important;
                        stroke: #86efac !important;
                        filter: drop-shadow(0 0 8px rgba(134, 239, 172, 0.6)) !important;
                    }
                    .flora-pill .share-btn.send-mode {
                        background: #16a34a !important;
                        color: white !important;
                    }
                    /* Make default user pill green for this community */
                    .post-modal-user-floating {
                        border-color: rgba(34, 197, 94, 0.7) !important;
                        box-shadow: 0 4px 20px rgba(22, 101, 52, 0.4) !important;
                    }
                    .post-modal-user-floating img {
                        border-color: #22c55e !important;
                    }
                    .post-modal-user-floating span {
                        color: #dcfce7 !important;
                    }
                `}</style>
            )}
            <div className="post-modal-container" onClick={(e) => e.stopPropagation()}>

                {/* New Back Button in Top Bar Area */}
                <button className="post-modal-back-btn" onClick={onClose} title="العودة">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>

                <div className={`post-modal-content ${showDetails ? 'show-details' : 'image-only'}`}>
                    {/* Image/Video Section */}
                    {mediaList.length > 0 ? (
                        <div className="post-modal-main-container">
                            <div className="post-modal-image-container">

                                {/* Navigation Buttons */}
                                {hasMultipleMedia && (
                                    <>
                                        <button className="media-nav-btn prev" onClick={prevMedia}>‹</button>
                                        <button className="media-nav-btn next" onClick={nextMedia}>›</button>
                                        <div className="media-indicators">
                                            {mediaList.map((_, idx) => (
                                                <span
                                                    key={idx}
                                                    className={`indicator-dot ${idx === currentMediaIndex ? 'active' : ''}`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}

                                {renderMediaItem(mediaList[currentMediaIndex])}

                                {/* NEW DESIGN: ACTION BAR PILL */}
                                <div className="post-pill-action-bar-container">
                                    <form className={`post-pill-action-bar ${isCommenting ? 'comment-mode' : ''} ${isFloraComm ? 'flora-pill' : ''}`} onClick={(e) => e.stopPropagation()} onSubmit={handleSendComment}>
                                        <button 
                                            type="button"
                                            className={`pill-btn like-btn ${isLiked ? 'liked' : ''} ${likeAnimating ? 'animating' : ''}`} 
                                            onClick={handleLike}
                                            title="Like"
                                        >
                                            {isFloraComm ? (
                                                <svg viewBox="0 0 24 24" width="24" height="24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                                                    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                                                </svg>
                                            ) : (
                                                <svg viewBox="0 0 24 24" width="24" height="24">
                                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                                </svg>
                                            )}
                                            <span className="pill-count">{likesCount}</span>
                                        </button>

                                        <div className="pill-divider-line"></div>

                                        <div className="pill-center-area">
                                            {!isCommenting ? (
                                                <button 
                                                    type="button"
                                                    className={`pill-comments-btn ${showDetails ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setIsCommenting(true);
                                                        setShowDetails(true);
                                                    }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="20" height="20" className="pill-comment-icon">
                                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                                    </svg>
                                                    <span className="pill-comments-text">COMMENTS</span>
                                                </button>
                                            ) : (
                                                <div className="pill-input-container">
                                                    {replyingTo && (
                                                        <span className="pill-reply-tag">
                                                            الرد على @{replyingTo.username} 
                                                            <button className="cancel-pill-reply" onClick={() => setReplyingTo(null)}>×</button>
                                                        </span>
                                                    )}
                                                    <input 
                                                        autoFocus
                                                        className="pill-comment-input"
                                                        placeholder={replyingTo ? `اكتب ردك هنا...` : "اكتب تعليقك هنا..."}
                                                        value={newCommentText}
                                                        onChange={(e) => setNewCommentText(e.target.value)}
                                                        autoComplete="off"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="pill-divider-line"></div>

                                        <button 
                                            type="submit"
                                            className={`pill-btn share-btn ${isCommenting ? 'send-mode' : ''}`} 
                                            title={isCommenting ? "إرسال التعليق" : "Share/Send"}
                                            onClick={(e) => {
                                                if (!isCommenting) {
                                                    // Add share logic if needed or just toggle commenting
                                                    setIsCommenting(true);
                                                    setShowDetails(true);
                                                }
                                            }}
                                        >
                                            <svg viewBox="0 0 24 24" width="22" height="22">
                                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* Simple user info floating in image-only mode (Shows Plant Name if available) */}
                            {!showDetails && (
                                <div className="post-modal-user-floating">
                                    <img src={post.user.profile_picture || '/default-avatar.png'} alt="user" />
                                    {plantInfo ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', direction: 'rtl' }}>
                                            <span style={{ fontSize: '1.05rem', color: '#dcfce7', lineHeight: '1.2', textAlign: 'center' }}>
                                                {plantInfo.ar} {plantInfo.sci ? <span style={{ fontSize: '0.85rem', color: '#bbf7d0', fontWeight: 'normal' }}> / {plantInfo.sci}</span> : ''}
                                            </span>
                                            {plantInfo.en && (
                                                <span style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 'normal', lineHeight: '1', marginTop: '3px', fontStyle: 'italic', textAlign: 'center' }}>
                                                    {plantInfo.en}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span>{post.user.username}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="post-modal-text-only-container">
                            <p className="post-modal-text-large">{post.content}</p>
                            {/* Same action bar for text-only posts */}
                                <div className="post-pill-action-bar-container">
                                    <form className={`post-pill-action-bar ${isCommenting ? 'comment-mode' : ''} ${isFloraComm ? 'flora-pill' : ''}`} onClick={(e) => e.stopPropagation()} onSubmit={handleSendComment}>
                                        <button 
                                            type="button"
                                            className={`pill-btn like-btn ${isLiked ? 'liked' : ''}`} 
                                            onClick={handleLike}
                                        >
                                             {isFloraComm ? (
                                                <svg viewBox="0 0 24 24" width="24" height="24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                                                    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                                                </svg>
                                            ) : (
                                                <svg viewBox="0 0 24 24" width="24" height="24">
                                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                                </svg>
                                            )}
                                             <span className="pill-count">{likesCount}</span>
                                        </button>
                                        
                                        <div className="pill-divider-line"></div>
                                        
                                        <div className="pill-center-area">
                                            {!isCommenting ? (
                                                <button 
                                                    type="button"
                                                    className={`pill-comments-btn ${showDetails ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setIsCommenting(true);
                                                        setShowDetails(true);
                                                    }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="20" height="20" className="pill-comment-icon">
                                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                                    </svg>
                                                    <span className="pill-comments-text">COMMENTS</span>
                                                </button>
                                            ) : (
                                                <div className="pill-input-container">
                                                    <input 
                                                        autoFocus
                                                        className="pill-comment-input"
                                                        placeholder="اكتب تعليقك هنا..."
                                                        value={newCommentText}
                                                        onChange={(e) => setNewCommentText(e.target.value)}
                                                        autoComplete="off"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="pill-divider-line"></div>
                                        
                                        <button 
                                            type="submit"
                                            className={`pill-btn share-btn ${isCommenting ? 'send-mode' : ''}`}
                                            onClick={(e) => {
                                                if (!isCommenting) {
                                                    setIsCommenting(true);
                                                    setShowDetails(true);
                                                }
                                            }}
                                        >
                                            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        </button>
                                    </form>
                                </div>
                        </div>
                    )}

                    {/* Details Section (Sidebar or Bottom) - Now conditional or drawer-like */}
                    <div className={`post-modal-details ${showDetails ? 'visible' : 'hidden'}`}>

                        {/* User Header */}
                        <div className="post-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="post-modal-user-info">
                                <img
                                    src={post.user.profile_picture || '/default-avatar.png'}
                                    alt={post.user.username}
                                    className="post-modal-avatar"
                                />
                                <div className="post-modal-user-text">
                                    <h4 className="post-modal-username">{post.user.full_name || post.user.username}</h4>
                                    <span className="post-modal-time">{new Date(post.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                 {/* Close Details Button */}
                                 <button className="details-close-btn" onClick={() => setShowDetails(false)}>✕</button>

                                {/* Add Friend Button */}
                                {user && user.id !== post.user.id && (
                                    <FriendButton
                                        userId={post.user.id}
                                        isFriend={post.user.is_friend}
                                        hasRequest={post.user.has_pending_request}
                                    />
                                )}

                                {/* Delete Option for Owner - Redesigned Trash Icon */}
                                {user && user.id === post.user.id && (
                                    <button className="post-modal-delete-pill" onClick={handleDelete} title="حذف المنشور">
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Caption (if image exists, show caption here — without plant tag) */}
                        {post.image_url && cleanContent && (
                            <p className="post-modal-caption">{cleanContent}</p>
                        )}

                        {/* Divider */}
                        <div className="post-modal-divider"></div>

                        {/* Comments System */}
                        <div className="post-modal-comments-area">
                            <CommentsSection
                                key={commentsRefreshTrigger}
                                postId={post.id}
                                hideInput={true}
                                onReply={(replyData) => {
                                    setReplyingTo(replyData);
                                    setIsCommenting(true);
                                }}
                                onCommentAdded={() => {
                                    if (onUpdate) {
                                        onUpdate({
                                            ...post,
                                            comments_count: (post.comments_count || 0) + 1
                                        });
                                    }
                                }}
                            />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PostDetailModal;
