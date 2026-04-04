import React, { useState, useEffect } from 'react';
import { commentService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './CommentsSection.css';

const CommentsSection = ({ postId, onCommentAdded, onReply, hideInput = false }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState(null); // { id, username }
    const [loading, setLoading] = useState(true);
    const listRef = React.useRef(null);

    const handleReplyClick = (id, username) => {
        if (onReply) {
            onReply({ id, username });
        } else {
            setReplyingTo({ id, username });
        }
    };

    const scrollToBottom = () => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        loadComments();
    }, [postId]);

    useEffect(() => {
        if (comments.length > 0) {
            setTimeout(scrollToBottom, 100);
        }
    }, [comments]);

    const loadComments = async () => {
        try {
            const data = await commentService.getComments(postId);
            setComments(data.comments);
        } catch (error) {
            console.error('Failed to load comments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا التعليق؟')) return;
        try {
            await commentService.deleteComment(commentId);
            setComments(comments.filter(c => c.id !== commentId));
        } catch (error) {
            console.error('Failed to delete comment:', error);
            alert('فشل حذف التعليق');
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!newComment.trim()) return;

        try {
            const parentId = replyingTo ? replyingTo.id : null;
            const response = await commentService.addComment(postId, newComment, parentId);

            const commentWithUser = {
                ...response.comment,
                username: user.username,
                full_name: user.full_name,
                profile_picture: user.profile_picture
            };

            setComments([...comments, commentWithUser]);
            setNewComment('');
            setReplyingTo(null);
            if (onCommentAdded) onCommentAdded();
        } catch (error) {
            console.error('Failed to post comment:', error);
        }
    };

    const cancelReply = () => {
        setReplyingTo(null);
        setNewComment('');
    };

    const topLevelComments = comments.filter(c => !c.parent_id);
    const getReplies = (parentId) => comments.filter(c => c.parent_id === parentId);

    if (loading) return <div className="comments-loading">Loading comments...</div>;

    return (
        <div className="comments-section">
            <h4 className="comments-title">التعليقات ({comments.length})</h4>

            <div className="comments-list" ref={listRef}>
                {comments.length === 0 ? (
                    <p className="no-comments">كن أول المعلقين!</p>
                ) : (
                    topLevelComments.map((comment) => (
                        <div key={comment.id} className="comment-group">
                            <div className="comment-item">
                                <img
                                    src={comment.profile_picture || '/default-avatar.png'}
                                    alt={comment.username}
                                    className="comment-avatar"
                                />
                                <div className="comment-content-wrapper">
                                    <div className="comment-header">
                                        <span className="comment-user">{comment.full_name || comment.username}</span>
                                        <span className="comment-time">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="comment-text">{comment.content}</p>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <button
                                            className="comment-reply-btn"
                                            onClick={() => handleReplyClick(comment.id, comment.username)}
                                        >
                                            رد
                                        </button>
                                        {comment.user_id === user?.id && (
                                            <button
                                                className="comment-delete-btn"
                                                onClick={() => handleDeleteComment(comment.id)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                                            >
                                                حذف
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="replies-list" style={{ marginRight: '30px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '15px' }}>
                                {getReplies(comment.id).map(reply => (
                                    <div key={reply.id} className="comment-item reply-item">
                                        <img
                                            src={reply.profile_picture || '/default-avatar.png'}
                                            alt={reply.username}
                                            className="comment-avatar small"
                                        />
                                        <div className="comment-content-wrapper">
                                            <div className="comment-header">
                                                <span className="comment-user">{reply.full_name || reply.username}</span>
                                                <span className="comment-time">{new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="comment-text">{reply.content}</p>
                                            {reply.user_id === user?.id && (
                                                <button
                                                    className="comment-delete-btn"
                                                    onClick={() => handleDeleteComment(reply.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', padding: 0, marginTop: '4px' }}
                                                >
                                                    حذف
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {!hideInput && (
                <form className="comment-form-container" onSubmit={handleSubmit}>
                    {replyingTo && (
                        <div className="reply-indicator">
                            <span>الرد على @{replyingTo.username}</span>
                            <button type="button" className="cancel-reply" onClick={cancelReply}>✕</button>
                        </div>
                    )}
                    <div className="comment-form">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder={replyingTo ? `رد على ${replyingTo.username}...` : "اكتب تعليقاً..."}
                            className="comment-input"
                            autoFocus={!!replyingTo}
                        />
                        <button type="submit" className="comment-submit-btn" disabled={!newComment.trim()}>
                            ➤
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default CommentsSection;
