import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    build: {
        target: 'esnext',
        minify: 'esbuild',
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('maplibre-gl') || id.includes('react-map-gl')) {
                            return 'vendor-maplibre';
                        }
                        // طبقة React Three Fiber وكل ما تجرّه معها تذهب إلى
                        // حزمة مستقلّة لا يحمّلها إلا محرّر العالم. لولا هذا
                        // لسقطت في vendor-three — لأن أسماءها تحتوي «three» —
                        // فدفع ثمنَها كل من يفتح الواقع المعزّز أو الجولة
                        // الافتراضية. (threebox-plugin القديمة تبقى حيث كانت.)
                        // المسار مُطبَّع لأن ويندوز يعطي شرطات معكوسة.
                        // القائمة صريحة عمداً: هذه الحزم دخلت مع R3F ولا
                        // يستعملها شيء آخر في الموقع. (hls.js مستثناة —
                        // بثّ الكاميرات يستعملها من قبل، وscheduler وbuffer
                        // مشتركتان فتبقيان حيث كانتا.)
                        const R3F_STACK = /node_modules\/(@react-three\/|@react-spring\/|@use-gesture\/|@monogrid\/|@mediapipe\/|react-composer\/|react-reconciler\/|react-use-measure\/|suspend-react\/|its-fine\/|three-stdlib\/|three-mesh-bvh\/|troika-[\w-]+\/|camera-controls\/|maath\/|meshline\/|postprocessing\/|zustand\/|n8ao\/|detect-gpu\/|glsl-noise\/|stats-gl\/|stats\.js\/|tunnel-rat\/)/;
                        // نُعيد undefined عمداً: حزمة مسمّاة هنا تصير استيراداً
                        // ثابتاً من نقطة البدء فيحمّلها كل زائر. تركها لتقسيم
                        // Rollup التلقائي يُبقيها خلف الاستيراد الكسول للمحرّر.
                        if (R3F_STACK.test(id.replace(/\\/g, '/'))) {
                            return;
                        }
                        if (id.includes('three')) {
                            return 'vendor-three';
                        }
                        // react-leaflet MUST come before leaflet check:
                        // it uses React.createContext so it must be in vendor-react
                        // otherwise "Cannot read properties of undefined (reading 'createContext')"
                        if (id.includes('react-leaflet')) {
                            return 'vendor-react';
                        }
                        if (id.includes('leaflet') || id.includes('esri')) {
                            return 'vendor-leaflet';
                        }
                        if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                            return 'vendor-react';
                        }
                    }
                }
            }
        }
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5001',
                changeOrigin: true
            },
            '/uploads': {
                target: 'http://localhost:5001',
                changeOrigin: true
            },
            '/socket.io': {
                target: 'http://localhost:5001',
                ws: true,
                changeOrigin: true
            }
        }
    }
})
