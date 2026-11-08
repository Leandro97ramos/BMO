/**
 * Main Application Orchestrator for BMO Media Session
 * Manages global playback state, action dispatching, tag navigation, gamepad/keyboard hooks,
 * Web Audio API smart ducking, and Weighted Tag Mixing session mode.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FolderPickerModal } from './components/FolderPickerModal';
import { TagMixerModal } from './components/TagMixerModal';
import { MediaPlayer } from './components/MediaPlayer';
import { SecondaryAudioPlayer } from './components/SecondaryAudioPlayer';
import { HUDOverlay } from './components/HUDOverlay';
import { RedGifsDownloaderModal } from './components/RedGifsDownloaderModal';
import { useGamepad } from './hooks/useGamepad';
import { useKeyboard } from './hooks/useKeyboard';
import { audioMixer } from './utils/audioMixer';
import { scanDirectoryHandle } from './utils/fileScanner';
import { generateWeightedPlaylist, getEqualWeights } from './utils/playlistGenerator';

export function App() {
  const [scanData, setScanData] = useState(null);

  // Mode: 'CATEGORY' (per folder) vs 'WEIGHTED_MIX' (shuffled percentage mix)
  const [playbackMode, setPlaybackMode] = useState('CATEGORY');
  const [tagWeights, setTagWeights] = useState({});
  const [weightedQueue, setWeightedQueue] = useState([]);
  const [queuePointer, setQueuePointer] = useState(0);
  const [showTagMixer, setShowTagMixer] = useState(false);

  // Category Mode pointers
  const [activeTagIndex, setActiveTagIndex] = useState(0);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [activeAudioIndex, setActiveAudioIndex] = useState(0);
  const [clipIteration, setClipIteration] = useState(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isHudVisible, setIsHudVisible] = useState(true);
  const [isMediaMuted, setIsMediaMuted] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(true);
  const [showRedGifsModal, setShowRedGifsModal] = useState(false);

  const [mixerState, setMixerState] = useState({
    mode: 'FULL',
    volume: 1.0,
    modeLabel: '🔊 Audio Completo (100% Vol)'
  });

  // Register Audio Mixer state callback
  useEffect(() => {
    audioMixer.onStateChange((newState) => {
      setMixerState(newState);
    });
  }, []);

  // Category Mode Derived Items
  const currentTagObj = useMemo(() => {
    if (!scanData || !scanData.tags || scanData.tags.length === 0) return null;
    return scanData.tags[activeTagIndex] || scanData.tags[0];
  }, [scanData, activeTagIndex]);

  // Derived Active Clip based on Playback Mode
  const activeItem = useMemo(() => {
    if (!scanData) return null;

    if (playbackMode === 'WEIGHTED_MIX') {
      if (weightedQueue.length === 0) return null;
      const currentQueueItem = weightedQueue[queuePointer] || weightedQueue[0];
      return {
        clip: currentQueueItem.clip,
        tagName: currentQueueItem.tagName,
        clipIndex: currentQueueItem.clipIndex,
        totalClipsInTag: 0,
        weightPercentage: currentQueueItem.weightPercentage
      };
    } else {
      if (!currentTagObj || !currentTagObj.clips || currentTagObj.clips.length === 0) return null;
      const clip = currentTagObj.clips[activeClipIndex] || currentTagObj.clips[0];
      return {
        clip,
        tagName: currentTagObj.tagName,
        clipIndex: activeClipIndex,
        totalClipsInTag: currentTagObj.clips.length,
        weightPercentage: null
      };
    }
  }, [playbackMode, scanData, currentTagObj, activeClipIndex, weightedQueue, queuePointer]);

  const currentClip = activeItem ? activeItem.clip : null;

  const currentAudioTrack = useMemo(() => {
    if (!scanData || !scanData.audioTracks || scanData.audioTracks.length === 0) return null;
    return scanData.audioTracks[activeAudioIndex] || scanData.audioTracks[0];
  }, [scanData, activeAudioIndex]);

  // Evaluate audio mixing policy whenever active clip changes
  useEffect(() => {
    if (currentClip) {
      audioMixer.evaluateClipPolicy(currentClip);
    }
  }, [currentClip]);

  // Generate or regenerate weighted playlist
  const rebuildWeightedQueue = (weightsToUse) => {
    if (!scanData || !scanData.tags) return;
    const newQueue = generateWeightedPlaylist(scanData.tags, weightsToUse, 150);
    setWeightedQueue(newQueue);
    setQueuePointer(0);
  };

  // Toggle Playback Mode
  const handleTogglePlaybackMode = () => {
    if (playbackMode === 'CATEGORY') {
      // Switch to WEIGHTED_MIX
      let weights = tagWeights;
      if (Object.keys(weights).length === 0 && scanData) {
        weights = getEqualWeights(scanData.tags);
        setTagWeights(weights);
      }
      rebuildWeightedQueue(weights);
      setPlaybackMode('WEIGHTED_MIX');
    } else {
      // Switch back to CATEGORY
      setPlaybackMode('CATEGORY');
    }
  };

  // Save new tag mix weights from modal
  const handleSaveMix = (newWeights) => {
    setTagWeights(newWeights);
    rebuildWeightedQueue(newWeights);
    setPlaybackMode('WEIGHTED_MIX');
  };

  // Central Action Dispatcher
  const handleAction = useCallback((actionType) => {
    if (!scanData || showFolderModal || showTagMixer || showRedGifsModal) return;

    switch (actionType) {
      case 'NEXT_VIDEO':
        setIsPlaying(true);
        setClipIteration((prev) => prev + 1);
        if (playbackMode === 'WEIGHTED_MIX') {
          if (weightedQueue.length > 0) {
            setQueuePointer((prev) => (prev + 1) % weightedQueue.length);
          }
        } else {
          if (currentTagObj && currentTagObj.clips) {
            setActiveClipIndex((prev) => (prev + 1) % currentTagObj.clips.length);
          }
        }
        break;

      case 'PREV_VIDEO':
        setIsPlaying(true);
        setClipIteration((prev) => prev + 1);
        if (playbackMode === 'WEIGHTED_MIX') {
          if (weightedQueue.length > 0) {
            setQueuePointer((prev) => (prev - 1 + weightedQueue.length) % weightedQueue.length);
          }
        } else {
          if (currentTagObj && currentTagObj.clips) {
            setActiveClipIndex((prev) => (prev - 1 + currentTagObj.clips.length) % currentTagObj.clips.length);
          }
        }
        break;

      case 'NEXT_TAG':
        setIsPlaying(true);
        setClipIteration((prev) => prev + 1);
        if (playbackMode === 'CATEGORY' && scanData.tags && scanData.tags.length > 0) {
          setActiveTagIndex((prev) => (prev + 1) % scanData.tags.length);
          setActiveClipIndex(0); // Load first clip of that subfolder category
        }
        break;

      case 'PREV_TAG':
        setIsPlaying(true);
        setClipIteration((prev) => prev + 1);
        if (playbackMode === 'CATEGORY' && scanData.tags && scanData.tags.length > 0) {
          setActiveTagIndex((prev) => (prev - 1 + scanData.tags.length) % scanData.tags.length);
          setActiveClipIndex(0); // Load first clip of that subfolder category
        }
        break;

      case 'NEXT_AUDIO':
        if (scanData.audioTracks && scanData.audioTracks.length > 0) {
          setActiveAudioIndex((prev) => (prev + 1) % scanData.audioTracks.length);
        }
        break;

      case 'PREV_AUDIO':
        if (scanData.audioTracks && scanData.audioTracks.length > 0) {
          setActiveAudioIndex((prev) => (prev - 1 + scanData.audioTracks.length) % scanData.audioTracks.length);
        }
        break;

      case 'TOGGLE_PLAY':
        setIsPlaying((prev) => !prev);
        break;

      case 'TOGGLE_HUD':
        setIsHudVisible((prev) => !prev);
        break;

      case 'TOGGLE_MUTE':
        setIsMediaMuted((prev) => !prev);
        break;

      case 'TOGGLE_FULLSCREEN':
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((e) => console.warn(e));
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch((e) => console.warn(e));
          }
        }
        break;

      default:
        break;
    }
  }, [scanData, showFolderModal, showTagMixer, playbackMode, currentTagObj, weightedQueue]);

  // Connect Input Hooks (Gamepad & Keyboard)
  const gamepadInfo = useGamepad(handleAction);
  useKeyboard(handleAction);

  // Folder Scan Complete Handler
  const handleScanComplete = (result) => {
    setScanData(result);
    setActiveTagIndex(0);
    setActiveClipIndex(0);
    setActiveAudioIndex(0);
    
    // Initialize equal weights
    const defaultW = getEqualWeights(result.tags);
    setTagWeights(defaultW);

    setShowFolderModal(false);
    setIsPlaying(true);
  };

  // Reload active directory after downloads
  const handleLibraryUpdated = async (dirHandle) => {
    try {
      if (!dirHandle) return;
      const result = await scanDirectoryHandle(dirHandle);
      if (result && result.tags && result.tags.length > 0) {
        setScanData(result);
        const defaultW = getEqualWeights(result.tags);
        setTagWeights(prev => ({ ...defaultW, ...prev }));
      }
    } catch (err) {
      console.warn("Error recargando biblioteca tras descarga de RedGifs:", err);
    }
  };

  // Video auto-advance on ended
  const handleVideoEnd = () => {
    setIsPlaying(true);
    setClipIteration((prev) => prev + 1);
    handleAction('NEXT_VIDEO');
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000000' }}>
      {/* 1. Primary Media Player (Video / GIF) */}
      <MediaPlayer
        currentClip={currentClip}
        isPlaying={isPlaying}
        isMediaMuted={isMediaMuted}
        clipIteration={clipIteration}
        onVideoEnd={handleVideoEnd}
      />

      {/* 2. Secondary Audio Track Player */}
      <SecondaryAudioPlayer
        currentAudioTrack={currentAudioTrack}
        isPlaying={isPlaying}
      />

      {/* 3. Floating HUD Overlay */}
      {!showFolderModal && scanData && (
        <HUDOverlay
          currentTag={activeItem ? activeItem.tagName : ''}
          tagIndex={activeTagIndex}
          totalTags={scanData.tags.length}
          tagsList={scanData.tags}
          currentClip={currentClip}
          clipIndex={activeItem ? activeItem.clipIndex : 0}
          totalClipsInTag={activeItem ? activeItem.totalClipsInTag : 0}
          currentAudioTrack={currentAudioTrack}
          audioIndex={activeAudioIndex}
          totalAudioTracks={scanData.audioTracks.length}
          audioMixerState={mixerState}
          gamepadInfo={gamepadInfo}
          isHudVisible={isHudVisible}
          isMediaMuted={isMediaMuted}
          isPlaying={isPlaying}
          playbackMode={playbackMode}
          mixWeightPercentage={activeItem ? activeItem.weightPercentage : null}
          onSelectTag={(idx) => {
            setPlaybackMode('CATEGORY');
            setIsPlaying(true);
            setClipIteration((prev) => prev + 1);
            setActiveTagIndex(idx);
            setActiveClipIndex(0);
          }}
          onTogglePlaybackMode={handleTogglePlaybackMode}
          onOpenTagMixer={() => setShowTagMixer(true)}
          onReopenFolderPicker={() => setShowFolderModal(true)}
          onOpenRedGifsDownloader={() => setShowRedGifsModal(true)}
        />
      )}

      {/* 4. Tag Mix Sliders Configuration Modal */}
      {showTagMixer && scanData && (
        <TagMixerModal
          tagsList={scanData.tags}
          currentWeights={tagWeights}
          onSaveMix={handleSaveMix}
          onClose={() => setShowTagMixer(false)}
        />
      )}

      {/* 5. RedGifs Batch Downloader Modal */}
      {showRedGifsModal && (
        <RedGifsDownloaderModal
          existingTags={scanData ? scanData.tags : []}
          activeDirHandle={scanData ? scanData.dirHandle : null}
          onClose={() => setShowRedGifsModal(false)}
          onLibraryUpdated={handleLibraryUpdated}
        />
      )}

      {/* 6. Folder Landing Modal */}
      {showFolderModal && (
        <FolderPickerModal 
          onScanComplete={handleScanComplete} 
          onOpenRedGifsDownloader={() => setShowRedGifsModal(true)}
        />
      )}
    </div>
  );
}

export default App;
