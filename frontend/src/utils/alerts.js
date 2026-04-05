export function playLoudBuzzer(variant = 'default') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;

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
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = variant === 'manager' ? 'sawtooth' : 'square';
      oscillator.frequency.setValueAtTime(tone.frequency, now + tone.start);

      gainNode.gain.setValueAtTime(0.0001, now + tone.start);
      gainNode.gain.exponentialRampToValueAtTime(tone.gain, now + tone.start + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(now + tone.start);
      oscillator.stop(now + tone.start + tone.duration + 0.03);
    });

    window.setTimeout(() => {
      audioContext.close().catch(() => {});
    }, 1200);
  } catch (error) {
    console.warn('Alert buzzer could not play.', error);
  }
}
