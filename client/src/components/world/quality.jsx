import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/* ============================================================
   الدقّة المتكيّفة

   آخر خطّ دفاع عن سلاسة المشهد. حين يتعثّر رغم كل ما خُفّف، نُنقص
   عدد البكسلات المرسومة — وهو أكثر ما يُكلّف على كرت رسم ضعيف
   وأقلّ ما تلحظه العين في مشهد متحرّك.

   تنزل بسرعة وتصعد على مهل: تعثّر ثانيتين يكفي للنزول، والصعود
   يحتاج خمس ثوانٍ من الراحة. وإلا تأرجحت الدقّة بين درجتين
   فصار الاهتزاز أسوأ من البطء.
   ============================================================ */

const MIN_RATIO = 0.62;
const STEP = 0.16;

const DROP_BELOW = 34;   // إطار/ث — تحتها نُنقص
const RAISE_ABOVE = 55;  // فوقها نعود

export const AdaptiveResolution = ({ max = 1.75, onChange }) => {
    const gl = useThree(state => state.gl);

    const frames = useRef(0);
    const since = useRef(performance.now());
    const ratio = useRef(max);
    const lowStreak = useRef(0);
    const highStreak = useRef(0);

    useFrame(() => {
        frames.current++;

        const now = performance.now();
        const elapsed = now - since.current;
        if (elapsed < 1000) return;

        const fps = (frames.current * 1000) / elapsed;
        frames.current = 0;
        since.current = now;

        const device = Math.min(max, window.devicePixelRatio || 1);

        if (fps < DROP_BELOW) {
            highStreak.current = 0;
            lowStreak.current++;

            if (lowStreak.current >= 2 && ratio.current > MIN_RATIO) {
                ratio.current = Math.max(MIN_RATIO, ratio.current - STEP);
                gl.setPixelRatio(device * ratio.current);
                onChange?.(ratio.current);
            }
        } else if (fps > RAISE_ABOVE) {
            lowStreak.current = 0;
            highStreak.current++;

            if (highStreak.current >= 5 && ratio.current < 1) {
                ratio.current = Math.min(1, ratio.current + STEP);
                gl.setPixelRatio(device * ratio.current);
                onChange?.(ratio.current);
            }
        } else {
            lowStreak.current = 0;
            highStreak.current = 0;
        }
    });

    return null;
};

export default AdaptiveResolution;
