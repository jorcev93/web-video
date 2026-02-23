"use client";

import { useState, useCallback, useRef } from "react";
import VideoUpload, { type SelectedFile } from "@/components/VideoUpload";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

type CompressionState = "idle" | "loading-ffmpeg" | "compressing" | "done" | "error";
type CompressionMethod = "api" | "local";

interface CompressionResult {
  blob: Blob;
  compressedSizeMB: string;
  fileName: string;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => reject(new Error("No se pudo leer la duración del video"));
    video.src = URL.createObjectURL(file);
  });
}

export default function CompressorSection() {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [targetSizeMB, setTargetSizeMB] = useState("");
  const [state, setState] = useState<CompressionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [compressionMethod, setCompressionMethod] = useState<CompressionMethod>("api");
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const originalSizeMB = selectedFile ? selectedFile.size / (1024 * 1024) : 0;

  const validationError = (() => {
    if (!targetSizeMB) return null;
    const target = parseFloat(targetSizeMB);
    if (isNaN(target)) return "Ingresa un número válido";
    if (target < 1) return "El tamaño mínimo es 1 MB";
    if (selectedFile && target >= originalSizeMB) {
      return `El tamaño debe ser menor a ${formatMB(selectedFile.size)} MB`;
    }
    return null;
  })();

  const isProcessing = state === "compressing" || state === "loading-ffmpeg";

  const canCompress =
    selectedFile &&
    targetSizeMB &&
    !validationError &&
    !isProcessing;

  const handleCompress = useCallback(async () => {
    if (!selectedFile || !targetSizeMB) return;

    const needsLoading = compressionMethod === "local" && !ffmpegRef.current;
    setState(needsLoading ? "loading-ffmpeg" : "compressing");
    setError(null);
    setResult(null);

    try {
      if (compressionMethod === "api") {
        // --- Compresión vía API del servidor ---
        const formData = new FormData();
        formData.append("file", selectedFile.file);
        formData.append("targetSizeMB", targetSizeMB);

        const response = await fetch("/api/compress", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Error en la compresión");
        }

        const blob = await response.blob();
        const compressedSizeMB =
          response.headers.get("X-Compressed-Size") || formatMB(blob.size);

        const baseName = selectedFile.name.replace(/\.[^.]+$/, "");
        const fileName = `${baseName}_compressed_${compressedSizeMB}mb.mp4`;

        setResult({ blob, compressedSizeMB, fileName });
        setState("done");
      } else {
        // --- Compresión local en el dispositivo (ffmpeg.wasm) ---
        if (!ffmpegRef.current) {
          const ffmpeg = new FFmpeg();
          const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
          });
          ffmpegRef.current = ffmpeg;
          setState("compressing");
        }

        const ffmpeg = ffmpegRef.current;

        // Obtener duración del video desde el navegador
        const duration = await getVideoDuration(selectedFile.file);

        // Calcular bitrates (misma lógica que el servidor)
        const audioBitrate = 128; // kbps
        const targetMB = parseFloat(targetSizeMB);
        const audioBitsTotal = audioBitrate * 1000 * duration;
        const targetBitsTotal = targetMB * 1024 * 1024 * 8;
        const videoBitsTotal = targetBitsTotal - audioBitsTotal;

        if (videoBitsTotal <= 0) {
          throw new Error("El tamaño objetivo es demasiado pequeño para este video");
        }

        const videoBitrate = Math.floor(videoBitsTotal / duration / 1000); // kbps

        if (videoBitrate < 50) {
          throw new Error("El tamaño objetivo resultaría en una calidad de video inaceptable");
        }

        // Escribir archivo en el sistema de archivos virtual de ffmpeg
        const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "mp4";
        const inputName = `input.${ext}`;
        await ffmpeg.writeFile(inputName, await fetchFile(selectedFile.file));

        // Ejecutar compresión
        await ffmpeg.exec([
          "-i", inputName,
          "-b:v", `${videoBitrate}k`,
          "-b:a", `${audioBitrate}k`,
          "-movflags", "+faststart",
          "output.mp4",
        ]);

        // Leer resultado
        const rawData = await ffmpeg.readFile("output.mp4");
        const blobData: ArrayBuffer = rawData instanceof Uint8Array
          ? new Uint8Array(rawData).buffer.slice(0) as ArrayBuffer
          : new TextEncoder().encode(rawData as string).buffer.slice(0) as ArrayBuffer;
        const blob = new Blob([blobData], { type: "video/mp4" });
        const compressedSizeMB = formatMB(blob.size);

        // Limpiar sistema de archivos virtual
        await ffmpeg.deleteFile(inputName).catch(() => {});
        await ffmpeg.deleteFile("output.mp4").catch(() => {});

        const baseName = selectedFile.name.replace(/\.[^.]+$/, "");
        const fileName = `${baseName}_compressed_${compressedSizeMB}mb.mp4`;

        setResult({ blob, compressedSizeMB, fileName });
        setState("done");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      setState("error");
    }
  }, [selectedFile, targetSizeMB, compressionMethod]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setTargetSizeMB("");
    setState("idle");
    setError(null);
    setResult(null);
  }, []);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <section id="compresor" className="mx-auto max-w-2xl px-4 py-20">
      <h2 className="mb-2 text-center text-2xl font-bold text-text-primary sm:text-3xl">
        Sube tu video
      </h2>
      <p className="mb-8 text-center text-text-secondary">
        Selecciona el video que quieres comprimir
      </p>

      <VideoUpload
        onFileSelected={setSelectedFile}
        disabled={isProcessing}
      />

      {selectedFile && state !== "done" && (
        <div className="mt-6 space-y-4">
          {/* Selector de método de compresión */}
          <div>
            <p className="mb-2 block text-sm font-medium text-text-secondary">
              Método de compresión
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCompressionMethod("api")}
                disabled={isProcessing}
                className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50
                  ${compressionMethod === "api"
                    ? "border-accent bg-accent/10 text-accent-light"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                  }`}
              >
                {/* Ícono nube/servidor */}
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z"
                  />
                </svg>
                API del servidor
              </button>

              <button
                type="button"
                onClick={() => setCompressionMethod("local")}
                disabled={isProcessing}
                className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50
                  ${compressionMethod === "local"
                    ? "border-accent bg-accent/10 text-accent-light"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                  }`}
              >
                {/* Ícono CPU/dispositivo */}
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z"
                  />
                </svg>
                Este dispositivo
              </button>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {compressionMethod === "api"
                ? "Más rápido. El video se envía al servidor para procesarse."
                : "Sin subir archivos. La compresión ocurre en tu navegador."}
            </p>
          </div>

          {/* Input de tamaño objetivo */}
          <div>
            <label
              htmlFor="targetSize"
              className="mb-2 block text-sm font-medium text-text-secondary"
            >
              Tamaño objetivo (MB)
            </label>
            <div className="relative">
              <input
                id="targetSize"
                type="number"
                min={1}
                max={Math.floor(originalSizeMB)}
                step="any"
                value={targetSizeMB}
                onChange={(e) => setTargetSizeMB(e.target.value)}
                disabled={isProcessing}
                placeholder={`Máx. ${formatMB(selectedFile.size)} MB`}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 pr-12 text-text-primary placeholder:text-text-muted focus:border-accent-light focus:outline-none focus:ring-1 focus:ring-accent-light disabled:opacity-50"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                MB
              </span>
            </div>
            {validationError && (
              <p className="mt-2 text-sm text-red-400">{validationError}</p>
            )}
          </div>

          {/* Botón de comprimir */}
          <button
            type="button"
            onClick={handleCompress}
            disabled={!canCompress}
            className="w-full rounded-lg bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent-light focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-3">
                <svg
                  className="h-5 w-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {state === "loading-ffmpeg" ? "Cargando motor..." : "Comprimiendo..."}
              </span>
            ) : (
              "Comprimir video"
            )}
          </button>
        </div>
      )}

      {/* Estado de procesamiento */}
      {isProcessing && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          <div className="flex flex-col items-center gap-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full animate-pulse rounded-full bg-accent-light"
                style={{ width: "100%" }}
              />
            </div>
            <p className="text-sm text-text-secondary">
              {state === "loading-ffmpeg"
                ? "Cargando motor de compresión en tu navegador... Un momento."
                : `Comprimiendo video a ${targetSizeMB} MB... Esto puede tomar unos momentos.`}
            </p>
          </div>
        </div>
      )}

      {/* Estado de error */}
      {state === "error" && error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-400">
                Error en la compresión
              </p>
              <p className="mt-1 text-sm text-red-400/80">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setState("idle");
              setError(null);
            }}
            className="mt-4 w-full rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      {/* Estado completado - descarga */}
      {state === "done" && result && (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-6">
          <div className="flex flex-col items-center gap-4">
            <svg
              className="h-10 w-10 text-accent-light"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <div className="text-center">
              <p className="text-lg font-medium text-text-primary">
                Video comprimido exitosamente
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Tamaño final:{" "}
                <span className="font-medium text-accent-light">
                  {result.compressedSizeMB} MB
                </span>
                {selectedFile && (
                  <span className="text-text-muted">
                    {" "}
                    (de {formatMB(selectedFile.size)} MB)
                  </span>
                )}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 rounded-lg bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Descargar video
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-lg border border-border px-6 py-3 font-medium text-text-secondary transition-colors hover:bg-surface-hover"
              >
                Comprimir otro
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
