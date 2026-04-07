import React, { useState } from 'react';
import { friendService } from '../services/api';

const FriendButton = ({ userId, isFriend: initialIsFriend, hasRequest: initialHasRequest, style = {} }) => {
    const [status, setStatus] = useState(initialIsFriend ? 'friend' : (initialHasRequest ? 'pending' : 'none'));
    const [loading, setLoading] = useState(false);

    const handleAddFriend = async (e) => {
        e.stopPropagation();
        if (loading) return;

        try {
            setLoading(true);
            if (status === 'none') {
                await friendService.sendFriendRequest(userId);
                setStatus('pending');
            } else if (status === 'pending') {
                // Cancel the sent request
                await friendService.cancelFriendRequest(userId);
                setStatus('none');
            }
        } catch (error) {
            console.error('Friend request action failed:', error);
        } finally {
            setLoading(false);
        }
    };

    if (status === 'friend') {
        return <span className="friend-status-tag" style={style}>صديق ✓</span>;
    }

    if (status === 'pending') {
        return (
            <button
                className="btn btn-secondary"
                onClick={handleAddFriend}
                disabled={loading}
                title="اضغط لإلغاء طلب الصداقة"
                style={{
                    padding: '6px 12px', fontSize: '0.8rem', height: 'auto',
                    background: 'rgba(251,171,21,0.15)', border: '1px solid #fbab15',
                    color: '#fbab15', borderRadius: '20px', cursor: 'pointer',
                    fontFamily: 'inherit',
                    ...style
                }}
            >
                {loading ? '...' : '✓ تم الإرسال - إلغاء؟'}
            </button>
        );
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
