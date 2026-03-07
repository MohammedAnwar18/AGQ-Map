import React, { useState, useEffect } from 'react';
import { commentService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './CommentsSection.css'; // We will create this CSS

const CommentsSection = ({ postId, onCommentAdded }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState(null); // { id, username }
    const [loading, setLoading] = useState(true);
    const listRef = React.useRef(null);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            const parentId = replyingTo ? replyingTo.id : null;
            const response = await commentService.addComment(postId, newComment, parentId);

            // Add the new comment with user info (server returns partial, but we add what we have)
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
                                    <button
                                        className="comment-reply-btn"
                                        onClick={() => setReplyingTo({ id: comment.id, username: comment.username })}
                                    >
                                        رد
                                    </button>
                                </div>
                            </div>

                            {/* Replies */}
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
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

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
        </div>
    );
};

export default CommentsSection;
