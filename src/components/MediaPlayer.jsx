/**
 * Media Player Component - Visual Normalization & Resilient Fullscreen Container
 * Enforces uniform size with object-fit: contain on pitch black background (#000000).
 * Handles video decoding errors, codec incompatibilities, and auto-skips broken files.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Film, RefreshCw } from 'lucide-react';
import { audioMixer } from '../utils/audioMixer';

export function MediaPlayer({ 
  currentClip, 
  isPlaying, 
  isMediaMuted, 
  onVideoEnd,
  onVideoPlay,
  onVideoPause 
}) {
  const videoRef = useRef(null);
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const autoSkipTimerRef = useRef(null);

  // Reset error state on clip change
  useEffect(() => {
    setHasError(false);
    setErrorDetails('');
    if (autoSkipTimerRef.current) {
      clearTimeout(autoSkipTimerRef.current);
      autoSkipTimerRef.current = null;
    }
  }, [currentClip?.url]);

  // Connect video element to Web Audio API Mixer on mount or source change
  useEffect(() => {
    if (videoRef.current && currentClip && currentClip.type === 'video' && !hasError) {
      audioMixer.connectVideoElement(videoRef.current);
    }
  }, [currentClip, hasError]);

  // Sync play / pause state safely
  useEffect(() => {
    if (videoRef.current && currentClip && currentClip.type === 'video' && !hasError) {
      if (isPlaying) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            // Ignore expected interrupt errors when rapidly switching clips
            if (err.name !== 'AbortError') {
              console.warn("Video playback notice:", err.message);
            }
          });
        }
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, currentClip, hasError]);

  // Catch Video Decoding or Format Errors (e.g. unsupported HEVC / AC3 / broken file)
  const handleVideoError = (e) => {
    const err = e.target.error;
    let msg = 'Formato o codec de vídeo no soportado por el navegador.';
    
    if (err) {
      switch (err.code) {
        case 1: msg = 'Carga de vídeo abortada.'; break;
        case 2: msg = 'Error de red al cargar el vídeo.'; break;
        case 3: msg = 'Error de decodificación de vídeo (Codec incompatible).'; break;
        case 4: msg = 'Formato o codec no soportado (.mkv / H.265 incompatible).'; break;
        default: msg = err.message || msg; break;
      }
    }

    console.warn(`Error en clip ${currentClip?.name}:`, msg);
    setHasError(true);
    setErrorDetails(msg);

    // Auto-skip to next video after 1.8 seconds so session doesn't get stuck
    if (autoSkipTimerRef.current) clearTimeout(autoSkipTimerRef.current);
    autoSkipTimerRef.current = setTimeout(() => {
      onVideoEnd();
    }, 1800);
  };

  // Cleanup auto-skip timer
  useEffect(() => {
    return () => {
      if (autoSkipTimerRef.current) {
        clearTimeout(autoSkipTimerRef.current);
      }
    };
  }, []);

  if (!currentClip) {
    return (
      <div className="viewport-container">
        <div style={{ color: '#64748b', fontSize: '1rem' }}>No hay medio seleccionado</div>
      </div>
    );
  }

  return (
    <div className="viewport-container">
      {hasError ? (
        <div className="empty-warning" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '12px',
          padding: '24px 32px',
          maxWidth: '520px',
          textAlign: 'center',
          background: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.4)',
          borderRadius: '16px',
          boxShadow: '0 0 30px rgba(244, 63, 94, 0.2)'
        }}>
          <AlertCircle size={32} color="#f43f5e" />
          <div>
            <div style={{ fontWeight: 600, color: '#fecdd3', fontSize: '1.05rem', marginBottom: '4px' }}>
              No se pudo reproducir: {currentClip.name}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#fda4af' }}>
              {errorDetails}
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className="pulse-dot rose" />
            <span>Saltando automáticamente al siguiente clip...</span>
          </div>
        </div>
      ) : currentClip.type === 'video' ? (
        <video
          ref={videoRef}
          key={currentClip.url}
          src={currentClip.url}
          className="media-element"
          autoPlay={isPlaying}
          muted={isMediaMuted}
          playsInline
          loop={false}
          onEnded={onVideoEnd}
          onError={handleVideoError}
          onPlay={onVideoPlay}
          onPause={onVideoPause}
        />
      ) : (
        <img
          key={currentClip.url}
          src={currentClip.url}
          alt={currentClip.name}
          className="media-element"
          onError={() => {
            setHasError(true);
            setErrorDetails('Imagen / GIF no válido o dañado.');
            autoSkipTimerRef.current = setTimeout(onVideoEnd, 1800);
          }}
        />
      )}
    </div>
  );
}
