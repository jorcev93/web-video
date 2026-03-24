"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { type SelectedFile } from "@/components/VideoUpload";
import MattermostShare from "@/components/MattermostShare";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

type RecorderState = "idle" | "requesting" | "recording" | "preview" | "converting";

interface Props {
  onSendToCompressor: (file: SelectedFile) => void;
  onRecordingChange?: (isRecording: boolean) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function ScreenRecorder({ onSendToCompressor, onRecordingChange }: Props) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [blobSize, setBlobSize] = useState(0);
  const [showMattermost, setShowMattermost] = useState(false);
  const [ffmpegReady, setFfmpegReady] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // Pre-cargar FFmpeg en segundo plano al montar el componente
  useEffect(() => {
    let cancelled = false;
    async function loadFFmpeg() {
      try {
        const ffmpeg = new FFmpeg();
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        if (!cancelled) {
          ffmpegRef.current = ffmpeg;
          setFfmpegReady(true);
        }
      } catch {
        // Si falla la precarga, lo intentará al descargar
      }
    }
    loadFFmpeg();
    return () => { cancelled = true; };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    setState("requesting");

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopTimer();
        onRecordingChange?.(false);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        setBlobSize(blob.size);
        setState("preview");
      };

      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      });

      recorder.start(1000);
      setState("recording");
      onRecordingChange?.(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      stopStream();
      setState("idle");
      if (err instanceof Error && err.name === "NotAllowedError") {
        // Usuario canceló — no mostrar error
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo iniciar la grabación de pantalla"
        );
      }
    }
  }, [stopTimer, stopStream]);

  const handleStop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopStream();
  }, [stopStream]);

  const handleDownloadMP4 = useCallback(async () => {
    if (!blobRef.current) return;
    setState("converting");
    setError(null);

    try {
      // Si FFmpeg no se pre-cargó, cargarlo ahora
      if (!ffmpegRef.current) {
        const ffmpeg = new FFmpeg();
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        ffmpegRef.current = ffmpeg;
      }

      const ffmpeg = ffmpegRef.current;
      await ffmpeg.writeFile("input.webm", await fetchFile(blobRef.current));
      await ffmpeg.exec([
        "-i", "input.webm",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "28",
        "-movflags", "+faststart",
        "output.mp4",
      ]);

      const rawData = await ffmpeg.readFile("output.mp4");
      const mp4Blob = new Blob([new Uint8Array(rawData as Uint8Array)], { type: "video/mp4" });
      await ffmpeg.deleteFile("input.webm").catch(() => {});
      await ffmpeg.deleteFile("output.mp4").catch(() => {});

      const url = URL.createObjectURL(mp4Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `grabacion-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo convertir el video a MP4");
    } finally {
      setState("preview");
    }
  }, []);

  const handleDownloadWebM = useCallback(() => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grabacion-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleSendToCompressor = useCallback(() => {
    if (!blobRef.current) return;
    const fileName = `grabacion-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
    const file = new File([blobRef.current], fileName, { type: blobRef.current.type });
    const selectedFile: SelectedFile = {
      file,
      name: fileName,
      size: file.size,
      format: "WEBM",
    };
    onSendToCompressor(selectedFile);
  }, [onSendToCompressor]);

  const handleReset = useCallback(() => {
    stopTimer();
    stopStream();
    blobRef.current = null;
    chunksRef.current = [];
    setDuration(0);
    setBlobSize(0);
    setError(null);
    setState("idle");
  }, [stopTimer, stopStream]);

  // Mostrar preview en el video element
  useEffect(() => {
    if (state === "preview" && blobRef.current && videoRef.current) {
      const url = URL.createObjectURL(blobRef.current);
      videoRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [state]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
    };
  }, [stopTimer, stopStream]);

  const sizeMB = (blobSize / (1024 * 1024)).toFixed(1);
  const needsCompression = blobSize > 9 * 1024 * 1024;

  return (
    <div className="w-full">
      {/* Idle */}
      {state === "idle" && (
        <div className="flex flex-col items-center gap-6 py-6">
          {error && (
            <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
              <svg
                className="h-8 w-8 text-accent-light"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3"
                />
              </svg>
            </div>
            <div>
              <p className="text-base font-medium text-text-primary">Graba tu pantalla</p>
              <p className="mt-1 text-sm text-text-secondary">
                Sin audio · MP4 / WebM · Directo al navegador
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStart}
            className="rounded-lg bg-accent px-8 py-3 font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent-light focus:ring-offset-2 focus:ring-offset-background"
          >
            Iniciar grabación
          </button>
        </div>
      )}

      {/* Requesting */}
      {state === "requesting" && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <svg
            className="h-8 w-8 animate-pulse text-accent-light"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3"
            />
          </svg>
          <p className="text-text-secondary">Selecciona qué grabar en el diálogo del navegador...</p>
        </div>
      )}

      {/* Recording */}
      {state === "recording" && (
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono text-2xl font-semibold tabular-nums text-text-primary">
              {formatTime(duration)}
            </span>
            <span className="text-sm text-text-muted">Grabando</span>
          </div>
          <button
            type="button"
            onClick={handleStop}
            className="rounded-lg bg-red-600 px-8 py-3 font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-background"
          >
            Detener grabación
          </button>
        </div>
      )}

      {/* Converting */}
      {state === "converting" && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <svg className="h-8 w-8 animate-spin text-accent-light" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-text-secondary">Convirtiendo a MP4...</p>
        </div>
      )}

      {/* Preview */}
      {state === "preview" && (
        <div className="flex flex-col gap-4">
          <video
            ref={videoRef}
            controls
            className="w-full rounded-xl border border-border bg-black"
            style={{ maxHeight: "360px" }}
          />
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadMP4}
              className="flex-1 rounded-lg bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {ffmpegReady
                ? `Descargar MP4 (${sizeMB} MB)`
                : "Descargar MP4 (preparando...)"}
            </button>
            <button
              type="button"
              onClick={handleDownloadWebM}
              className="flex-1 rounded-lg border border-accent/50 px-6 py-3 text-sm font-medium text-accent-light transition-colors hover:bg-accent/10"
            >
              Descargar WebM ({sizeMB} MB)
            </button>
          </div>
          {needsCompression && (
            <button
              type="button"
              onClick={handleSendToCompressor}
              className="w-full rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            >
              Comprimir primero
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowMattermost(true)}
            className="w-full rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Enviar por Mattermost
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Volver a grabar
          </button>
        </div>
      )}

      {showMattermost && blobRef.current && (
        <MattermostShare
          blob={blobRef.current}
          onClose={() => setShowMattermost(false)}
        />
      )}
    </div>
  );
}
