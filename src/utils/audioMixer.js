/**
 * Web Audio API Mixing & Smart Ducking Engine for BMO Media Session
 * Manages dual-player audio routing, gain ducking (30%), 1.5s music fades,
 * and real-time AnalyserNode fallback level measurement.
 */

class AudioMixerEngine {
  constructor() {
    this.audioCtx = null;
    
    // Secondary Audio Player nodes
    this.secondaryAudioElement = null;
    this.secondarySourceNode = null;
    this.secondaryGainNode = null;
    
    // Media Video Player nodes
    this.videoElement = null;
    this.videoSourceNode = null;
    this.videoAnalyserNode = null;
    this.videoDataArray = null;

    // Real-time analysis interval
    this.analyserInterval = null;
    this.isAnalyzing = false;

    // Mix State
    this.currentMode = 'FULL'; // 'FULL' (100%), 'DUCKING_TAG' (30%), 'DUCKING_AUTO' (30%), 'MUSIC_PAUSED' (0%)
    this.targetVolume = 1.0;
    this.onStateChangeCallback = null;

    // Element source registry to prevent duplicate createMediaElementSource errors
    this.sourceRegistry = new WeakMap();
  }

  /**
   * Initialize Web Audio Context upon user interaction
   */
  initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(e => console.warn("AudioContext resume notice:", e));
    }
  }

  /**
   * Register state change callback for HUD notification
   */
  onStateChange(callback) {
    this.onStateChangeCallback = callback;
  }

  /**
   * Connect secondary background audio player element
   */
  connectSecondaryAudio(audioEl) {
    this.initContext();
    if (!audioEl || this.secondaryAudioElement === audioEl) return;
    this.secondaryAudioElement = audioEl;

    try {
      if (!this.sourceRegistry.has(audioEl)) {
        this.secondaryGainNode = this.audioCtx.createGain();
        this.secondarySourceNode = this.audioCtx.createMediaElementSource(audioEl);
        this.secondarySourceNode.connect(this.secondaryGainNode);
        this.secondaryGainNode.connect(this.audioCtx.destination);
        this.sourceRegistry.set(audioEl, { source: this.secondarySourceNode, gain: this.secondaryGainNode });
      } else {
        const registered = this.sourceRegistry.get(audioEl);
        this.secondarySourceNode = registered.source;
        this.secondaryGainNode = registered.gain;
      }
    } catch (e) {
      console.warn("Secondary audio source connection notice:", e);
    }
  }

  /**
   * Connect active video media element for audio analysis and routing
   */
  connectVideoElement(videoEl) {
    this.initContext();
    if (!videoEl) return;
    
    // Disconnect old video source if element changed
    if (this.videoElement && this.videoElement !== videoEl && this.videoSourceNode) {
      try {
        this.videoSourceNode.disconnect();
      } catch (e) {}
    }

    this.videoElement = videoEl;

    try {
      if (!this.sourceRegistry.has(videoEl)) {
        this.videoSourceNode = this.audioCtx.createMediaElementSource(videoEl);
        this.videoAnalyserNode = this.audioCtx.createAnalyser();
        this.videoAnalyserNode.fftSize = 512;
        this.videoAnalyserNode.smoothingTimeConstant = 0.8;
        this.videoDataArray = new Uint8Array(this.videoAnalyserNode.frequencyBinCount);

        // Connect source to analyser and to destination (so video sound plays through audioCtx)
        this.videoSourceNode.connect(this.videoAnalyserNode);
        this.videoAnalyserNode.connect(this.audioCtx.destination);
        this.sourceRegistry.set(videoEl, { source: this.videoSourceNode, analyser: this.videoAnalyserNode });
      } else {
        const registered = this.sourceRegistry.get(videoEl);
        this.videoSourceNode = registered.source;
        this.videoAnalyserNode = registered.analyser;
        if (this.videoAnalyserNode) {
          this.videoDataArray = new Uint8Array(this.videoAnalyserNode.frequencyBinCount);
        }
      }
    } catch (e) {
      // If Web Audio API MediaElementSource fails (e.g. cross-origin or unsupported audio codec),
      // catch gracefully so standard HTML5 video playback is not blocked!
      console.warn("MediaElementAudioSourceNode harmless notice:", e);
    }
  }

  /**
   * Main Policy Evaluator based on filename suffix tags & file type
   */
  evaluateClipPolicy(clip) {
    this.initContext();
    this.stopAnalyser();

    if (!clip) {
      this.restoreSecondaryAudioFull(1.5);
      return;
    }

    // Rule 1.1: GIF files -> Secondary audio plays at 100%
    if (clip.type === 'gif') {
      this.setSecondaryVolumeMode('FULL', 1.0, 0.5);
      return;
    }

    // Rule 1.2: [music] / _music in filename -> Pause secondary audio with smooth fade
    if (clip.isMusicTag) {
      this.pauseSecondaryAudioForMusic();
      return;
    }

    // Rule 1.3: [voice] / _voice in filename -> Duck secondary audio to 30%
    if (clip.isVoiceTag) {
      this.setSecondaryVolumeMode('DUCKING_TAG', 0.3, 0.3);
      return;
    }

    // Rule 2: Untagged Video -> Start Web Audio API Analyser fallback
    this.startAnalyserFallback();
  }

  /**
   * Smoothly pause secondary audio when a music clip starts
   */
  pauseSecondaryAudioForMusic() {
    if (this.secondaryAudioElement) {
      this.rampGain(0.0, 0.4, () => {
        if (this.secondaryAudioElement && !this.secondaryAudioElement.paused) {
          this.secondaryAudioElement.pause();
        }
      });
    }
    this.updateState('MUSIC_PAUSED', 0.0);
  }

  /**
   * Resume secondary audio with smooth 1.5s fade-in curve when returning to non-music clip
   */
  restoreSecondaryAudioFull(fadeDurationSec = 1.5) {
    if (this.secondaryAudioElement) {
      if (this.secondaryAudioElement.paused) {
        this.secondaryAudioElement.play().catch(() => {});
      }
      this.rampGain(1.0, fadeDurationSec);
    }
    this.updateState('FULL', 1.0);
  }

  /**
   * Set secondary audio volume mode with specified gain target and ramp duration
   */
  setSecondaryVolumeMode(mode, targetVol, durationSec = 0.3) {
    if (this.secondaryAudioElement && this.secondaryAudioElement.paused) {
      this.secondaryAudioElement.play().catch(() => {});
    }
    this.rampGain(targetVol, durationSec);
    this.updateState(mode, targetVol);
  }

  /**
   * Web Audio Gain Ramp helper using smooth exponential time constants
   */
  rampGain(targetVolume, durationSec, onComplete) {
    if (!this.secondaryGainNode || !this.audioCtx) return;

    try {
      const currTime = this.audioCtx.currentTime;
      this.secondaryGainNode.gain.cancelScheduledValues(currTime);
      this.secondaryGainNode.gain.setValueAtTime(this.secondaryGainNode.gain.value, currTime);
      
      // Smooth linear ramp
      this.secondaryGainNode.gain.linearRampToValueAtTime(targetVolume, currTime + durationSec);

      if (onComplete) {
        setTimeout(onComplete, durationSec * 1000);
      }
    } catch (e) {
      console.warn("Ramp gain error:", e);
    }
  }

  /**
   * Fallback Web Audio API Real-time Signal Analyser
   * Measures RMS audio output of untagged video element to detect > -40dB sustained sound
   */
  startAnalyserFallback() {
    this.stopAnalyser();
    this.isAnalyzing = true;

    let sustainedLoudCount = 0;
    let sustainedQuietCount = 0;

    this.analyserInterval = setInterval(() => {
      if (!this.videoAnalyserNode || !this.videoElement || this.videoElement.paused || this.videoElement.muted) {
        if (this.currentMode !== 'FULL') {
          this.setSecondaryVolumeMode('FULL', 1.0, 0.4);
        }
        return;
      }

      try {
        this.videoAnalyserNode.getByteFrequencyData(this.videoDataArray);
        
        // Calculate RMS (Root Mean Square) volume level
        let sum = 0;
        for (let i = 0; i < this.videoDataArray.length; i++) {
          sum += this.videoDataArray[i] * this.videoDataArray[i];
        }
        const rms = Math.sqrt(sum / this.videoDataArray.length);
        // Convert RMS to dB: 20 * log10(rms / 255)
        const decibels = rms > 0 ? 20 * Math.log10(rms / 255) : -100;

        // Threshold check: > -40dB is considered active audible sound
        if (decibels > -40) {
          sustainedLoudCount++;
          sustainedQuietCount = 0;
          if (sustainedLoudCount >= 2 && this.currentMode !== 'DUCKING_AUTO') {
            this.setSecondaryVolumeMode('DUCKING_AUTO', 0.3, 0.3);
          }
        } else {
          sustainedQuietCount++;
          sustainedLoudCount = 0;
          if (sustainedQuietCount >= 8 && this.currentMode !== 'FULL') {
            this.setSecondaryVolumeMode('FULL', 1.0, 0.5);
          }
        }
      } catch (e) {
        // Fallback safety
      }
    }, 150);
  }

  /**
   * Stop real-time audio analyser loop
   */
  stopAnalyser() {
    this.isAnalyzing = false;
    if (this.analyserInterval) {
      clearInterval(this.analyserInterval);
      this.analyserInterval = null;
    }
  }

  /**
   * Update internal state & trigger callback
   */
  updateState(mode, volume) {
    this.currentMode = mode;
    this.targetVolume = volume;
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({
        mode,
        volume,
        modeLabel: this.getModeLabel(mode)
      });
    }
  }

  getModeLabel(mode) {
    switch (mode) {
      case 'MUSIC_PAUSED': return '🎵 Música Pausada (Fade 1.5s)';
      case 'DUCKING_TAG': return '🎙️ Ducking Voz Tag (30% Vol)';
      case 'DUCKING_AUTO': return '🔊 Ducking Auto -40dB (30% Vol)';
      case 'FULL': default: return '🔊 Audio Completo (100% Vol)';
    }
  }
}

export const audioMixer = new AudioMixerEngine();
