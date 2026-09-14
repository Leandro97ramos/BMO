/**
 * HUD Overlay Component - Floating Inverted Menu
 * Shows Tag, Clip, Secondary Audio, Gamepad status, Audio Mixer Ducking Mode,
 * and Playback Mode Toggle (Category vs Weighted Mix).
 * Auto-hides after 2.2s of mouse or controller inactivity.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Tag, Film, Music, Gamepad, FolderOpen, ChevronLeft, ChevronRight, Sliders, Shuffle, Layers } from 'lucide-react';

export function HUDOverlay({
  currentTag,
  tagIndex,
  totalTags,
  tagsList,
  currentClip,
  clipIndex,
  totalClipsInTag,
  currentAudioTrack,
  audioIndex,
  totalAudioTracks,
  audioMixerState,
  gamepadInfo,
  isHudVisible,
  isMediaMuted,
  playbackMode, // 'CATEGORY' | 'WEIGHTED_MIX'
  mixWeightPercentage,
  onSelectTag,
  onTogglePlaybackMode,
  onOpenTagMixer,
  onReopenFolderPicker
}) {
  const [autoHide, setAutoHide] = useState(true);
  const hideTimerRef = useRef(null);
  const tagStripRef = useRef(null);
  const activeBtnRef = useRef(null);

  // Auto-scroll active tag into view when tagIndex changes
  useEffect(() => {
    if (activeBtnRef.current) {
      activeBtnRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [tagIndex]);

  // Handle horizontal mouse wheel scrolling over tag strip
  const handleWheel = (e) => {
    if (tagStripRef.current) {
      tagStripRef.current.scrollLeft += e.deltaY;
    }
  };

  const scrollTagStrip = (direction) => {
    if (tagStripRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      tagStripRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Auto-hide HUD loop on mouse movement or input activity
  useEffect(() => {
    const handleActivity = () => {
      setAutoHide(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = setTimeout(() => {
        setAutoHide(false);
      }, 2200); // 2.2 seconds idle timeout
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('pointerdown', handleActivity);

    // Initial timeout
    handleActivity();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('pointerdown', handleActivity);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const isVisible = isHudVisible && autoHide;

  // Audio status badge style helper
  const getStatusBadge = () => {
    const mode = audioMixerState ? audioMixerState.mode : 'FULL';
    switch (mode) {
      case 'MUSIC_PAUSED':
        return (
          <div className="hud-pill status-music-paused">
            <span className="pulse-dot rose" />
            <span>Música Pausada (Video Con Música)</span>
          </div>
        );
      case 'DUCKING_TAG':
        return (
          <div className="hud-pill status-ducking-voice">
            <span className="pulse-dot amber" />
            <span>Ducking Voz Tag (30% Vol)</span>
          </div>
        );
      case 'DUCKING_AUTO':
        return (
          <div className="hud-pill status-ducking-auto">
            <span className="pulse-dot cyan" />
            <span>Ducking Auto &gt;-40dB (30% Vol)</span>
          </div>
        );
      case 'FULL':
      default:
        return (
          <div className="hud-pill status-full-volume">
            <span className="pulse-dot emerald" />
            <span>Audio Secundario (100% Vol)</span>
          </div>
        );
    }
  };

  const isMixMode = playbackMode === 'WEIGHTED_MIX';

  return (
    <div className={`hud-layer ${isVisible ? 'visible' : 'hidden'}`}>
      {/* Top Navigation & Category Strip */}
      <div className="hud-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Mode Switcher Button */}
          <button 
            className={`hud-pill ${isMixMode ? 'hud-pill-mix-active' : ''}`}
            onClick={onTogglePlaybackMode}
            style={{ cursor: 'pointer', fontWeight: 600 }}
            title="Alternar entre Modo Categoría y Modo Mezcla Ponderada"
          >
            {isMixMode ? <Shuffle size={16} /> : <Layers size={16} />}
            <span>{isMixMode ? 'Modo Mezcla' : 'Modo Categoría'}</span>
          </button>

          {/* Settings Sliders Button for Weighted Mix */}
          <button
            className="hud-pill"
            onClick={onOpenTagMixer}
            style={{ cursor: 'pointer', background: isMixMode ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.06)' }}
            title="Configurar Porcentajes de Mezcla"
          >
            <Sliders size={15} />
            <span>Porcentajes</span>
          </button>

          {/* Active Tag Pill */}
          <div className="hud-pill hud-pill-tag">
            <Tag size={16} />
            <span>
              {currentTag || 'Sin Tag'} 
              {isMixMode ? ` (${mixWeightPercentage || 0}%)` : ` [${tagIndex + 1} / ${totalTags}]`}
            </span>
          </div>

          <button 
            className="hud-pill" 
            onClick={onReopenFolderPicker}
            style={{ cursor: 'pointer', opacity: 0.8 }}
            title="Cambiar carpeta raíz"
          >
            <FolderOpen size={15} />
          </button>
        </div>

        {/* Tag Quick Selector Container with Left/Right Scroll Arrows */}
        {!isMixMode && (
          <div className="tag-strip-wrapper">
            <button 
              className="tag-scroll-btn" 
              onClick={() => scrollTagStrip('left')}
              title="Deslizar categorías a la izquierda"
            >
              <ChevronLeft size={16} />
            </button>

            <div 
              className="tag-strip" 
              ref={tagStripRef}
              onWheel={handleWheel}
            >
              {tagsList.map((tagObj, idx) => {
                const isActive = idx === tagIndex;
                return (
                  <button
                    key={tagObj.tagName}
                    ref={isActive ? activeBtnRef : null}
                    className={`tag-item-btn ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectTag(idx)}
                  >
                    {tagObj.tagName}
                  </button>
                );
              })}
            </div>

            <button 
              className="tag-scroll-btn" 
              onClick={() => scrollTagStrip('right')}
              title="Deslizar categorías a la derecha"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Mix Mode Global Badge */}
        {isMixMode && (
          <div className="hud-pill hud-pill-mix-badge">
            <Shuffle size={15} />
            <span>Mezcla Aleatoria Ponderada Activa</span>
          </div>
        )}
      </div>

      {/* Bottom Status & Info Rows */}
      <div className="hud-bottom-bar">
        <div className="hud-controls-row">
          {/* Active Clip Name */}
          <div className="hud-pill">
            <Film size={16} style={{ color: '#818cf8' }} />
            <span>
              {currentClip ? currentClip.name : 'Sin Clip'} [{clipIndex + 1} / {totalClipsInTag}]
            </span>
            {isMediaMuted && (
              <span style={{ color: '#f43f5e', fontSize: '0.75rem', marginLeft: '4px' }}>
                (Vídeo Silenciado)
              </span>
            )}
          </div>

          {/* Smart Audio Mixer Status */}
          {getStatusBadge()}
        </div>

        <div className="hud-controls-row">
          {/* Secondary Audio Track Pill */}
          <div className="hud-pill hud-pill-audio">
            <Music size={16} />
            <span>
              {currentAudioTrack ? currentAudioTrack.name : 'Sin Pista Secundaria'} [{audioIndex + 1} / {totalAudioTracks}]
            </span>
          </div>

          {/* Controller & Help Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="gamepad-badge">
              <Gamepad size={15} />
              <span>{gamepadInfo.isConnected ? gamepadInfo.name : 'Mando listo (USB/BT/VR)'}</span>
            </div>

            <div className="hud-pill hud-pill-status">
              <span>Presiona <strong style={{ color: '#ffffff' }}>H</strong> para UI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
