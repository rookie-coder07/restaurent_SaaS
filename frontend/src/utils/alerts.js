// Global AudioContext for managing autoplay restrictions
let sharedAudioContext = null;
let audioContextEnabled = false;

/**
 * Initialize shared AudioContext with autoplay handling
 */
export function initializeAudioContext() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('AudioContext not supported in this browser');
      return;
    }

    if (sharedAudioContext) {
      return; // Already initialized
    }

    sharedAudioContext = new AudioContextClass();
    
    // Attempt to enable audio
    enableAudioContext();
  } catch (error) {
    console.error('Failed to initialize AudioContext:', error);
  }
}

/**
 * Enable AudioContext for autoplay (call after user interaction)
 */
function enableAudioContext() {
  if (!sharedAudioContext) {
    return;
  }

  try {
    // Resume suspended AudioContext
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().then(() => {
        audioContextEnabled = true;
        console.log('AudioContext resumed - buzzer enabled');
      }).catch((err) => {
        console.warn('Could not resume AudioContext:', err);
      });
    } else if (sharedAudioContext.state === 'running') {
      audioContextEnabled = true;
    }
  } catch (error) {
    console.warn('Error enabling audio:', error);
  }
}

/**
 * Setup one-time user interaction listener to unlock audio
 */
export function setupAudioUnlock() {
  const unlockAudio = () => {
    enableAudioContext();
    // Remove listener after first interaction
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  };

  // Listen for any user interaction to unlock audio
  document.addEventListener('click', unlockAudio, { once: true, passive: true });
  document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
}

/**
 * Play a buzzer sound with auto-retry if audio is disabled
 */
export function playLoudBuzzer(variant = 'default') {
  try {
    // Initialize context if needed
    if (!sharedAudioContext) {
      initializeAudioContext();
    }

    if (!sharedAudioContext) {
      console.warn('AudioContext unavailable');
      return;
    }

    // Resume if suspended
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {
        console.warn('Could not resume AudioContext for buzzer');
      });
      
      // Retry playing buzzer after resume
      setTimeout(() => playBuzzerTones(variant), 100);
      return;
    }

    // Play immediately if running
    playBuzzerTones(variant);
  } catch (error) {
    console.warn('Alert buzzer could not play:', error);
  }
}

/**
 * Internal function to play buzzer tones
 */
function playBuzzerTones(variant = 'default') {
  try {
    if (!sharedAudioContext || sharedAudioContext.state !== 'running') {
      console.warn('AudioContext not ready for playback');
      return;
    }

    const now = sharedAudioContext.currentTime;

    const patterns = {
      default: [
        { frequency: 760, start: 0, duration: 0.12, gain: 0.22 },
        { frequency: 620, start: 0.14, duration: 0.12, gain: 0.22 },
        { frequency: 820, start: 0.3, duration: 0.18, gain: 0.26 },
      ],
      waiter: [
        { frequency: 820, start: 0, duration: 0.1, gain: 0.24 },
        { frequency: 700, start: 0.12, duration: 0.1, gain: 0.24 },
        { frequency: 860, start: 0.24, duration: 0.16, gain: 0.28 },
      ],
      manager: [
        { frequency: 540, start: 0, duration: 0.16, gain: 0.28 },
        { frequency: 540, start: 0.22, duration: 0.16, gain: 0.28 },
        { frequency: 680, start: 0.46, duration: 0.24, gain: 0.3 },
      ],
      success: [
        { frequency: 880, start: 0, duration: 0.1, gain: 0.2 },
        { frequency: 680, start: 0.14, duration: 0.1, gain: 0.2 },
        { frequency: 980, start: 0.28, duration: 0.18, gain: 0.24 },
      ],
    };

    const tones = patterns[variant] || patterns.default;

    tones.forEach((tone) => {
      const oscillator = sharedAudioContext.createOscillator();
      const gainNode = sharedAudioContext.createGain();

      oscillator.type = variant === 'manager' ? 'sawtooth' : 'square';
      oscillator.frequency.setValueAtTime(tone.frequency, now + tone.start);

      gainNode.gain.setValueAtTime(0.0001, now + tone.start);
      gainNode.gain.exponentialRampToValueAtTime(tone.gain, now + tone.start + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);

      oscillator.connect(gainNode);
      gainNode.connect(sharedAudioContext.destination);
      oscillator.start(now + tone.start);
      oscillator.stop(now + tone.start + tone.duration + 0.03);
    });

    console.log(`🔊 Buzzer played: ${variant}`);
  } catch (error) {
    console.error('Error playing buzzer tones:', error);
  }
}
