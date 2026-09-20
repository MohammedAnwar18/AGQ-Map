import React, { useEffect, useState, useCallback } from 'react';

import gameService, { gameError } from '../../services/gameApi';
import { useGame, spacedCode } from './gameStore';
import { useWorld } from './worldStore';
import GameWorld from './GameWorld';
import './GameWorld.css';

/* ============================================================
   باب العالم

   يفصل بين «تجهيز اللاعب» و«اللعب»: البطاقة تُجلب أوّلاً — وتُنشأ
   عند أوّل دخول — ثم يُفتح العالم. وفصلهما يعني أن المشهد لا يُبنى
   إلا وصاحبه معروف، فلا يظهر أفاتار بلا اسم ولا رقم.

   ولو تعثّر الخادم فالخطأ يُقال هنا بصريح العبارة، لا شاشة سوداء.
   ============================================================ */

const Splash = ({ title, note, children }) => (
    <div className="gw" dir="rtl">
        <div className="gw-splash">
            <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9.2" />
                <ellipse cx="12" cy="12" rx="4" ry="9.2" />
                <path d="M3.2 9.2h17.6M3.2 14.8h17.6" />
            </svg>
            <b>{title}</b>
            {note && <p>{note}</p>}
            {children}
        </div>
    </div>
);

const WorldGame = ({ onClose }) => {
    const player = useGame(s => s.player);
    const loading = useGame(s => s.loading);
    const error = useGame(s => s.error);

    const setPlayer = useGame(s => s.setPlayer);
    const setError = useGame(s => s.setError);
    const setVisiting = useGame(s => s.setVisiting);

    const [attempt, setAttempt] = useState(0);

    const load = useCallback(async () => {
        try {
            const data = await gameService.me();
            setPlayer(data.player, data.isAdmin);

            // نبدأ في عالمنا. ولو كان محفوظاً استُرجع، وإلا فالمشهد
            // الافتراضي — نفس المدينة التي يبدأ منها الجميع.
            try {
                const mine = await gameService.openWorld(data.player.code);
                if (mine.world) useWorld.getState().importWorld(mine.world);
                setVisiting({ code: mine.code, owner: mine.owner, mine: true });
            } catch {
                // فشل فتح عالمي لا يمنع اللعب: المشهد الافتراضي جاهز
                setVisiting({ code: data.player.code, owner: data.player.name, mine: true });
            }
        } catch (err) {
            setError(gameError(err, 'تعذّر الاتصال بخادم العالم'));
        }
    }, [setPlayer, setError, setVisiting]);

    useEffect(() => {
        useGame.setState({ loading: true, error: null });
        load();
    }, [load, attempt]);

    if (error) {
        return (
            <Splash title="تعذّر فتح العالم" note={error}>
                <div className="gw-splash-row">
                    <button className="gw-btn gw-go" onClick={() => setAttempt(n => n + 1)}>أعد المحاولة</button>
                    <button className="gw-btn" onClick={onClose}>إغلاق</button>
                </div>
            </Splash>
        );
    }

    if (loading || !player) {
        return <Splash title="يجهّز شخصيتك…" note="نُنشئ بطاقتك ورقمك التعريفي عند أوّل دخول" />;
    }

    return <GameWorld onClose={onClose} service={gameService} />;
};

export default WorldGame;
