import React, { useState, useEffect } from 'react';
import { commentService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './CommentsSection.css'; // We will create this CSS

const CommentsSection = ({ postId }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadComments();
    }, [postId]);

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
            // Optimistic update can be tricky without ID, so we wait for server response
            // or we suggest a temp ID. Let's wait for server for robust ID handling.
            const response = await commentService.addComment(postId, newComment);
            setComments([...comments, response.comment]);
            setNewComment('');
        } catch (error) {
            console.error('Failed to post comment:', error);
        }
    };

    if (loading) return <div className="comments-loading">Loading comments...</div>;

    return (
        <div className="comments-section">
            <h4 className="comments-title">التعليقات ({comments.length})</h4>

            <div className="comments-list">
                {comments.length === 0 ? (
                    <p className="no-comments">كن أول المعلقين!</p>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="comment-item">
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
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form className="comment-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="اكتب تعليقاً..."
                    className="comment-input"
                />
                <button type="submit" className="comment-submit-btn" disabled={!newComment.trim()}>
                    ➤
                </button>
            </form>
        </div>
    );
};

export default CommentsSection;
