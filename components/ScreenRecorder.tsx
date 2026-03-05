"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { type SelectedFile } from "@/components/VideoUpload";

type RecorderState = "idle" | "requesting" | "recording" | "preview";

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
      // 8 Mbps preserva calidad suficiente para re-comprimir sin degradación visible
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

      // Stop recording if user closes the share dialog/tab
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
        // User cancelled — no error shown
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

  const handleDownload = useCallback(() => {
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

  // Show preview blob in video element
  useEffect(() => {
    if (state === "preview" && blobRef.current && videoRef.current) {
      const url = URL.createObjectURL(blobRef.current);
      videoRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [state]);

  // Cleanup on unmount
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
                Sin audio · WebM · Directo al navegador
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

      {/* Preview */}
      {state === "preview" && (
        <div className="flex flex-col gap-4">
          <video
            ref={videoRef}
            controls
            className="w-full rounded-xl border border-border bg-black"
            style={{ maxHeight: "360px" }}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 rounded-lg bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Descargar ({sizeMB} MB)
            </button>
            {needsCompression && (
              <button
                type="button"
                onClick={handleSendToCompressor}
                className="flex-1 rounded-lg border border-accent/50 px-6 py-3 text-sm font-medium text-accent-light transition-colors hover:bg-accent/10"
              >
                Comprimir primero
              </button>
            )}
          </div>
          {!needsCompression && (
            <p className="text-center text-xs text-text-muted">
              El video pesa menos de 9 MB — no necesita compresión
            </p>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="w-full rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Volver a grabar
          </button>
        </div>
      )}
    </div>
  );
}
