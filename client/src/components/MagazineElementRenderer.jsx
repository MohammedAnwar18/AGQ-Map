import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getImageUrl } from '../services/api';

export const SpatialMapRenderer = ({ data, drawing, theme }) => {
    if (drawing) {
        return (
            <svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
                <path 
                    d={drawing} 
                    fill="none" 
                    stroke={theme === 'dark' ? '#d4af37' : '#2c3e50'} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />
            </svg>
        );
    }

    if (!data) return null;

    const getAllCoords = (obj) => {
        const coords = [];
        const extract = (item) => {
            if (!item) return;
            if (item.type === 'FeatureCollection' && item.features) {
                for (let i = 0; i < item.features.length; i++) extract(item.features[i].geometry);
            } else if (item.type === 'Feature' && item.geometry) {
                extract(item.geometry);
            } else if (item.type === 'GeometryCollection' && item.geometries) {
                for (let i = 0; i < item.geometries.length; i++) extract(item.geometries[i]);
            } else if (item.coordinates) {
                const flatten = (arr) => {
                    if (typeof arr[0] === 'number') coords.push(arr);
                    else for (let i = 0; i < arr.length; i++) flatten(arr[i]);
                };
                flatten(item.coordinates);
            }
        };
        extract(obj);
        return coords;
    };

    const coords = getAllCoords(data);
    if (coords.length === 0) return null;

    let minX = coords[0][0], maxX = coords[0][0], minY = coords[0][1], maxY = coords[0][1];
    for (let i = 1; i < coords.length; i++) {
        const c = coords[i];
        if (c[0] < minX) minX = c[0];
        if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1];
        if (c[1] > maxY) maxY = c[1];
    }

    const diffX = maxX - minX || 1;
    const diffY = maxY - minY || 1;
    const padding = 20;
    const w = 1000 - (padding * 2);
    const h = 1000 - (padding * 2);

    const project = (coord) => {
        const x = padding + ((coord[0] - minX) / diffX) * w;
        const y = padding + (1 - (coord[1] - minY) / diffY) * h;
        return `${x},${y}`;
    };

    const renderGeometry = (geom, i) => {
        if (!geom) return null;
        const color = theme === 'vintage' ? '#8b4513' : theme === 'blueprint' ? '#fff' : '#d4af37';
        
        if (geom.type === 'LineString') {
            return <polyline key={i} points={geom.coordinates.map(project).join(' ')} fill="none" stroke={color} strokeWidth="2" />;
        }
        if (geom.type === 'MultiLineString') {
            return geom.coordinates.map((line, j) => (
                <polyline key={`${i}-${j}`} points={line.map(project).join(' ')} fill="none" stroke={color} strokeWidth="2" />
            ));
        }
        if (geom.type === 'Polygon') {
            return <polygon key={i} points={geom.coordinates[0].map(project).join(' ')} fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.5" />;
        }
        return null;
    };

    return (
        <svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
            {data.type === 'FeatureCollection' 
                ? data.features.map((f, i) => renderGeometry(f.geometry, i))
                : renderGeometry(data, 0)
            }
        </svg>
    );
};

export const MagazineElementRenderer = ({ el, scale = 1 }) => {
    const [geoData, setGeoData] = useState(el.spatialData);

    useEffect(() => {
        if (el.type === 'spatial' && el.spatialUrl && !geoData && !el.spatialDrawing) {
            const url = getImageUrl(el.spatialUrl);
            axios.get(url).then(res => setGeoData(res.data)).catch(console.error);
        }
    }, [el.spatialUrl, el.type, geoData, el.spatialDrawing]);

    const style = {
        position: 'absolute',
        left: el.x * scale,
        top: el.y * scale,
        width: el.width * scale,
        height: el.height * scale,
        ...el.styles,
        fontSize: el.styles.fontSize ? (parseFloat(el.styles.fontSize) * scale) + 'px' : 'inherit',
        pointerEvents: 'none'
    };

    switch (el.type) {
        case 'text':
            return <div style={{ ...style, whiteSpace: 'pre-wrap' }}>{el.content}</div>;
        case 'image':
            return <img src={el.src} alt="" style={{ ...style, objectFit: 'cover' }} />;
        case 'spatial':
            return (
                <div style={style}>
                    <SpatialMapRenderer data={geoData} drawing={el.spatialDrawing} theme={el.theme} />
                </div>
            );
        case 'shape':
            return <div style={{ ...style, background: el.styles.backgroundColor, border: `${el.styles.borderWidth} solid ${el.styles.borderColor}`, borderRadius: el.styles.borderRadius }}></div>;
        default:
            return null;
    }
};
