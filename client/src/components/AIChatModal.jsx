import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { aiService, shopService } from '../services/api';
import './Modal.css';
import axios from 'axios';

const AIChatModal = ({ onClose, onSearchResults, onRouteRequest, onClearMap, userLocation, onShopFollowed }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([
        { 
            id: 1, 
            role: 'CHATBOT', 
            content: `مرحباً ${user?.full_name || user?.username || ''}! أنا مساعدك الذكي PalNovaa، رفيقك المتطور للبحث عن المواقع والأماكن والمحلات التجارية على الخريطة بكل سهولة وذكاء. كيف يمكنني مساعدتك اليوم؟` 
        }
    ]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [pendingDestination, setPendingDestination] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const performSearch = async (query) => {
        try {
            // Use Nominatim with country codes for Palestine (ps) and Israel (il)
            let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ps,il&limit=10`;

            // If user location is available, bias the search
            if (userLocation) {
                const { latitude, longitude } = userLocation;
                // Create a viewbox approx 50km to bias results but allow further matches
                const offset = 0.5;
                const viewbox = `${longitude - offset},${latitude + offset},${longitude + offset},${latitude - offset}`;
                url += `&viewbox=${viewbox}`;
                // Removed bounded=1 to allow finding results anywhere
            }

            const response = await axios.get(url);
            let results = response.data;

            if (userLocation && results.length > 0) {
                const calculateDistance = (lat1, lon1, lat2, lon2) => {
                    const R = 6371; // km
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLon = (lon2 - lon1) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    return R * c;
                };

                results = results.map(place => ({
                    ...place,
                    distance: calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        parseFloat(place.lat),
                        parseFloat(place.lon)
                    )
                })).sort((a, b) => a.distance - b.distance);
            }

            return results;
        } catch (error) {
            console.error("OSM Search failed", error);
            return [];
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const userMsg = {
            id: Date.now(),
            role: 'USER',
            content: newMessage.trim()
        };

        setMessages(prev => [...prev, userMsg]);
        setNewMessage('');
        setLoading(true);

        try {
            // 1. Prepare history (exclude current message as it is sent as 'message')
            // Map our messages to Cohere format: { role: "USER" | "CHATBOT", message: "..." }
            const history = messages.map(m => ({
                role: m.role,
                message: m.content
            }));

            // 2. Prepare User Info
            let age = 'Unknown';
            if (user?.date_of_birth) {
                const dob = new Date(user.date_of_birth);
                const diff_ms = Date.now() - dob.getTime();
                const age_dt = new Date(diff_ms);
                age = Math.abs(age_dt.getUTCFullYear() - 1970);
            }

            const userInfo = {
                name: user?.full_name || user?.username || 'User',
                gender: user?.gender || 'Unknown',
                age: age
            };

            // 3. Send to AI with history and user info
            const aiResponse = await aiService.chat(userMsg.content, history, userLocation, userInfo);

            const { type, searchQuery, mode, reply, location, results } = aiResponse;

            // 2. If there is a search query or direct location
            let searchResults = [];

            // Check if AI provided direct coordinates for a system shop
            if (location && location.lat && location.lon) {
                searchResults = [{
                    lon: location.lon,
                    lat: location.lat,
                    display_name: searchQuery || "System Shop",
                    name: searchQuery || "System Shop",
                    type: "shop"
                }];
            } else if (searchQuery && (type === 'search' || type === 'route' || type === 'navigation_options')) {
                // Fallback to OSM search for general queries (though currently restricted)
                searchResults = await performSearch(searchQuery);
            }

            if (type === 'search_list') {
                // LIST VIEW - No map update yet
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'CHATBOT',
                    content: reply || "إليك قائمة المحلات التي وجدتها:",
                    results: results, // Pass the list
                    isList: true
                }]);
            } else if (type === 'navigation_options' && searchResults.length > 0) {
                const dest = searchResults[0];
                setPendingDestination(dest); // Store for next turn if needed

                // Show options
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'CHATBOT',
                    content: reply,
                    isOptions: true,
                    destination: dest // Pass the full location object
                }]);
            } else if (type === 'route') {
                // Determine destination: either from searchResults (if query provided) or pendingDestination
                const targetDest = searchResults.length > 0 ? searchResults[0] : pendingDestination;

                if (targetDest) {
                    // Trigger routing to the result
                    if (onRouteRequest) {
                        onRouteRequest(targetDest, mode || 'driving');
                    }
                    setMessages(prev => [...prev, {
                        id: Date.now() + 1,
                        role: 'CHATBOT',
                        content: reply || `جاري رسم المسار...`
                    }]);
                    // Clear pending after use
                    setPendingDestination(null);
                    onClose(); // Optional: close chat to show map immediately
                } else {
                    // AI thinks we are routing but we don't have a destination
                    setMessages(prev => [...prev, {
                        id: Date.now() + 1,
                        role: 'CHATBOT',
                        content: "عذراً، لم أستطع تحديد الوجهة. يرجى تحديد المكان أولاً."
                    }]);
                }

            } else if (type === 'clear') {
                if (onClearMap) onClearMap();
                setPendingDestination(null);
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'CHATBOT',
                    content: reply || "تم مسح الخريطة."
                }]);
            } else {
                // Determine reply content
                let finalReply = reply;

                // If search was attempted but returned no results, override the AI's reply
                if ((type === 'search' || type === 'navigation_options') && searchResults.length === 0) {
                    finalReply = "عذراً، لم يتم العثور على مكان مطابق.";
                } else if ((type === 'search' || type === 'navigation_options') && !finalReply) {
                    // Fallback if AI didn't provide a reply but we found something
                    finalReply = "وجدت هذه النتائج:";
                }

                // Pass results to Map
                if (searchResults.length > 0 && onSearchResults && type !== 'navigation_options') {
                    onSearchResults(searchResults);
                }

                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'CHATBOT',
                    content: finalReply || "تم."
                }]);
            }

        } catch (error) {
            console.error("AI Error", error);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'CHATBOT',
                content: "عذراً، حدث خطأ أثناء المعالجة."
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async (shopId) => {
        try {
            await shopService.follow(shopId);
            // Update UI to reflect change
            setMessages(prev => prev.map(msg => {
                if (msg.results) {
                    return {
                        ...msg,
                        results: msg.results.map(shop =>
                            shop.id === shopId ? { ...shop, isFollowed: true } : shop
                        )
                    };
                }
                return msg;
            }));

            // Trigger parent refresh
            if (onShopFollowed) {
                onShopFollowed();
            }

        } catch (error) {
            console.error("Failed to follow", error);
            alert("فشل في المتابعة، حاول مرة أخرى.");
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2> المساعد الذكي</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {messages.map(msg => (
                        <div key={msg.id} style={{
                            alignSelf: msg.role === 'USER' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%'
                        }}>
                            <div style={{
                                backgroundColor: msg.role === 'USER' ? '#fbab15' : '#f1f3f4',
                                color: msg.role === 'USER' ? 'white' : 'black',
                                padding: '10px 15px',
                                borderRadius: '18px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}>
                                {msg.content}
                            </div>

                            {msg.isOptions && (
                                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                    <button
                                        className="btn-option"
                                        onClick={() => {
                                            if (onRouteRequest) {
                                                onRouteRequest(msg.destination, 'driving');
                                                setMessages(prev => [...prev, { id: Date.now(), role: 'USER', content: '🚗 سيارة' }]);
                                                onClose(); // Close chat to show map
                                            }
                                        }}
                                        style={{ flex: 1, padding: '8px', borderRadius: '12px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                    >
                                        <span>🚗</span> سيارة
                                    </button>
                                    <button
                                        className="btn-option"
                                        onClick={() => {
                                            if (onRouteRequest) {
                                                onRouteRequest(msg.destination, 'walking');
                                                setMessages(prev => [...prev, { id: Date.now(), role: 'USER', content: '🚶 مشي' }]);
                                                onClose();
                                            }
                                        }}
                                        style={{ flex: 1, padding: '8px', borderRadius: '12px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                    >
                                        <span>🚶</span> مشي
                                    </button>
                                </div>
                            )}

                            {msg.results && (
                                <div className="ai-results-list" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                     {msg.results.map((shop, idx) => (
                                         <div 
                                             key={idx} 
                                             className="ai-shop-card" 
                                             onClick={() => {
                                                 // When user clicks a shop, show navigation options immediately
                                                 setMessages(prev => [...prev, {
                                                     role: 'USER',
                                                     content: `أريد الذهاب إلى ${shop.name}`
                                                 }, {
                                                     id: Date.now() + 50,
                                                     role: 'CHATBOT',
                                                     content: `ممتاز! كيف تود الذهاب إلى ${shop.name}؟`,
                                                     isOptions: true,
                                                     destination: { lon: shop.location.lon, lat: shop.location.lat, name: shop.name }
                                                 }]);
                                             }}
                                             style={{
                                                 background: 'white',
                                                 padding: '12px',
                                                 borderRadius: '12px',
                                                 boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                                 display: 'flex',
                                                 justifyContent: 'space-between',
                                                 alignItems: 'center',
                                                 gap: '10px',
                                                 border: '1px solid #f0f0f0',
                                                 cursor: 'pointer'
                                             }}
                                         >
                                             <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                                                 <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1f2937' }}>{shop.name}</div>
                                                 <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{shop.category || 'متجر'}</div>
                                             </div>
                                             <button
                                                 onClick={(e) => {
                                                     e.stopPropagation();
                                                     handleFollow(shop.id);
                                                 }}
                                                 disabled={shop.isFollowed}
                                                 style={{
                                                     background: shop.isFollowed ? '#e5e7eb' : '#fbab15',
                                                     color: shop.isFollowed ? '#9ca3af' : 'white',
                                                     border: 'none',
                                                     padding: '6px 14px',
                                                     borderRadius: '20px',
                                                     cursor: shop.isFollowed ? 'default' : 'pointer',
                                                     fontSize: '0.8rem',
                                                     fontWeight: '600',
                                                     whiteSpace: 'nowrap'
                                                 }}
                                             >
                                                 {shop.isFollowed ? 'متابع' : 'متابعة'}
                                             </button>
                                         </div>
                                     ))}
                                 </div>
                             )}
                        </div>
                    ))}
                    {loading && <div style={{ alignSelf: 'flex-start', color: '#666' }}>جاري الكتابة...</div>}
                    <div ref={messagesEndRef} />
                </div>

                <div style={{ padding: '10px', borderTop: '1px solid #eee' }}>
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="اطلب مكاناً..."
                            className="input"
                            style={{ flex: 1 }}
                            autoFocus
                        />
                        <button type="submit" className="btn-primary btn-chat-send" style={{ background: '#fbab15', border: 'none', color: 'white' }} disabled={loading || !newMessage.trim()}>
                            ➤
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AIChatModal;
