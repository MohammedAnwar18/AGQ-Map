import React, { useState, useEffect } from 'react';
import { commentService, postService, friendService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CommentsSection from './CommentsSection';
import FriendButton from './FriendButton';
import './PostDetailModal.css';

const PostDetailModal = ({ post, onClose, onDelete, onUpdate }) => {
    const { user } = useAuth();
    // Local state for immediate UI feedback
    const [likesCount, setLikesCount] = useState(post?.likes_count || 0);
    const [isLiked, setIsLiked] = useState(post?.is_liked || false);
    const [likeAnimating, setLikeAnimating] = useState(false);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [showDetails, setShowDetails] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false); // New state for comment mode
    const [newCommentText, setNewCommentText] = useState(''); // New state for comment input
    const [commentsRefreshTrigger, setCommentsRefreshTrigger] = useState(0); // Trigger to refresh CommentsSection

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
        if (!newCommentText.trim()) {
            setIsCommenting(false);
            return;
        }

        try {
            await commentService.addComment(post.id, newCommentText);
            setNewCommentText('');
            setIsCommenting(false);
            setShowDetails(true); // Open sidebar to see the new comment
            setCommentsRefreshTrigger(prev => prev + 1); // Trigger refresh
            if (onUpdate) {
                onUpdate({
                    ...post,
                    comments_count: (post.comments_count || 0) + 1
                });
            }
        } catch (error) {
            console.error("Failed to send comment", error);
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
            <div className="post-modal-container" onClick={(e) => e.stopPropagation()}>

                {/* Header / Close Button for Mobile */}
                <button className="post-modal-close-btn" onClick={onClose}>✕</button>

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
                                    <form className={`post-pill-action-bar ${isCommenting ? 'comment-mode' : ''}`} onClick={(e) => e.stopPropagation()} onSubmit={handleSendComment}>
                                        <button 
                                            type="button"
                                            className={`pill-btn like-btn ${isLiked ? 'liked' : ''} ${likeAnimating ? 'animating' : ''}`} 
                                            onClick={handleLike}
                                            title="Like"
                                        >
                                            <svg viewBox="0 0 24 24" width="24" height="24">
                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                            </svg>
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
                                                <input 
                                                    autoFocus
                                                    className="pill-comment-input"
                                                    placeholder="اكتب تعليقك هنا..."
                                                    value={newCommentText}
                                                    onChange={(e) => setNewCommentText(e.target.value)}
                                                    onBlur={() => {
                                                        if (!newCommentText.trim()) setIsCommenting(false);
                                                    }}
                                                />
                                            )}
                                        </div>

                                        <div className="pill-divider-line"></div>

                                        <button 
                                            type={isCommenting ? "submit" : "button"}
                                            className={`pill-btn share-btn ${isCommenting ? 'send-mode' : ''}`} 
                                            title={isCommenting ? "إرسال التعليق" : "Share/Send"}
                                            onClick={(e) => {
                                                if (isCommenting) handleSendComment(e);
                                            }}
                                        >
                                            <svg viewBox="0 0 24 24" width="22" height="22">
                                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* Optional: Simple user info floating in image-only mode */}
                            {!showDetails && (
                                <div className="post-modal-user-floating">
                                    <img src={post.user.profile_picture || '/default-avatar.png'} alt="user" />
                                    <span>{post.user.username}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="post-modal-text-only-container">
                            <p className="post-modal-text-large">{post.content}</p>
                            {/* Same action bar for text-only posts */}
                             <div className="post-pill-action-bar-container">
                                    <div className="post-pill-action-bar" onClick={(e) => e.stopPropagation()}>
                                        <button className={`pill-btn like-btn ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
                                             <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                                             <span className="pill-count">{likesCount}</span>
                                        </button>
                                        <div className="pill-divider-line"></div>
                                        <button className="pill-comments-btn" onClick={() => setShowDetails(!showDetails)}>
                                            <svg viewBox="0 0 24 24" width="20" height="20" className="pill-comment-icon"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                                            <span className="pill-comments-text">COMMENTS</span>
                                        </button>
                                        <div className="pill-divider-line"></div>
                                        <button className="pill-btn share-btn">
                                            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        </button>
                                    </div>
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

                        {/* Caption (if image exists, show caption here) */}
                        {post.image_url && post.content && (
                            <p className="post-modal-caption">{post.content}</p>
                        )}

                        {/* Divider */}
                        <div className="post-modal-divider"></div>

                        {/* Comments System */}
                        <div className="post-modal-comments-area">
                            <CommentsSection
                                key={commentsRefreshTrigger}
                                postId={post.id}
                                hideInput={true}
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
