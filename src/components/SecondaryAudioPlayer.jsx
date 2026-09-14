/**
 * Secondary Audio Player Component
 * Hidden HTML5 Audio Element in continuous loop for secondary background audio tracks.
 * Connected directly to Web Audio API Mixer gain node.
 */

import React, { useEffect, useRef } from 'react';
import { audioMixer } from '../utils/audioMixer';

export function SecondaryAudioPlayer({ currentAudioTrack, isPlaying }) {
  const audioRef = useRef(null);

  // Connect audio element to Web Audio API Mixer gain node on mount/track change
  useEffect(() => {
    if (audioRef.current) {
      audioMixer.connectSecondaryAudio(audioRef.current);
    }
  }, [currentAudioTrack]);

  // Sync play / pause state
  useEffect(() => {
    if (audioRef.current && currentAudioTrack) {
      if (isPlaying && audioMixer.currentMode !== 'MUSIC_PAUSED') {
        audioRef.current.play().catch(err => console.warn("Secondary audio play notice:", err));
      }
    }
  }, [currentAudioTrack, isPlaying]);

  if (!currentAudioTrack) return null;

  return (
    <audio
      ref={audioRef}
      key={currentAudioTrack.url}
      src={currentAudioTrack.url}
      loop={true}
      autoPlay={isPlaying}
      style={{ display: 'none' }}
    />
  );
}
