(() => {
  'use strict';

  const storageKey = 'pyk-audio';
  const settings = { music: 0.5, sfx: 0.7, muted: false };
  const clamp = value => Math.max(0, Math.min(1, value));
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey));
    if (Number.isFinite(saved?.music)) settings.music = clamp(saved.music);
    if (Number.isFinite(saved?.sfx)) settings.sfx = clamp(saved.sfx);
    if (typeof saved?.muted === 'boolean') settings.muted = saved.muted;
  } catch {}

  // Each cue gives its cooldown and notes. A note is [delay, MIDI, length,
  // strength, voice, pitch sweep in semitones].
  const cues = {
    build: [95, [[0, 48, 0.11, 0.10, 'tap'], [0.034, 72, 0.17, 0.12, 'wood'], [0.09, 76, 0.22, 0.085, 'wood']]],
    sell: [115, [[0, 64, 0.15, 0.085, 'pluck'], [0.06, 59, 0.24, 0.11, 'wood']]],
    invalid: [260, [[0, 52, 0.13, 0.11, 'soft', -2], [0.10, 47, 0.16, 0.07, 'soft']]],
    tool: [80, [[0, 72, 0.09, 0.09, 'wood'], [0.038, 74, 0.10, 0.055, 'wood']]],
    month: [300, [[0, 60, 0.27, 0.085, 'pluck'], [0.10, 67, 0.29, 0.085, 'wood'], [0.20, 72, 0.35, 0.07, 'pluck']]],
    news: [600, [[0, 67, 0.16, 0.05, 'wood'], [0.084, 72, 0.19, 0.05, 'wood']]],
    toast: [350, [[0, 76, 0.14, 0.053, 'pluck']]],
    politics: [430, [[0, 50, 0.40, 0.10, 'wood'], [0.10, 62, 0.27, 0.10, 'pluck'], [0.23, 69, 0.33, 0.085, 'wood']]],
    'modal-open': [145, [[0, 60, 0.13, 0.055, 'soft', 4], [0.055, 67, 0.16, 0.061, 'pluck']]],
    'modal-close': [145, [[0, 67, 0.13, 0.061, 'soft', -5]]],
    play: [130, [[0, 64, 0.14, 0.075, 'pluck'], [0.075, 72, 0.19, 0.085, 'wood']]],
    pause: [130, [[0, 67, 0.10, 0.07, 'wood'], [0.060, 60, 0.15, 0.078, 'pluck']]],
    rotate: [125, [[0, 58, 0.16, 0.076, 'soft', 8], [0.055, 72, 0.10, 0.052, 'tap']]],
    zoom: [130, [[0, 67, 0.085, 0.056, 'soft', 3]]],
    view: [180, [[0, 64, 0.11, 0.06, 'wood'], [0.06, 69, 0.13, 0.05, 'soft']]],
    'cash-low': [2000, [[0, 50, 0.23, 0.12, 'pluck'], [0.17, 45, 0.32, 0.09, 'soft']]],
    'ui-click': [65, [[0, 78, 0.044, 0.042, 'tap']]]
  };

  const pentatonic = [0, 2, 4, 7, 9];
  // Two-bar phrases with space between calls and a return to the tonic.
  const phrases = [
    [[0, 0], [2, 1], [3, 2], [5, 3], [8, 2], [10, 1], [13, 0]],
    [[0, 2], [2, 3], [4, 4], [7, 5], [8, 3], [11, 2], [14, 0]],
    [[0, 0], [3, 2], [5, 1], [6, 2], [8, 3], [10, 4], [12, 2], [15, 1]],
    [[0, 3], [2, 2], [4, 1], [7, 0], [9, 1], [11, 2], [14, 0]]
  ];
  const lampangHour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', hourCycle: 'h23'
  });

  const random = (low, high) => low + Math.random() * (high - low);
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);
  const lastCue = new Map();
  const pendingCues = new Map();
  let context, master, music, sfx, wind, windFilter, noiseBuffer;
  let timer, nextPhrase = 0, nextWildlife = 0, day, phraseIndex = -1;
  let scenePhase, nextClockCheck = 0;

  function saveSettings() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {}
  }

  function smooth(param, value, seconds = 0.035) {
    param.cancelScheduledValues(context.currentTime);
    param.setTargetAtTime(value, context.currentTime, seconds);
  }

  function envelope(output, time, length, peak, attack, hold = 0) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.00001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + attack);
    if (hold > 0) gain.gain.setValueAtTime(peak, time + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.00001, time + length);
    gain.connect(output);
    return gain;
  }

  function oscillator(output, time, length, pitch, endPitch, peak, attack, type = 'sine', hold = 0) {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(pitch, time);
    if (endPitch !== pitch) osc.frequency.exponentialRampToValueAtTime(endPitch, time + length * 0.78);
    osc.connect(envelope(output, time, length, peak, attack, hold));
    osc.start(time);
    osc.stop(time + length);
  }

  function note(output, time, length, midi, peak, voice, sweep = 0) {
    const pitch = hz(midi);
    oscillator(output, time, length, pitch, hz(midi + sweep), peak, 0.009,
      voice === 'pluck' ? 'triangle' : 'sine');
    if (voice === 'wood' || voice === 'pluck' || voice === 'tap') {
      const partial = voice === 'pluck' ? 2 : 2.76;
      oscillator(output, time, length * 0.45, pitch * partial, hz(midi + sweep) * partial,
        peak * 0.27, 0.003);
    }
  }

  function noise() {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    return source;
  }

  function drum(time, pitch, length, peak) {
    const source = noise();
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.value = pitch;
    source.connect(filter);
    filter.connect(envelope(music, time, length, peak, 0.007));
    source.start(time, random(0, 1));
    source.stop(time + length);
  }

  function schedulePhrase(start) {
    const step = random(0.413, 0.442);
    phraseIndex = (phraseIndex + 1 + Math.floor(random(0, phrases.length - 1))) % phrases.length;
    const voice = Math.random() < 0.52 ? 'wood' : 'pluck';
    for (const [beat, degree] of phrases[phraseIndex]) {
      if (beat % 2 && Math.random() < 0.16) continue;
      const pitch = 62 + pentatonic[degree % 5] + 12 * Math.floor(degree / 5);
      note(music, start + beat * step + random(0, 0.024), random(0.35, 0.76),
        pitch + random(-0.035, 0.035), random(0.067, 0.103), voice);
    }

    const length = 16 * step;
    oscillator(music, start, length + 0.65, hz(50), hz(50), 0.032, 0.75, 'sine', length - 1.2);
    oscillator(music, start + 0.06, length + 0.56, hz(57), hz(57), 0.015, 0.9, 'sine', length - 1.4);
    note(music, start + 8 * step, 1.15, 57, 0.043, 'pluck');
    drum(start + step * 4, random(350, 480), 0.13, 0.086);
    drum(start + step * 12, random(480, 740), 0.09, 0.067);
    return length;
  }

  function updateAmbience(time) {
    const hour = Number(lampangHour.format());
    const daylight = scenePhase ? scenePhase === 'day' : hour >= 6 && hour < 18;
    if (daylight === day) return;
    day = daylight;
    smooth(wind.gain, day ? 0.17 : 0.10, 1.1);
    smooth(windFilter.frequency, day ? 740 : 460, 1.1);
    nextWildlife = time + random(0.6, 2.4);
  }

  function wildlife(time) {
    if (day) {
      const base = random(1170, 1720);
      oscillator(music, time, 0.15, base, base * 1.46, 0.031, 0.033);
      oscillator(music, time + 0.17, 0.13, base * 1.3, base * 0.88, 0.024, 0.022);
      if (Math.random() < 0.45) {
        oscillator(music, time + 0.35, 0.12, base * 1.2, base * 1.4, 0.018, 0.025);
      }
      return random(4, 11);
    }
    const pitch = random(2050, 2530);
    for (let chirp = 0; chirp < 4; chirp++) {
      const start = time + chirp * 0.086;
      oscillator(music, start, 0.038, pitch, pitch * 1.035, 0.014, 0.008);
    }
    return random(2.2, 5.5);
  }

  function schedule() {
    const now = context.currentTime;
    if (now >= nextClockCheck) {
      updateAmbience(now);
      nextClockCheck = now + 5;
    }
    if (nextPhrase < now - 0.12) nextPhrase = now + 0.06;
    if (nextPhrase < now + 0.17) {
      nextPhrase += schedulePhrase(Math.max(nextPhrase, now + 0.01));
    }
    if (nextWildlife < now + 0.17) {
      const start = Math.max(nextWildlife, now + 0.03);
      nextWildlife = start + wildlife(start);
    }
  }

  function play(name) {
    if (typeof name !== 'string' || !Object.hasOwn(cues, name) || !context ||
        context.state === 'closed' || document.hidden || settings.muted || settings.sfx === 0) return;
    const now = performance.now();
    if (context.state !== 'running') {
      pendingCues.set(name, now);
      return;
    }

    const [cooldown, notes] = cues[name];
    if (now - (lastCue.get(name) ?? -Infinity) < cooldown) return;
    lastCue.set(name, now);
    const start = context.currentTime + 0.012;
    const detune = random(-0.27, 0.27);
    const pace = random(0.95, 1.05);
    const level = random(0.91, 1.08);
    for (const [delay, pitch, length, peak, voice, sweep] of notes) {
      note(sfx, start + delay * pace, length * pace, pitch + detune, peak * level, voice, sweep);
    }
  }

  function sync() {
    const running = context.state === 'running' && !document.hidden;
    if (running) {
      for (const [name, requestedAt] of pendingCues) {
        if (performance.now() - requestedAt < 300) play(name);
      }
      pendingCues.clear();
    }
    if (running && !settings.muted && settings.music > 0) {
      if (timer === undefined) {
        schedule();
        timer = window.setInterval(schedule, 90);
      }
    } else {
      window.clearInterval(timer);
      timer = undefined;
    }
  }

  function applySettings() {
    if (!context) return;
    smooth(master.gain, settings.muted ? 0 : 0.52);
    smooth(music.gain, settings.music * 0.56);
    smooth(sfx.gain, settings.sfx * 0.72);
    if (settings.muted || settings.sfx === 0) pendingCues.clear();
    sync();
  }

  function init(AudioContext) {
    context = new AudioContext();
    master = context.createGain();
    music = context.createGain();
    sfx = context.createGain();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -19;
    compressor.knee.value = 8;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.16;
    music.connect(compressor);
    sfx.connect(compressor);
    compressor.connect(master);
    master.connect(context.destination);
    master.gain.value = 0;

    const frames = Math.floor(context.sampleRate * 2);
    noiseBuffer = context.createBuffer(1, frames, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let frame = 0; frame < frames; frame++) samples[frame] = random(-1, 1) * 0.6;

    const breeze = noise();
    breeze.loop = true;
    windFilter = context.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 460;
    wind = context.createGain();
    wind.gain.value = 0;
    const gust = context.createOscillator();
    const sway = context.createGain();
    sway.gain.value = 38;
    gust.frequency.value = 0.17;
    gust.connect(sway);
    sway.connect(windFilter.frequency);
    gust.start();
    breeze.connect(windFilter);
    windFilter.connect(wind);
    wind.connect(music);
    breeze.start();

    context.onstatechange = () => {
      if (document.hidden && context.state === 'running') context.suspend().catch(() => {});
      sync();
    };
    applySettings();
  }

  function resume() {
    if (context.state === 'running') sync();
    else if (context.state !== 'closed') context.resume().then(sync, () => {});
  }

  function unlock(event) {
    if (!event.isTrusted || document.hidden) return;
    if (event.type === 'pointerdown' && event.pointerType !== 'mouse') return;
    if (event.type === 'keydown' && (event.key === 'Escape' || event.repeat)) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!context) {
      try {
        init(AudioContext);
      } catch {
        context?.close().catch(() => {});
        context = undefined;
        return;
      }
    }
    resume();
  }

  for (const event of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) {
    window.addEventListener(event, unlock, { capture: true, passive: true });
  }
  window.addEventListener('pyk', event => {
    const detail = event.detail;
    // A day/night view can override the Lampang clock if the game adds one.
    if (detail?.type === 'view' && ['day', 'night', 'auto'].includes(detail.mode)) {
      scenePhase = detail.mode === 'auto' ? undefined : detail.mode;
      nextClockCheck = 0;
    }
    play(detail?.type);
  });
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('button');
    if (button && !button.matches(':disabled') && button.getAttribute('aria-disabled') !== 'true') {
      play('ui-click');
    }
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (!context || context.state === 'closed') return;
    if (document.hidden) {
      pendingCues.clear();
      sync();
      context.suspend().catch(() => {});
    } else {
      nextClockCheck = 0;
      // Queue behind any suspension already requested by a rapid tab switch.
      context.resume().then(sync, () => {});
    }
  });

  function setVolume(channel, value) {
    if (!Number.isFinite(value)) return;
    settings[channel] = clamp(value);
    applySettings();
    saveSettings();
  }

  window.GameAudio = {
    play,
    setMusicVolume: value => setVolume('music', value),
    setSfxVolume: value => setVolume('sfx', value),
    mute(value) {
      settings.muted = Boolean(value);
      applySettings();
      saveSettings();
    },
    isMuted: () => settings.muted,
    // The engine owns the audio settings; the UI reads them from here.
    getSettings: () => ({ ...settings })
  };
})();
