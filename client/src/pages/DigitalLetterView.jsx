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
    const [envelopeRemoved, setEnvelopeRemoved] = useState(false);
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

    // Handle envelope opening
    const handleOpenEnvelope = () => {
        if (isOpen) return;
        
        setIsOpen(true);

        // Play music if configured
        if (letter?.music_url && audioRef.current) {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(err => console.log('Audio autoplay blocked or failed:', err));
        }

        // Hide envelope element after split transition finishes (1.2s)
        setTimeout(() => {
            setEnvelopeRemoved(true);
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

    // Determine seal symbol based on design
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

    // Split title by words to display on left and right flaps
    const getSplitTitle = (fullTitle) => {
        const words = (fullTitle || 'دعوة خاصة').split(' ');
        if (words.length === 1) {
            return { left: words[0], right: '' };
        }
        const mid = Math.ceil(words.length / 2);
        return {
            left: words.slice(0, mid).join(' '),
            right: words.slice(mid).join(' ')
        };
    };

    const splitTitle = getSplitTitle(letter.title);

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

            {/* 1. FULL-SCREEN GATEFOLD ENVELOPE */}
            {!envelopeRemoved && (
                <div 
                    className={`fullscreen-envelope-overlay theme-${letter.envelope_color || 'maroon'} ${isOpen ? 'open-envelope' : ''}`}
                    onClick={handleOpenEnvelope}
                >
                    {/* Left Screen Half */}
                    <div className="envelope-screen-half envelope-half-left">
                        <div className="envelope-title-cover">{splitTitle.left}</div>
                    </div>

                    {/* Right Screen Half */}
                    <div className="envelope-screen-half envelope-half-right">
                        <div className="envelope-title-cover">{splitTitle.right}</div>
                    </div>

                    {/* Central Wax Seal */}
                    <div className="wax-seal-split-button">
                        {letter.seal_design === 'rose-wax' ? (
                            <div 
                                className="wax-seal-circle rose-wax-design"
                                style={{ backgroundImage: 'url("/images/rose-seal.png")' }}
                            ></div>
                        ) : (
                            <div className="wax-seal-circle">
                                <span className="wax-seal-icon">
                                    {getSealEmblem(letter.seal_design)}
                                </span>
                            </div>
                        )}
                        <span className="wax-seal-pulse-text">انقر لفتح الدعوة 🌹</span>
                    </div>
                </div>
            )}

            {/* 2. REVEALED PARCHMENT LETTER */}
            <div className="revealed-letter-backdrop">
                <div className="detailed-invitation-parchment">
                    <div className="parchment-inner">
                        <span className="parchment-header-ornament">⚜</span>
                        
                        <h2 className="parchment-title">{letter.title}</h2>
                        
                        {letter.sender_name && (
                            <p className="parchment-sender">{letter.sender_name}</p>
                        )}

                        <div className="parchment-divider"></div>

                        {letter.recipient_name && (
                            <span className="parchment-recipient">إلى السيد/ة: {letter.recipient_name} المحترم/ة</span>
                        )}

                        {letter.image_url && (
                            <img 
                                src={getImageUrl(letter.image_url)} 
                                alt="Invitation Visual" 
                                className="parchment-image"
                            />
                        )}

                        {letter.content && (
                            <p className="parchment-content">{letter.content}</p>
                        )}

                        <button 
                            className="parchment-close-btn" 
                            onClick={() => {
                                setIsOpen(false);
                                setEnvelopeRemoved(false); // Bring back envelope to allow viewing again
                            }}
                        >
                            إغلاق الرسالة ✉
                        </button>

                        <div className="parchment-powered">
                            منصة بالنوفا المكانية • PalNovaa
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DigitalLetterView;
