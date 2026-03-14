"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const EQ_BANDS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160,
  200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
];

const STORAGE_KEY = "mic-eq-31-band-values-v2";
const UI_STORAGE_KEY = "mic-eq-ui-panel-open-v1";
const MIN_DB = -12;
const MAX_DB = 12;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function formatFreq(freq) {
  if (freq >= 1000) {
    const k = freq / 1000;
    return Number.isInteger(k)
      ? `${k}k`
      : `${k.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")}k`;
  }
  return `${freq}`;
}

function createFlatEq() {
  return EQ_BANDS.map((freq) => ({
    freq,
    gain: 0,
  }));
}

function getBandEdges(freqs) {
  return freqs.map((freq, i) => {
    const prev = freqs[i - 1] ?? freq / 1.25;
    const next = freqs[i + 1] ?? freq * 1.25;

    const low = i === 0 ? Math.max(10, freq / 1.25) : Math.sqrt(prev * freq);
    const high = i === freqs.length - 1 ? freq * 1.25 : Math.sqrt(freq * next);

    return {
      center: freq,
      low,
      high,
    };
  });
}

function getAverageByteLevelInRange({ dataArray, sampleRate, lowFreq, highFreq }) {
  const nyquist = sampleRate / 2;
  const binCount = dataArray.length;

  let startIndex = Math.floor((lowFreq / nyquist) * binCount);
  let endIndex = Math.ceil((highFreq / nyquist) * binCount);

  startIndex = clamp(startIndex, 0, binCount - 1);
  endIndex = clamp(endIndex, 0, binCount - 1);

  if (endIndex < startIndex) {
    [startIndex, endIndex] = [endIndex, startIndex];
  }

  let total = 0;
  let count = 0;

  for (let i = startIndex; i <= endIndex; i++) {
    total += dataArray[i];
    count++;
  }

  if (!count) return 0;
  return total / count;
}

function mapBandLevel(raw, noiseFloor, sensitivity, ceiling) {
  const adjusted = Math.max(0, raw - noiseFloor);
  const range = Math.max(1, 255 - noiseFloor);
  const x = adjusted / range;
  const curved = Math.pow(x, 1.65) * sensitivity;
  return clamp(curved, 0, ceiling);
}

function mapMasterLevel(rms, threshold, sensitivity, ceiling) {
  const scaled = Math.max(0, rms * 100 - threshold) / 100;
  const curved = Math.pow(scaled * 3.2, 1.45) * sensitivity;
  return clamp(curved, 0, ceiling);
}

export default function EqualizerMicPage() {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [permissionState, setPermissionState] = useState("idle");
  const [masterLevel, setMasterLevel] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState("flat");
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);

  const [inputGain, setInputGain] = useState(1);
  const [masterThreshold, setMasterThreshold] = useState(10);
  const [masterSensitivity, setMasterSensitivity] = useState(1);
  const [masterCeiling, setMasterCeiling] = useState(0.82);

  const [bandSensitivity, setBandSensitivity] = useState(0.85);
  const [bandNoiseFloor, setBandNoiseFloor] = useState(18);
  const [bandCeiling, setBandCeiling] = useState(0.88);

  const [eqBands, setEqBands] = useState(createFlatEq());

  const [vuBands, setVuBands] = useState(
    EQ_BANDS.map((freq) => ({
      freq,
      db: -100,
      level: 0,
      peak: 0,
      raw: 0,
    })),
  );

  const bandEdges = useMemo(() => getBandEdges(EQ_BANDS), []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const normalized = EQ_BANDS.map((freq, index) => ({
            freq,
            gain: clamp(Number(parsed[index]?.gain ?? 0), MIN_DB, MAX_DB),
          }));
          setEqBands(normalized);
        }
      }

      const uiOpen = localStorage.getItem(UI_STORAGE_KEY);
      if (uiOpen !== null) setControlsOpen(uiOpen === "1");
    } catch (err) {
      console.error("load error:", err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eqBands));
    } catch (err) {
      console.error("save eq error:", err);
    }
  }, [eqBands]);

  useEffect(() => {
    try {
      localStorage.setItem(UI_STORAGE_KEY, controlsOpen ? "1" : "0");
    } catch {}
  }, [controlsOpen]);

  useEffect(() => {
    const updateOrientation = () => {
      setIsLandscape(window.innerWidth >= window.innerHeight);
    };

    updateOrientation();

    const tryLockLandscape = async () => {
      try {
        if (screen.orientation?.lock) {
          await screen.orientation.lock("landscape");
        }
      } catch {
        // บาง browser / iPhone จะไม่อนุญาต
      }
    };

    tryLockLandscape();

    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);

    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, []);

  const stopMic = async () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {}
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    setRunning(false);
    setPermissionState("idle");
    setMasterLevel(0);
    setVuBands(
      EQ_BANDS.map((freq) => ({
        freq,
        db: -100,
        level: 0,
        peak: 0,
        raw: 0,
      })),
    );
  };

  const startMic = async () => {
    try {
      await stopMic();
      setError("");
      setPermissionState("requesting");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.72;
      analyser.minDecibels = -100;
      analyser.maxDecibels = -30;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamRef.current = stream;

      const freqArray = new Uint8Array(analyser.frequencyBinCount);
      const timeArray = new Uint8Array(analyser.fftSize);

      setRunning(true);
      setPermissionState("granted");

      const tick = () => {
        const analyserNode = analyserRef.current;
        const ctx = audioContextRef.current;
        if (!analyserNode || !ctx) return;

        analyserNode.getByteFrequencyData(freqArray);
        analyserNode.getByteTimeDomainData(timeArray);

        let sumSquares = 0;
        for (let i = 0; i < timeArray.length; i++) {
          const centered = ((timeArray[i] - 128) / 128) * inputGain;
          sumSquares += centered * centered;
        }

        const rms = Math.sqrt(sumSquares / timeArray.length);

        const normalizedMaster = mapMasterLevel(
          rms,
          masterThreshold,
          masterSensitivity,
          masterCeiling,
        );

        setMasterLevel((prev) =>
          normalizedMaster > prev
            ? lerp(prev, normalizedMaster, 0.22)
            : lerp(prev, normalizedMaster, 0.08),
        );

        setVuBands((prev) =>
          bandEdges.map((band, index) => {
            const rawBase = getAverageByteLevelInRange({
              dataArray: freqArray,
              sampleRate: ctx.sampleRate,
              lowFreq: band.low,
              highFreq: band.high,
            });

            const raw = clamp(rawBase * inputGain, 0, 255);

            const normalized = mapBandLevel(
              raw,
              bandNoiseFloor,
              bandSensitivity,
              bandCeiling,
            );

            const prevItem = prev[index] || {
              freq: band.center,
              db: -100,
              level: 0,
              peak: 0,
              raw: 0,
            };

            const smoothLevel =
              normalized > prevItem.level
                ? lerp(prevItem.level, normalized, 0.22)
                : lerp(prevItem.level, normalized, 0.08);

            const nextPeak =
              smoothLevel > prevItem.peak
                ? smoothLevel
                : Math.max(smoothLevel, prevItem.peak - 0.006);

            const adjustedRaw = Math.max(0, raw - bandNoiseFloor);
            const fakeDb =
              adjustedRaw > 0
                ? -90 + (adjustedRaw / Math.max(1, 255 - bandNoiseFloor)) * 90
                : -100;

            return {
              freq: band.center,
              db: fakeDb,
              level: smoothLevel,
              peak: nextPeak,
              raw,
            };
          }),
        );

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setPermissionState("denied");
      setError(
        "ไม่สามารถใช้งานไมโครโฟนได้ กรุณาอนุญาตการเข้าถึงไมค์ หรือเปิดผ่าน https / localhost",
      );
      setRunning(false);
    }
  };

  useEffect(() => {
    return () => {
      stopMic();
    };
  }, []);

  const updateEqBand = (index, gain) => {
    setEqBands((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, gain: clamp(Number(gain), MIN_DB, MAX_DB) }
          : item,
      ),
    );
  };

  const stepEqBand = (index, delta) => {
    setEqBands((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              gain: clamp(Number((item.gain + delta).toFixed(1)), MIN_DB, MAX_DB),
            }
          : item,
      ),
    );
  };

  const resetFlat = () => {
    setSelectedPreset("flat");
    setEqBands(createFlatEq());
  };

  const applyPreset = (preset) => {
    setSelectedPreset(preset);

    const next = EQ_BANDS.map((freq) => ({ freq, gain: 0 }));

    const setRange = (min, max, gain) => {
      for (let i = 0; i < next.length; i++) {
        if (next[i].freq >= min && next[i].freq <= max) {
          next[i].gain = gain;
        }
      }
    };

    if (preset === "flat") {
      setEqBands(createFlatEq());
      return;
    }

    if (preset === "vocal") {
      setRange(20, 80, -3);
      setRange(100, 250, -1);
      setRange(315, 1000, 2);
      setRange(1250, 4000, 4);
      setRange(5000, 8000, 2);
      setRange(10000, 20000, -1);
    }

    if (preset === "bass-boost") {
      setRange(20, 80, 5);
      setRange(100, 200, 3);
      setRange(250, 630, 1);
      setRange(800, 2000, -1);
      setRange(2500, 20000, -2);
    }

    if (preset === "treble-boost") {
      setRange(20, 125, -2);
      setRange(160, 1000, 0);
      setRange(1250, 4000, 2);
      setRange(5000, 20000, 5);
    }

    if (preset === "smile") {
      setRange(20, 80, 4);
      setRange(100, 250, 2);
      setRange(315, 2500, -2);
      setRange(3150, 8000, 2);
      setRange(10000, 20000, 4);
    }

    setEqBands(next);
  };

  const exportJson = async () => {
    const payload = {
      type: "31-band-equalizer",
      minDb: MIN_DB,
      maxDb: MAX_DB,
      bands: eqBands,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      alert("คัดลอกค่า EQ เป็น JSON แล้ว");
    } catch (err) {
      console.error(err);
      alert("คัดลอกไม่สำเร็จ");
    }
  };

  const vuPixelHeight = 240;
  const eqPositivePixelHeight = 120;

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-950 text-white">
      {!isLandscape && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-center">
          <div className="max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6">
            <div className="text-2xl font-bold">กรุณาหมุนหน้าจอเป็นแนวนอน</div>
            <div className="mt-3 text-sm text-slate-300">
              หน้านี้ออกแบบให้ใช้งานแบบ landscape เพื่อให้เห็น VU Meter และ EQ ครบ 31 band ชัดเจน
            </div>
          </div>
        </div>
      )}

      <div className="flex h-full w-full flex-col">
        <div className="shrink-0 border-b border-slate-800 bg-slate-900 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight sm:text-2xl">
                31 Band Mic VU Meter + Equalizer
              </h1>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                รองรับทัชสกรีน • landscape • พับเก็บ control ได้
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!running ? (
                <button
                  onClick={startMic}
                  className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black active:scale-[0.98]"
                >
                  เปิดไมค์
                </button>
              ) : (
                <button
                  onClick={stopMic}
                  className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white active:scale-[0.98]"
                >
                  ปิดไมค์
                </button>
              )}

              <button
                onClick={() => setControlsOpen((v) => !v)}
                className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold active:scale-[0.98]"
              >
                {controlsOpen ? "ซ่อน Control" : "แสดง Control"}
              </button>
            </div>
          </div>

          {controlsOpen && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    Permission
                  </div>
                  <div className="mt-1 text-sm font-semibold">{permissionState}</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    Input
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {running ? "Microphone Active" : "Stopped"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    Preset
                  </div>
                  <div className="mt-1 text-sm font-semibold">{selectedPreset}</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    Master VU
                  </div>
                  <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all"
                      style={{ width: `${masterLevel * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 xl:grid-cols-7">
                {[
                  ["Flat", () => applyPreset("flat")],
                  ["Vocal", () => applyPreset("vocal")],
                  ["Bass", () => applyPreset("bass-boost")],
                  ["Treble", () => applyPreset("treble-boost")],
                  ["Smile", () => applyPreset("smile")],
                  ["Reset", resetFlat],
                  ["Copy JSON", exportJson],
                ].map(([label, onClick]) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm font-semibold active:scale-[0.98]"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">
                    Input Gain
                  </div>
                  <input
                    type="range"
                    min="0.25"
                    max="2"
                    step="0.05"
                    value={inputGain}
                    onChange={(e) => setInputGain(Number(e.target.value))}
                    className="touch-slider w-full"
                  />
                  <div className="mt-2 text-sm text-slate-300">{inputGain.toFixed(2)}x</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">
                    Master Threshold / Sensitivity / Ceiling
                  </div>
                  <div className="space-y-3">
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="1"
                      value={masterThreshold}
                      onChange={(e) => setMasterThreshold(Number(e.target.value))}
                      className="touch-slider w-full"
                    />
                    <div className="text-sm text-slate-300">Threshold: {masterThreshold}</div>

                    <input
                      type="range"
                      min="0.4"
                      max="2"
                      step="0.05"
                      value={masterSensitivity}
                      onChange={(e) => setMasterSensitivity(Number(e.target.value))}
                      className="touch-slider w-full"
                    />
                    <div className="text-sm text-slate-300">
                      Sensitivity: {masterSensitivity.toFixed(2)}x
                    </div>

                    <input
                      type="range"
                      min="0.4"
                      max="1"
                      step="0.01"
                      value={masterCeiling}
                      onChange={(e) => setMasterCeiling(Number(e.target.value))}
                      className="touch-slider w-full"
                    />
                    <div className="text-sm text-slate-300">
                      Ceiling: {(masterCeiling * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">
                    Band Sensitivity / Noise Floor / Ceiling
                  </div>
                  <div className="space-y-3">
                    <input
                      type="range"
                      min="0.4"
                      max="2"
                      step="0.05"
                      value={bandSensitivity}
                      onChange={(e) => setBandSensitivity(Number(e.target.value))}
                      className="touch-slider w-full"
                    />
                    <div className="text-sm text-slate-300">
                      Sensitivity: {bandSensitivity.toFixed(2)}x
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="80"
                      step="1"
                      value={bandNoiseFloor}
                      onChange={(e) => setBandNoiseFloor(Number(e.target.value))}
                      className="touch-slider w-full"
                    />
                    <div className="text-sm text-slate-300">Noise Floor: {bandNoiseFloor}</div>

                    <input
                      type="range"
                      min="0.4"
                      max="1"
                      step="0.01"
                      value={bandCeiling}
                      onChange={(e) => setBandCeiling(Number(e.target.value))}
                      className="touch-slider w-full"
                    />
                    <div className="text-sm text-slate-300">
                      Ceiling: {(bandCeiling * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-slate-950">
          <div className="grid h-full grid-rows-[1fr_1fr] gap-3 p-3">
            <section className="min-h-0 rounded-3xl border border-slate-800 bg-slate-900 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold sm:text-lg">VU Meter</h2>
                <div className="text-xs text-slate-400">ครบ 31 band</div>
              </div>

              <div className="h-[calc(100%-2rem)] overflow-x-auto overflow-y-hidden rounded-2xl border border-slate-800 bg-slate-950/50 p-2">
                <div className="flex h-full min-w-[1705px] items-end gap-1.5 touch-pan-x">
                  {vuBands.map((band) => {
                    const height = band.level * vuPixelHeight;
                    const peakBottom = Math.max(0, band.peak * vuPixelHeight - 2);

                    return (
                      <div
                        key={`vu-${band.freq}`}
                        className="flex h-full w-[53px] shrink-0 flex-col items-center"
                      >
                        <div className="mb-1 h-8 text-center text-[10px] font-medium leading-tight text-slate-300">
                          {band.db > -99 ? `${band.db.toFixed(0)} dB` : "-∞"}
                        </div>

                        <div className="relative flex flex-1 w-full items-end justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                          <div className="absolute inset-x-0 bottom-[25%] border-t border-dashed border-slate-700" />
                          <div className="absolute inset-x-0 bottom-[50%] border-t border-dashed border-slate-700" />
                          <div className="absolute inset-x-0 bottom-[75%] border-t border-dashed border-slate-700" />

                          <div
                            className="absolute bottom-0 w-8 rounded-t-md bg-emerald-400 transition-all duration-75"
                            style={{ height: `${height}px` }}
                          />

                          <div
                            className="absolute w-9 border-t-2 border-amber-300"
                            style={{ bottom: `${peakBottom}px` }}
                          />
                        </div>

                        <div className="mt-1 text-center text-[10px] font-semibold text-slate-200">
                          {formatFreq(band.freq)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="min-h-0 rounded-3xl border border-slate-800 bg-slate-900 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold sm:text-lg">31 Band Equalizer</h2>
                <div className="text-xs text-slate-400">รองรับทัชสกรีน</div>
              </div>

              <div className="h-[calc(100%-2rem)] overflow-x-auto overflow-y-hidden rounded-2xl border border-slate-800 bg-slate-950/50 p-2">
                <div className="flex h-full min-w-[1705px] items-end gap-1.5 touch-pan-x">
                  {eqBands.map((band, index) => {
                    const gain = Number(band.gain || 0);
                    const positiveHeight =
                      gain > 0 ? `${(gain / MAX_DB) * eqPositivePixelHeight}px` : "0px";
                    const negativeHeight =
                      gain < 0
                        ? `${(Math.abs(gain) / Math.abs(MIN_DB)) * eqPositivePixelHeight}px`
                        : "0px";

                    return (
                      <div
                        key={`eq-${band.freq}`}
                        className="flex h-full w-[53px] shrink-0 flex-col items-center"
                      >
                        <div className="mb-1 text-[10px] font-semibold text-slate-300">
                          {gain > 0 ? `+${gain}` : gain}
                        </div>

<div className="relative flex flex-1 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
  <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-600" />

  <div
    className="absolute bottom-1/2 w-7 rounded-t-md bg-cyan-400/85"
    style={{ height: positiveHeight }}
  />
  <div
    className="absolute top-1/2 w-7 rounded-b-md bg-fuchsia-400/85"
    style={{ height: negativeHeight }}
  />

  {/* รางตรงกลาง */}
  <div className="absolute inset-y-2 left-1/2 w-[6px] -translate-x-1/2 rounded-full bg-slate-700" />

  {/* slider */}
  <div className="absolute inset-y-1 left-1/2 flex -translate-x-1/2 items-center justify-center">
    <input
      type="range"
      min={MIN_DB}
      max={MAX_DB}
      step={0.5}
      value={gain}
      onChange={(e) => updateEqBand(index, e.target.value)}
      className="eq-slider-vertical"
    />
  </div>
</div>

                        <div className="mt-1 text-center text-[10px] font-semibold text-slate-200">
                          {formatFreq(band.freq)}
                        </div>

                        <div className="mt-1 flex w-full items-center gap-1">
                          <button
                            onClick={() => stepEqBand(index, -0.5)}
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-0 py-2 text-xs font-bold active:scale-[0.98]"
                          >
                            -
                          </button>

                          <input
                            type="number"
                            min={MIN_DB}
                            max={MAX_DB}
                            step={0.5}
                            value={gain}
                            onChange={(e) => updateEqBand(index, e.target.value)}
                            className="w-[26px] rounded-lg border border-slate-700 bg-slate-950 px-0 py-2 text-center text-[10px] text-white outline-none"
                          />

                          <button
                            onClick={() => stepEqBand(index, 0.5)}
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-0 py-2 text-xs font-bold active:scale-[0.98]"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

<style jsx>{`
  .touch-pan-x {
    touch-action: pan-x;
  }

  .touch-slider {
    touch-action: pan-x;
  }

.eq-slider-vertical {
  -webkit-appearance: none;
  appearance: none;
  writing-mode: vertical-lr;
  direction: rtl;
  width: 26px;
  height: 100%;
  min-height: 100%;
  background: transparent;
  cursor: pointer;
  touch-action: none;
  position: relative;
  z-index: 20;
}

.eq-slider-vertical::-webkit-slider-runnable-track {
  width: 6px;
  background: transparent;
  border-radius: 9999px;
}

.eq-slider-vertical::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  background: #f8fafc;
  border: 2px solid #0f172a;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  cursor: pointer;

  /* สำคัญ */
  margin-left: -7px;
}

.eq-slider-vertical::-moz-range-track {
  width: 6px;
  background: transparent;
  border-radius: 9999px;
}

.eq-slider-vertical::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border: 2px solid #0f172a;
  border-radius: 9999px;
  background: #f8fafc;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
    .touch-slider::-webkit-slider-runnable-track {
    height: 10px;
    background: #334155;
    border-radius: 9999px;
  }

  .touch-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 9999px;
    background: #f8fafc;
    margin-top: -7px;
    cursor: pointer;
  }

  .touch-slider::-moz-range-track {
    height: 10px;
    background: #334155;
    border-radius: 9999px;
  }

  .touch-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 9999px;
    background: #f8fafc;
    cursor: pointer;
  }
`}</style>
    </div>
  );
}