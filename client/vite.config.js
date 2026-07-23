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
                        if (id.includes('three')) {
                            return 'vendor-three';
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
