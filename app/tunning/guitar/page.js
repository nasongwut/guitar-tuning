"use client";

import { useEffect, useMemo, useRef, useState } from "react";


const BASE_STRINGS = [
  { key: "E2", label: "E2", thai: "สาย 6", en: "String 6", midi: 40 },
  { key: "A2", label: "A2", thai: "สาย 5", en: "String 5", midi: 45 },
  { key: "D3", label: "D3", thai: "สาย 4", en: "String 4", midi: 50 },
  { key: "G3", label: "G3", thai: "สาย 3", en: "String 3", midi: 55 },
  { key: "B3", label: "B3", thai: "สาย 2", en: "String 2", midi: 59 },
  { key: "E4", label: "E4", thai: "สาย 1", en: "String 1", midi: 64 },
];

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const PRESETS = {
  standard: {
    name: "Standard",
    offsets: [0, 0, 0, 0, 0, 0],
  },
  eb: {
    name: "Eb Standard",
    offsets: [-1, -1, -1, -1, -1, -1],
  },
  dropD: {
    name: "Drop D",
    offsets: [-2, 0, 0, 0, 0, 0],
  },
  dStandard: {
    name: "D Standard",
    offsets: [-2, -2, -2, -2, -2, -2],
  },
};

const TEXT = {
  th: {
    title: "Guitar Tuner",
    subtitle: "ตั้งสายกีตาร์ด้วยไมโครโฟนอัตโนมัติแบบ realtime",
    waitingSignal: "รอสัญญาณเสียง",
    signalReady: "มีสัญญาณพร้อมตั้งสาย",
    systemStatus: "สถานะระบบ",
    askingMic: "กำลังขอสิทธิ์ไมโครโฟน...",
    micReady: "อนุญาตไมโครโฟนแล้ว กำลังฟังเสียง...",
    micDenied: "ไม่สามารถใช้งานไมโครโฟนได้",
    micError:
      "ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตการใช้งานไมโครโฟนในเบราว์เซอร์",
    signalTitle: "สัญญาณเสียง",
    signalHint: "ไฟจะกระพริบเมื่อเสียงดังพอสำหรับการตั้งสาย",
    ready: "พร้อม",
    waiting: "รอ",
    detectedString: "Detected String",
    targetFreq: "เป้าหมาย",
    low: "ต่ำ",
    inTune: "ตรง",
    high: "สูง",
    frequency: "Frequency",
    detected: "Detected",
    cents: "Cents",
    currentSet: "ชุดสายปัจจุบัน",
    presetTuning: "Preset Tuning",
    shiftAll: "ลด / เพิ่มทั้งชุด",
    dropSemitone: "Drop -1 Semitone",
    upSemitone: "Up +1 Semitone",
    statusExact: "ตรง",
    statusLow: "ต่ำไป / หย่อน",
    statusHigh: "สูงไป / ตึง",
    language: "ภาษา",
  },
  en: {
    title: "Guitar Tuner",
    subtitle: "Realtime automatic guitar tuning with microphone input",
    waitingSignal: "Waiting for signal",
    signalReady: "Signal detected and ready",
    systemStatus: "System Status",
    askingMic: "Requesting microphone permission...",
    micReady: "Microphone enabled. Listening for sound...",
    micDenied: "Microphone is unavailable",
    micError:
      "Unable to access the microphone. Please allow microphone access in your browser.",
    signalTitle: "Audio Signal",
    signalHint: "The light will pulse when the sound is strong enough to tune",
    ready: "Ready",
    waiting: "Waiting",
    detectedString: "Detected String",
    targetFreq: "Target",
    low: "Low",
    inTune: "In Tune",
    high: "High",
    frequency: "Frequency",
    detected: "Detected",
    cents: "Cents",
    currentSet: "Current Strings",
    presetTuning: "Preset Tuning",
    shiftAll: "Shift All Strings",
    dropSemitone: "Drop -1 Semitone",
    upSemitone: "Up +1 Semitone",
    statusExact: "In Tune",
    statusLow: "Too Low / Loose",
    statusHigh: "Too High / Tight",
    language: "Language",
  },
};

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToLabel(midi) {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

function buildStrings(tuningOffsets = []) {
  return BASE_STRINGS.map((item, index) => {
    const midi = item.midi + (tuningOffsets[index] || 0);
    return {
      ...item,
      midi,
      label: midiToLabel(midi),
      freq: midiToFreq(midi),
    };
  });
}

function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }

  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;

  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }

  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
  const newSize = trimmed.length;
  if (newSize < 2) return -1;

  const c = new Array(newSize).fill(0);

  for (let i = 0; i < newSize; i++) {
    for (let j = 0; j < newSize - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (d + 1 < newSize && c[d] > c[d + 1]) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < newSize; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  if (maxPos <= 0) return -1;

  const x1 = c[maxPos - 1] || 0;
  const x2 = c[maxPos] || 0;
  const x3 = c[maxPos + 1] || 0;

  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;

  let t0 = maxPos;
  if (a) t0 = t0 - b / (2 * a);
  if (!t0) return -1;

  return sampleRate / t0;
}

function noteDiffInCents(freq, target) {
  return 1200 * Math.log2(freq / target);
}

function nearestString(freq, strings) {
  let best = strings[0];
  let bestDiff = Infinity;

  for (const item of strings) {
    const diff = Math.abs(noteDiffInCents(freq, item.freq));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = item;
    }
  }

  return best;
}

function statusText(cents, t) {
  if (Math.abs(cents) <= 5) return t.statusExact;
  if (cents < 0) return t.statusLow;
  return t.statusHigh;
}

export default function GuitarTunerPage() {
  const [lang, setLang] = useState("th");
  const t = TEXT[lang];

  const [frequency, setFrequency] = useState(null);
  const [detectedIndex, setDetectedIndex] = useState(0);
  const [cents, setCents] = useState(0);
  const [needleDeg, setNeedleDeg] = useState(0);
  const [error, setError] = useState("");
  const [permissionState, setPermissionState] = useState(TEXT.th.askingMic);
  const [presetKey, setPresetKey] = useState("standard");
  const [tuningOffsets, setTuningOffsets] = useState(PRESETS.standard.offsets);
  const [signalLevel, setSignalLevel] = useState(0);
  const [hasSignal, setHasSignal] = useState(false);

  const strings = useMemo(() => buildStrings(tuningOffsets), [tuningOffsets]);
  const target = strings[detectedIndex] || strings[0];

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const rafRef = useRef(null);

  const smoothFreqRef = useRef(null);
  const smoothCentsRef = useRef(0);
  const smoothNeedleRef = useRef(0);
  const stableIndexRef = useRef(0);
  const stableCountRef = useRef(0);

  const lastStrongSignalAtRef = useRef(0);
  const holdMsRef = useRef(1500);
  const lastFrequencyRef = useRef(null);

  const meterTone = useMemo(() => {
    if (Math.abs(cents) <= 5) {
      return {
        pill: "bg-emerald-500",
        text: "text-emerald-600",
        glow: "shadow-[0_0_30px_rgba(16,185,129,0.35)]",
      };
    }
    if (Math.abs(cents) <= 15) {
      return {
        pill: "bg-amber-500",
        text: "text-amber-600",
        glow: "shadow-[0_0_30px_rgba(245,158,11,0.30)]",
      };
    }
    return {
      pill: "bg-rose-500",
      text: "text-rose-600",
      glow: "shadow-[0_0_30px_rgba(244,63,94,0.30)]",
    };
  }, [cents]);

  const signalReady = hasSignal && signalLevel > 0.018;

  const signalDotClass = useMemo(() => {
    if (!signalReady) return "bg-slate-300";
    if (signalLevel > 0.07) return "bg-emerald-500 animate-pulse";
    if (signalLevel > 0.04) return "bg-lime-400 animate-pulse";
    return "bg-amber-400 animate-pulse";
  }, [signalReady, signalLevel]);

  const applyPreset = (key) => {
    const preset = PRESETS[key];
    setPresetKey(key);
    setTuningOffsets(preset.offsets);
  };

  const shiftAllStrings = (delta) => {
    setPresetKey("custom");
    setTuningOffsets((prev) => prev.map((v) => v + delta));
  };

  useEffect(() => {
    const savedLang = localStorage.getItem("app-lang");
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("app-lang", lang);
  }, [lang]);

  useEffect(() => {
    let mounted = true;

    const startMic = async () => {
      try {
        setError("");
        setPermissionState(TEXT[lang].askingMic);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        if (!mounted) return;

        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.88;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        sourceRef.current = source;
        mediaStreamRef.current = stream;

        const buffer = new Float32Array(analyser.fftSize);

        setPermissionState(TEXT[lang].micReady);

        const tick = () => {
          const analyserNode = analyserRef.current;
          const audioCtx = audioContextRef.current;
          if (!analyserNode || !audioCtx) return;

          analyserNode.getFloatTimeDomainData(buffer);

          let rms = 0;
          for (let i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
          }
          rms = Math.sqrt(rms / buffer.length);

          setSignalLevel(rms);

          const rawFreq = autoCorrelate(buffer, audioCtx.sampleRate);
          const strongEnoughSignal = rms > 0.03;

          if (rawFreq > 70 && rawFreq < 380 && strongEnoughSignal) {
            lastStrongSignalAtRef.current = performance.now();
            setHasSignal(true);

            if (smoothFreqRef.current == null) {
              smoothFreqRef.current = rawFreq;
            } else {
              smoothFreqRef.current =
                smoothFreqRef.current * 0.8 + rawFreq * 0.2;
            }

            const smoothedFreq = smoothFreqRef.current;
            lastFrequencyRef.current = smoothedFreq;

            const autoItem = nearestString(smoothedFreq, strings);
            const autoIndex = strings.findIndex(
              (x) => x.label === autoItem.label
            );

            if (stableIndexRef.current === autoIndex) {
              stableCountRef.current += 1;
            } else {
              stableIndexRef.current = autoIndex;
              stableCountRef.current = 1;
            }

            if (stableCountRef.current >= 2) {
              setDetectedIndex(autoIndex);
            }

            const currentTarget = strings[stableIndexRef.current] || strings[0];
            const rawCents = noteDiffInCents(smoothedFreq, currentTarget.freq);
            const limitedCents = Math.max(-50, Math.min(50, rawCents));

            smoothCentsRef.current =
              smoothCentsRef.current * 0.72 + limitedCents * 0.28;

            const nextNeedle = (smoothCentsRef.current / 50) * 45;
            smoothNeedleRef.current =
              smoothNeedleRef.current * 0.68 + nextNeedle * 0.32;

            setFrequency(smoothedFreq);
            setCents(smoothCentsRef.current);
            setNeedleDeg(smoothNeedleRef.current);
          } else {
            setHasSignal(false);
            smoothFreqRef.current = null;

            const now = performance.now();
            const silentFor = now - lastStrongSignalAtRef.current;
            const shouldHold = silentFor < holdMsRef.current;

            if (shouldHold) {
              setFrequency(lastFrequencyRef.current);
              setCents(smoothCentsRef.current);
              setNeedleDeg(smoothNeedleRef.current);
            } else {
              smoothCentsRef.current = smoothCentsRef.current * 0.94;
              smoothNeedleRef.current = smoothNeedleRef.current * 0.93;

              if (Math.abs(smoothCentsRef.current) < 0.1) {
                smoothCentsRef.current = 0;
              }
              if (Math.abs(smoothNeedleRef.current) < 0.1) {
                smoothNeedleRef.current = 0;
              }

              setFrequency(null);
              setCents(smoothCentsRef.current);
              setNeedleDeg(smoothNeedleRef.current);
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        tick();
      } catch (err) {
        console.error(err);
        setPermissionState(TEXT[lang].micDenied);
        setError(TEXT[lang].micError);
      }
    };

    startMic();

    return () => {
      mounted = false;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {}
      }

      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {}
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      analyserRef.current = null;
      sourceRef.current = null;
      audioContextRef.current = null;
      mediaStreamRef.current = null;
      rafRef.current = null;
    };
  }, [strings, lang]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_32%,_#020617_100%)]">
      <div className="min-h-screen w-full px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
        <div className="mx-auto flex min-h-[calc(100vh-24px)] w-full max-w-[1800px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/95 shadow-2xl backdrop-blur sm:min-h-[calc(100vh-32px)] lg:min-h-[calc(100vh-48px)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-5 text-white sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">{t.title}</h1>
                <p className="mt-1 text-sm text-slate-300">{t.subtitle}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <span className="text-slate-300">{t.language}</span>
                  <button
                    onClick={() => setLang("th")}
                    className={cn(
                      "rounded-full px-3 py-1 font-semibold transition",
                      lang === "th"
                        ? "bg-white text-slate-900"
                        : "bg-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    TH
                  </button>
                  <button
                    onClick={() => setLang("en")}
                    className={cn(
                      "rounded-full px-3 py-1 font-semibold transition",
                      lang === "en"
                        ? "bg-white text-slate-900"
                        : "bg-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    EN
                  </button>
                </div>

                <div className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur lg:w-auto">
                  <div
                    className={cn(
                      "h-3.5 w-3.5 rounded-full ring-4 ring-white/10",
                      signalDotClass
                    )}
                  />
                  <div className="text-sm font-medium text-slate-200">
                    {signalReady ? t.signalReady : t.waitingSignal}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-3 md:p-4 xl:p-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">
                {t.systemStatus}
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {permissionState}
              </div>

              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-700">
                      {t.signalTitle}
                    </div>
                    <div className="text-xs text-slate-500">{t.signalHint}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full shadow-sm ring-4 ring-white transition-all",
                        signalDotClass
                      )}
                    />
                    <div className="text-sm font-semibold text-slate-700">
                      {signalReady ? t.ready : t.waiting}
                    </div>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-100",
                      signalReady
                        ? "bg-gradient-to-r from-emerald-400 via-lime-400 to-teal-500"
                        : "bg-gradient-to-r from-slate-300 to-slate-400"
                    )}
                    style={{
                      width: `${Math.max(4, Math.min(100, signalLevel * 900))}%`,
                    }}
                  />
                </div>
              </div>

              {error ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm sm:p-6">
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 sm:text-sm">
                  {t.detectedString}
                </div>

                <div className="mt-3 flex items-center justify-center gap-3">
                  <div className="rounded-2xl bg-slate-900 px-5 py-2 text-4xl font-extrabold tracking-wide text-white shadow-lg sm:text-5xl md:text-6xl">
                    {target.label}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-500 sm:text-base">
                  {(lang === "th" ? target.thai : target.en)} • {t.targetFreq}{" "}
                  {target.freq.toFixed(2)} Hz
                </div>
              </div>

              <div className="mt-6">
                <div className="relative min-h-[340px] overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-100 px-3 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:min-h-[420px] sm:px-6 sm:py-8 md:min-h-[520px] xl:min-h-[680px]">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/2 top-10 h-28 w-28 -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl" />
                    <div className="absolute left-1/4 top-20 h-24 w-24 rounded-full bg-amber-100/50 blur-3xl" />
                    <div className="absolute right-1/4 top-20 h-24 w-24 rounded-full bg-rose-100/50 blur-3xl" />
                  </div>

                  <div className="relative mx-auto h-full w-full max-w-[1200px]">
                    <div className="relative h-full">
                      <div className="absolute left-1/2 top-[6%] h-[180px] w-[180px] -translate-x-1/2 sm:h-[230px] sm:w-[230px] md:h-[300px] md:w-[300px] xl:h-[380px] xl:w-[380px]">
                        <div className="absolute inset-0 rotate-180 rounded-full border-[18px] border-slate-200 border-b-transparent border-l-transparent border-r-transparent sm:border-[22px] md:border-[26px] xl:border-[32px]" />
                        <div className="absolute inset-0 rotate-180 rounded-full border-[18px] border-transparent border-t-rose-400 opacity-80 sm:border-[22px] md:border-[26px] xl:border-[32px] [clip-path:inset(0_48%_0_0)]" />
                        <div
                          className={cn(
                            "absolute inset-0 rotate-180 rounded-full border-[18px] border-transparent border-t-emerald-400 opacity-80 sm:border-[22px] md:border-[26px] xl:border-[32px] [clip-path:inset(0_30%_0_30%)]",
                            Math.abs(cents) <= 5 && signalReady
                              ? "opacity-100"
                              : "opacity-75"
                          )}
                        />
                        <div className="absolute inset-0 rotate-180 rounded-full border-[18px] border-transparent border-t-amber-400 opacity-85 sm:border-[22px] md:border-[26px] xl:border-[32px] [clip-path:inset(0_0_0_48%)]" />
                      </div>

                      <div className="absolute left-1/2 top-[9%] h-[150px] w-[150px] -translate-x-1/2 sm:h-[192px] sm:w-[192px] md:h-[250px] md:w-[250px] xl:h-[320px] xl:w-[320px]">
                        <div className="absolute inset-0 rotate-180 rounded-full border-[1.5px] border-slate-300 border-b-transparent border-l-transparent border-r-transparent opacity-70" />
                      </div>

                      <div className="absolute left-[10%] top-[42%] text-[11px] font-bold uppercase tracking-wide text-rose-500 sm:left-[14%] sm:text-xs md:left-[16%] xl:left-[20%] xl:text-sm">
                        {t.low}
                      </div>
                      <div className="absolute left-1/2 top-[31%] -translate-x-1/2 text-[11px] font-bold uppercase tracking-wide text-emerald-600 sm:text-xs xl:text-sm">
                        {t.inTune}
                      </div>
                      <div className="absolute right-[10%] top-[42%] text-[11px] font-bold uppercase tracking-wide text-amber-500 sm:right-[14%] sm:text-xs md:right-[16%] xl:right-[20%] xl:text-sm">
                        {t.high}
                      </div>

                      {[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map(
                        (v) => {
                          const left = 50 + (v / 50) * 38;
                          const isMajor = v % 25 === 0 || v === 0;

                          return (
                            <div
                              key={v}
                              className="absolute"
                              style={{
                                left: `${left}%`,
                                top: "56%",
                                transform: "translateX(-50%)",
                              }}
                            >
                              <div
                                className={cn(
                                  "mx-auto rounded-full bg-slate-400",
                                  isMajor
                                    ? "h-4 w-[2px] xl:h-5"
                                    : "h-2.5 w-[1.5px] xl:h-3"
                                )}
                              />
                              <div
                                className={cn(
                                  "mt-2 text-center font-semibold",
                                  isMajor
                                    ? "text-[11px] text-slate-700 sm:text-xs xl:text-sm"
                                    : "text-[10px] text-slate-400 xl:text-xs"
                                )}
                              >
                                {v > 0 ? `+${v}` : v}
                              </div>
                            </div>
                          );
                        }
                      )}

                      <div className="absolute left-1/2 top-[43%] h-[72px] w-[2px] -translate-x-1/2 rounded-full bg-slate-300 sm:h-[90px] md:h-[110px] xl:h-[140px]" />

                      <div
                        className="absolute left-1/2 top-[45%] origin-bottom"
                        style={{
                          transform: `translateX(-50%) rotate(${needleDeg}deg)`,
                          transition: "transform 45ms linear",
                          willChange: "transform",
                        }}
                      >
                        <div className="relative flex flex-col items-center">
                          <div
                            className={cn(
                              "absolute bottom-0 h-3 w-3 rounded-full blur-[6px] opacity-70",
                              meterTone.pill
                            )}
                          />
                          <div
                            className={cn(
                              "h-[82px] w-[4px] rounded-full bg-gradient-to-t from-rose-700 via-rose-500 to-rose-200 sm:h-[102px] md:h-[130px] xl:h-[180px]",
                              meterTone.glow
                            )}
                          />
                          <div className="-mt-1 h-3 w-3 rounded-full bg-rose-300 shadow" />
                        </div>
                      </div>

                      <div className="absolute left-1/2 top-[42.5%] h-6 w-6 -translate-x-1/2 rounded-full border-[3px] border-white bg-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.25)] sm:h-7 sm:w-7 md:h-8 md:w-8 xl:h-10 xl:w-10">
                        <div
                          className={cn(
                            "absolute inset-1 rounded-full transition-all duration-200",
                            signalDotClass
                          )}
                        />
                      </div>

                      <div className="absolute inset-x-0 bottom-0 flex justify-center">
                        <div className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 shadow-sm backdrop-blur xl:px-5 xl:py-2.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-3 w-3 rounded-full shadow",
                                meterTone.pill
                              )}
                            />
                            <div className="text-sm font-semibold text-slate-700 sm:text-base xl:text-lg">
                              {statusText(cents, t)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t.frequency}
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                      {frequency ? `${frequency.toFixed(2)} Hz` : "--"}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t.detected}
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                      {target.label}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t.cents}
                    </div>
                    <div
                      className={cn(
                        "mt-2 text-2xl font-bold sm:text-3xl",
                        meterTone.text
                      )}
                    >
                      {`${cents > 0 ? "+" : ""}${cents.toFixed(1)}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">
                {t.currentSet}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {strings.map((item, index) => {
                  const active = detectedIndex === index;
                  return (
                    <div
                      key={`${item.label}-${index}`}
                      className={cn(
                        "rounded-2xl border px-3 py-3 transition",
                        active
                          ? "border-indigo-500 bg-indigo-50 shadow-sm"
                          : "border-slate-200 bg-white"
                      )}
                    >
                      <div className="text-sm font-bold text-slate-900">
                        {item.label}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {(lang === "th" ? item.thai : item.en)} •{" "}
                        {item.freq.toFixed(2)} Hz
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">
                {t.presetTuning}
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-sm font-semibold transition active:scale-[0.98]",
                      presetKey === key
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">
                {t.shiftAll}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={() => shiftAllStrings(-1)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  {t.dropSemitone}
                </button>

                <button
                  onClick={() => shiftAllStrings(1)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  {t.upSemitone}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}