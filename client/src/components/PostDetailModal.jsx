import React, { useState, useEffect } from 'react';
import { commentService, postService } from '../services/api'; // Assuming postService is needed for delete
import { useAuth } from '../context/AuthContext';
import CommentsSection from './CommentsSection';
import './PostDetailModal.css';

const PostDetailModal = ({ post, onClose, onDelete, onUpdate }) => {
    const { user } = useAuth();
    // Local state for immediate UI feedback
    const [likesCount, setLikesCount] = useState(post?.likes_count || 0);
    const [isLiked, setIsLiked] = useState(post?.is_liked || false);
    const [likeAnimating, setLikeAnimating] = useState(false);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

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
        setIsLiked(newIsLiked);
        setLikesCount(prev => newIsLiked ? prev + 1 : prev - 1);
        setLikeAnimating(true);
        setTimeout(() => setLikeAnimating(false), 300);

        try {
            await postService.toggleLike(post.id);
            // Optionally refresh post data
        } catch (error) {
            console.error("Failed to toggle like", error);
            // Revert on error
            setIsLiked(!newIsLiked);
            setLikesCount(prev => !newIsLiked ? prev + 1 : prev - 1);
        }
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete(post.id);
            onClose();
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
                    style={{ objectFit: 'contain' }}
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

                <div className="post-modal-content">
                    {/* Image/Video Section */}
                    {mediaList.length > 0 ? (
                        <div className="post-modal-image-container" style={{ position: 'relative' }}>

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
                        </div>
                    ) : (
                        <div className="post-modal-text-only-container">
                            <p className="post-modal-text-large">{post.content}</p>
                        </div>
                    )}

                    {/* Details Section (Sidebar or Bottom) */}
                    <div className="post-modal-details">

                        {/* User Header */}
                        <div className="post-modal-header">
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

                            {/* Delete Option for Owner */}
                            {user && user.id === post.user.id && (
                                <button className="post-modal-delete-btn" onClick={handleDelete} title="حذف المنشور">
                                    🗑️
                                </button>
                            )}
                        </div>

                        {/* Caption (if image exists, show caption here) */}
                        {post.image_url && post.content && (
                            <p className="post-modal-caption">{post.content}</p>
                        )}

                        {/* Likes & Interaction Bar */}
                        <div className="post-modal-actions" style={{ padding: '0 1rem 0.5rem', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div
                                className={`like-button-container ${likeAnimating ? 'animating' : ''}`}
                                onClick={handleLike}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease'
                                }}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    width="30"
                                    height="30"
                                    className={`heart-icon ${isLiked ? 'liked' : ''}`}
                                    style={{
                                        fill: isLiked ? '#ed4956' : 'none',
                                        stroke: isLiked ? '#ed4956' : 'currentColor',
                                        strokeWidth: '2',
                                        filter: isLiked ? 'drop-shadow(0 0 5px rgba(237, 73, 86, 0.5))' : 'none',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                </svg>
                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '4px', color: isLiked ? '#ed4956' : 'inherit' }}>
                                    {likesCount}
                                </span>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="post-modal-divider"></div>

                        {/* Comments System */}
                        <div className="post-modal-comments-area">
                            <CommentsSection postId={post.id} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PostDetailModal;
