import React, { useState } from 'react';
import { friendService } from '../services/api';

const FriendButton = ({ userId, isFriend: initialIsFriend, hasRequest: initialHasRequest, style = {} }) => {
    const [status, setStatus] = useState(initialIsFriend ? 'friend' : (initialHasRequest ? 'pending' : 'none'));
    const [loading, setLoading] = useState(false);

    const handleAddFriend = async (e) => {
        e.stopPropagation();
        if (status !== 'none') return;

        try {
            setLoading(true);
            await friendService.sendFriendRequest(userId);
            setStatus('pending');
        } catch (error) {
            console.error('Failed to send friend request:', error);
            // We could show a toast here if available
        } finally {
            setLoading(false);
        }
    };

    if (status === 'friend') {
        return <span className="friend-status-tag" style={style}>صديق ✓</span>;
    }

    if (status === 'pending') {
        return <span className="friend-status-tag pending" style={style}>طلب معلق</span>;
    }

    return (
        <button
            className="btn btn-primary"
            onClick={handleAddFriend}
            disabled={loading}
            style={{ padding: '6px 12px', fontSize: '0.8rem', height: 'auto', ...style }}
        >
            {loading ? '...' : '+ إضافة صديق'}
        </button>
    );
};

export default FriendButton;
