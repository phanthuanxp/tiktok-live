/**
 * TempleAudioEngine
 * - Nhạc nền: Phát trực tiếp file "Nam Mô A Di Đà Phật.m4a" (/assets/bg_chant.m4a) lặp vô tận êm dịu,
 *   tự động hạ nhỏ âm lượng (ducking) khi có giọng đọc lời khấn để không bị đè tiếng hay rè/xước.
 * - Pháp khí: Tổng hợp tiếng Mõ gỗ, Đại Hồng Chung, Ống xăm nhẹ nhàng, không vượt ngưỡng 0dBFS.
 * - Giọng đọc: Hàng đợi ZeroTTS phát tuần tự mượt mà.
 */
class TempleAudioEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.sfxEnabled = true;
    this.bgMusicEnabled = true;
    this.ttsEnabled = true;
    this.ttsVoice = 'maichi';

    // Nhạc nền "Nam Mô A Di Đà Phật.m4a" — mặc định 65%, cho phép chỉnh trực tiếp 0% - 100%
    const savedMusicVol = parseFloat(localStorage.getItem('temple_music_vol'));
    const savedTtsVol = parseFloat(localStorage.getItem('temple_tts_vol'));
    this.bgBaseVolume = Number.isFinite(savedMusicVol) ? Math.max(0, Math.min(1, savedMusicVol)) : 0.65;
    this.ttsVolume = Number.isFinite(savedTtsVol) ? Math.max(0, Math.min(1, savedTtsVol)) : 0.95;

    this.useSynthMusicFallback = false;
    this.synthBgTimer = null;
    this.synthBus = null;      // bus âm lượng riêng cho nền tổng hợp
    this.droneNodes = [];      // các node của lớp ngân trầm, để dọn khi tắt
    this.bgAudio = new Audio('/assets/bg_chant.m4a');
    this.bgAudio.loop = true;
    this.bgAudio.preload = 'auto';
    this.bgAudio.volume = this.bgBaseVolume;
    this.bgAudio.onerror = () => {
      this.useSynthMusicFallback = true;
    };
    this.ttsQueue = [];
    this.ttsPlaying = false;
    this.currentAudio = null;
    this.onTtsStateChange = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.unlocked = true;
    if (this.bgMusicEnabled) {
      this.startZenAmbience();
    }
    return this.ctx;
  }

  // --------------------------------------------------------------------------
  // 1. NHẠC NỀN "NAM MÔ A DI ĐÀ PHẬT.M4A" (CÓ AUTO-DUCKING KHI ĐỌC LỜI KHẤN)
  // --------------------------------------------------------------------------
  getDuckedVolume() {
    return Math.max(0.08, +(this.bgBaseVolume * 0.35).toFixed(2));
  }

  setMusicVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.bgBaseVolume = v;
    try {
      localStorage.setItem('temple_music_vol', String(v));
    } catch (_) {}
    if (this.bgAudio && !this.useSynthMusicFallback) {
      this.bgAudio.volume = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
    }
  }

  setTtsVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.ttsVolume = v;
    try {
      localStorage.setItem('temple_tts_vol', String(v));
    } catch (_) {}
    if (this.currentAudio) {
      this.currentAudio.volume = this.ttsVolume;
    }
  }

  startZenAmbience() {
    if (!this.bgMusicEnabled) return;
    if (this.useSynthMusicFallback) {
      this.startDefaultZenSynthLoop();
      return;
    }
    try {
      this.bgAudio.volume = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
      if (this.bgAudio.paused) {
        const p = this.bgAudio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            if (this.bgAudio.error) {
              this.useSynthMusicFallback = true;
              this.startDefaultZenSynthLoop();
            }
          });
        }
      }
    } catch (_) {
      this.useSynthMusicFallback = true;
      this.startDefaultZenSynthLoop();
    }
  }

  startDefaultZenSynthLoop() {
    if (!this.bgMusicEnabled || this.synthBgTimer || !this.ctx) return;
    const ctx = this.ctx;

    // ── Bus âm nền riêng: cho phép hạ tiếng mượt khi có giọng đọc ──────────
    this.synthBus = ctx.createGain();
    this.synthBus.gain.setValueAtTime(this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume, ctx.currentTime);
    this.synthBus.connect(ctx.destination);

    // ── 1. LỚP NGÂN TRẦM LIÊN TỤC (tiếng "Om" của Chánh Điện) ─────────────
    // Quãng 5 trầm (Đô – Sol), lệch nhẹ cao độ để tạo rung êm như tiếng tụng.
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(520, ctx.currentTime);
    droneFilter.Q.setValueAtTime(0.6, ctx.currentTime);

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.085, ctx.currentTime + 6); // vào rất chậm, không giật

    droneFilter.connect(droneGain);
    droneGain.connect(this.synthBus);

    this.droneNodes = [droneFilter, droneGain];
    [[130.81, 0], [130.81, 0.6], [196.0, -0.5]].forEach(([freq, detune]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.detune.setValueAtTime(detune * 100, ctx.currentTime);
      osc.connect(droneFilter);
      osc.start();
      this.droneNodes.push(osc);
    });

    // Hơi thở: bộ lọc nhấp nhô rất chậm (18 giây/nhịp) cho nền sống động, không tĩnh
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.setValueAtTime(1 / 18, ctx.currentTime);
    lfoDepth.gain.setValueAtTime(140, ctx.currentTime);
    lfo.connect(lfoDepth);
    lfoDepth.connect(droneFilter.frequency);
    lfo.start();
    this.droneNodes.push(lfo, lfoDepth);

    // ── 2. TIẾNG CHUÔNG XOAY ĐIỂM NHẸ (singing bowl) ──────────────────────
    // Chuông thật có bồi âm lệch (inharmonic) — chính điểm này làm nó "ra chuông"
    // thay vì nghe như nốt đàn điện tử.
    const BOWL_ROOTS = [196.0, 220.0, 261.63, 293.66, 329.63];
    const PARTIALS = [
      { ratio: 1.0, gain: 1.0, decay: 11 },
      { ratio: 2.02, gain: 0.42, decay: 8 },
      { ratio: 2.83, gain: 0.26, decay: 6 },
      { ratio: 5.41, gain: 0.12, decay: 3.5 }
    ];
    let bowlStep = 0;

    const strikeBowl = () => {
      if (!this.bgMusicEnabled || !this.ctx || !this.synthBus) return;
      try {
        const now = ctx.currentTime;
        const root = BOWL_ROOTS[bowlStep % BOWL_ROOTS.length];
        bowlStep++;
        PARTIALS.forEach((p) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(root * p.ratio, now);
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(0.16 * p.gain, now + 0.02); // gõ gọn
          g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay); // ngân dài
          osc.connect(g);
          g.connect(this.synthBus);
          osc.onended = () => {
            try { osc.disconnect(); g.disconnect(); } catch (_) {}
          };
          osc.start(now);
          osc.stop(now + p.decay + 0.1);
        });
      } catch (_) {}
      // Khoảng cách ngẫu nhiên 11–19 giây: nghe tự nhiên, không máy móc
      this.synthBgTimer = setTimeout(strikeBowl, 11000 + Math.random() * 8000);
    };

    this.synthBgTimer = setTimeout(strikeBowl, 4000);
  }

  stopZenAmbience() {
    try {
      this.bgAudio.pause();
    } catch (_) {}
    if (this.synthBgTimer) {
      clearTimeout(this.synthBgTimer);
      clearInterval(this.synthBgTimer);
      this.synthBgTimer = null;
    }
    // Tắt lớp ngân trầm êm dần rồi mới ngắt, tránh tiếng "bụp"
    if (this.synthBus && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        this.synthBus.gain.cancelScheduledValues(now);
        this.synthBus.gain.setValueAtTime(this.synthBus.gain.value, now);
        this.synthBus.gain.linearRampToValueAtTime(0.0001, now + 0.8);
      } catch (_) {}
      const bus = this.synthBus;
      const nodes = this.droneNodes || [];
      this.synthBus = null;
      this.droneNodes = [];
      setTimeout(() => {
        nodes.forEach((n) => {
          try { if (typeof n.stop === 'function') n.stop(); } catch (_) {}
          try { n.disconnect(); } catch (_) {}
        });
        try { bus.disconnect(); } catch (_) {}
      }, 900);
    }
  }

  setBgDucking(ducked) {
    if (!this.bgMusicEnabled) return;
    try {
      if (!this.useSynthMusicFallback && this.bgAudio) {
        this.bgAudio.volume = ducked ? this.getDuckedVolume() : this.bgBaseVolume;
      }
      // Nền tổng hợp: hạ/nâng mượt trong 0,4 giây để không cắt ngang lời khấn
      if (this.synthBus && this.ctx) {
        const now = this.ctx.currentTime;
        const target = ducked ? this.getDuckedVolume() : this.bgBaseVolume;
        this.synthBus.gain.cancelScheduledValues(now);
        this.synthBus.gain.setValueAtTime(this.synthBus.gain.value, now);
        this.synthBus.gain.linearRampToValueAtTime(Math.max(0.0001, target), now + 0.4);
      }
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 2. TIẾNG MÕ GỖ TỤNG KINH (WOODEN FISH PERCUSSION SYNTH)
  // --------------------------------------------------------------------------
  playWoodenFish(pitchMultiplier = 1.0) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const baseFreq = 620 * pitchMultiplier * (0.98 + Math.random() * 0.04);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq * 1.4, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.018);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.82, now + 0.14);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq * 1.15, now);
      filter.Q.setValueAtTime(4.0, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc1.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.onended = () => {
        osc1.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      osc1.start(now);
      osc1.stop(now + 0.16);
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 3. TIẾNG ĐẠI HỒNG CHUNG (TEMPLE BRONZE BELL)
  // --------------------------------------------------------------------------
  playTempleBell(intensity = 1.0) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const base = 174;
      const partials = [
        { ratio: 0.5, amp: 0.22, decay: 4.2 },
        { ratio: 1.0, amp: 0.35, decay: 3.6 },
        { ratio: 1.506, amp: 0.16, decay: 2.4 },
        { ratio: 2.0, amp: 0.18, decay: 1.9 }
      ];

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * Math.min(1.0, intensity), now);
      master.connect(ctx.destination);

      partials.forEach((p, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base * p.ratio, now);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(p.amp, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(g);
        g.connect(master);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
          if (idx === 0) master.disconnect();
        };
        osc.start(now);
        osc.stop(now + p.decay + 0.05);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 4. TIẾNG LẮC ỐNG XĂM TRE (FORTUNE STICK SHAKER)
  // --------------------------------------------------------------------------
  playFortuneShake() {
    if (!this.sfxEnabled) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playWoodenFish(1.32 + (i % 2) * 0.16);
      }, i * 120);
    }
  }

  // --------------------------------------------------------------------------
  // 5. TIẾNG CHUÔNG NGỌC DÂNG LỄ / THẮP HƯƠNG (SINGING CHIME)
  // --------------------------------------------------------------------------
  playIncenseChime() {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      const notes = [528, 660];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.10, now + idx * 0.1 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 1.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 1.15);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 6. ZEROTTS VOICE QUEUE & PREFETCHER
  // --------------------------------------------------------------------------
  enqueueTts(text, options = {}) {
    const onStart = typeof options.onStart === 'function' ? options.onStart : null;
    const onEnd = typeof options.onEnd === 'function' ? options.onEnd : null;

    if (!this.ttsEnabled) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 5500);
      return;
    }
    const clean = String(text || '').trim();
    if (!clean) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 5500);
      return;
    }

    if (this.ttsQueue.length >= 6) {
      const dropped = this.ttsQueue.shift();
      if (dropped?.onStart) dropped.onStart();
      if (dropped?.onEnd) dropped.onEnd();
    }

    const item = {
      id: `tts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      voice: (options.voice || this.ttsVoice || 'maichi').toLowerCase(),
      url: options.url || null,
      onStart,
      onEnd,
      fetchPromise: null
    };

    if (!item.url) {
      item.fetchPromise = this.fetchZeroTtsAudio(item.text, item.voice);
    }

    this.ttsQueue.push(item);
    this.processTtsQueue();
  }

  async fetchZeroTtsAudio(text, voice = 'maichi') {
    try {
      const token = new URLSearchParams(window.location.search).get('token') || '';
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-rpc-token': token } : {})
        },
        body: JSON.stringify({ text, voice })
      });
      const data = await res.json();
      if (data && data.ok && data.url) {
        return data;
      }
      return { ok: false, error: data?.error || 'ZeroTTS unavailable' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async processTtsQueue() {
    if (this.ttsPlaying || this.ttsQueue.length === 0) return;
    this.ttsPlaying = true;
    const item = this.ttsQueue.shift();

    try {
      let audioUrl = item.url;
      if (!audioUrl && item.fetchPromise) {
        const res = await item.fetchPromise;
        if (res && res.ok && res.url) {
          audioUrl = res.url;
        }
      }

      if (audioUrl) {
        this.setBgDucking(true);
        if (this.onTtsStateChange) {
          this.onTtsStateChange({ speaking: true, synthesizing: false, text: item.text });
        }
        if (item.onStart) item.onStart();
        await this.playWavUrl(audioUrl);
        if (item.onEnd) item.onEnd();
      } else {
        if (item.onStart) item.onStart();
        if (item.onEnd) setTimeout(item.onEnd, 5500);
      }
    } catch (err) {
      console.warn('[ZeroTTS Playback Warning]', err);
      if (item.onStart) item.onStart();
      if (item.onEnd) item.onEnd();
    } finally {
      this.ttsPlaying = false;
      if (this.ttsQueue.length === 0) {
        this.setBgDucking(false);
        if (this.onTtsStateChange) {
          this.onTtsStateChange({ speaking: false, synthesizing: false, text: '' });
        }
      } else {
        setTimeout(() => this.processTtsQueue(), 250);
      }
    }
  }

  playWavUrl(url) {
    return new Promise((resolve) => {
      try {
        const audio = new Audio(url);
        this.currentAudio = audio;
        audio.volume = this.ttsVolume;
        audio.onended = () => {
          this.currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          this.currentAudio = null;
          resolve();
        };
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            this.currentAudio = null;
            resolve();
          });
        }
      } catch (_) {
        resolve();
      }
    });
  }
}

window.TempleAudioEngine = TempleAudioEngine;
