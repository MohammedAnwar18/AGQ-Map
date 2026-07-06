import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { digitalLettersService, getImageUrl } from '../services/api';
import './DigitalLetterView.css';

const DigitalLetterView = () => {
    const { slug } = useParams();
    const [letter, setLetter] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const audioRef = useRef(null);

    // Fetch letter details on mount
    useEffect(() => {
        const fetchLetter = async () => {
            try {
                setLoading(true);
                const res = await digitalLettersService.getBySlug(slug);
                if (res && res.success) {
                    setLetter(res.letter);
                } else {
                    setError('عذراً، لم يتم العثور على الرسالة الرقمية المطلوبة.');
                }
            } catch (err) {
                console.error('Error loading digital letter:', err);
                setError(err.response?.data?.error || 'فشل في تحميل الرسالة الرقمية.');
            } finally {
                setLoading(false);
            }
        };

        if (slug) {
            fetchLetter();
        }
    }, [slug]);

    // Handle envelope click/opening
    const handleOpenEnvelope = () => {
        if (isOpen) return;
        
        setIsOpen(true);

        // Play music if configured
        if (letter?.music_url && audioRef.current) {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(err => console.log('Audio autoplay blocked or failed:', err));
        }

        // Show the detailed card modal after envelope animations finish (~1.2s)
        setTimeout(() => {
            setShowModal(true);
        }, 1200);
    };

    // Toggle audio manually
    const toggleAudio = (e) => {
        e.stopPropagation();
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(err => console.error(err));
        }
    };

    if (loading) {
        return (
            <div className="digital-letter-page">
                <div className="letter-loading">
                    <div className="letter-spinner"></div>
                    <p>جاري جلب دعوتك الخاصة...</p>
                </div>
            </div>
        );
    }

    if (error || !letter) {
        return (
            <div className="digital-letter-page">
                <div className="letter-error">
                    <h3>⚠️ خطأ في التحميل</h3>
                    <p>{error || 'الرسالة غير متوفرة أو تم إزالتها.'}</p>
                </div>
            </div>
        );
    }

    // Determine seal character/symbol based on seal design name
    const getSealEmblem = (design) => {
        switch (design) {
            case 'heart-wax': return '❤';
            case 'rose-wax': return '🌹';
            case 'star-wax': return '⭐';
            case 'crown-wax': return '👑';
            case 'wax-classic':
            default:
                return '✉';
        }
    };

    return (
        <div className="digital-letter-page">
            {/* Audio element */}
            {letter.music_url && (
                <>
                    <audio 
                        ref={audioRef} 
                        src={getImageUrl(letter.music_url)} 
                        loop 
                    />
                    <div className="letter-audio-control">
                        <button className="audio-toggle-btn" onClick={toggleAudio} title="موسيقى الخلفية">
                            {isPlaying ? '🔊' : '🔇'}
                        </button>
                    </div>
                </>
            )}

            {/* Envelope Container */}
            <div 
                className={`envelope-container ${isOpen ? 'open' : ''}`} 
                onClick={handleOpenEnvelope}
            >
                <div className={`envelope theme-${letter.envelope_color || 'maroon'}`}>
                    {/* Top Flap */}
                    <div className="envelope-flap"></div>

                    {/* Pocket base (inside) */}
                    <div className="envelope-pocket"></div>

                    {/* Wax Seal */}
                    <div className="wax-seal">
                        <span className="wax-seal-emblem">
                            {getSealEmblem(letter.seal_design)}
                        </span>
                    </div>

                    {/* Card preview that slides up */}
                    <div className="invitation-card">
                        <div className="card-inner-border">
                            <span className="card-header-ornament">⚜</span>
                            <h3 className="card-title">{letter.title}</h3>
                            {letter.sender_name && <p className="card-sender">من: {letter.sender_name}</p>}
                            {letter.recipient_name && <p className="card-recipient">إلى: {letter.recipient_name}</p>}
                            {letter.content && <p className="card-content-preview">{letter.content}</p>}
                        </div>
                    </div>

                    {!isOpen && (
                        <div className="click-hint">
                            ✨ اضغط على الختم لفتح الرسالة ✨
                        </div>
                    )}
                </div>
            </div>

            {/* Fullscreen Invitation Card Overlay */}
            {showModal && (
                <div className="card-backdrop-overlay" onClick={() => setShowModal(false)}>
                    <div className="fullscreen-invitation-card" onClick={(e) => e.stopPropagation()}>
                        <div className="fs-card-inner">
                            <span className="fs-ornament-top">⚜</span>
                            
                            <h2 className="fs-title">{letter.title}</h2>
                            
                            {letter.sender_name && (
                                <p className="fs-sender">{letter.sender_name}</p>
                            )}

                            <div className="fs-divider"></div>

                            {letter.recipient_name && (
                                <span className="fs-recipient">إلى السيد/ة: {letter.recipient_name} المحترم/ة</span>
                            )}

                            {letter.image_url && (
                                <img 
                                    src={getImageUrl(letter.image_url)} 
                                    alt="Invitation Visual" 
                                    className="fs-card-image"
                                />
                            )}

                            {letter.content && (
                                <p className="fs-content">{letter.content}</p>
                            )}

                            <button 
                                className="fs-close-btn" 
                                onClick={() => {
                                    setShowModal(false);
                                    setIsOpen(false); // Reset to allow opening again
                                }}
                            >
                                إغلاق الرسالة ✉
                            </button>

                            <div className="fs-powered-by">
                                منصة بالنوفا المكانية • PalNovaa
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DigitalLetterView;
