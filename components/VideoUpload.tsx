"use client";

import { useState, useRef, useCallback } from "react";

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/x-flv",
  "video/ogg",
  "video/3gpp",
  "video/mpeg",
];

const ACCEPTED_EXTENSIONS = ".mp4,.webm,.mov,.avi,.mkv,.flv,.ogv,.3gp,.mpeg,.mpg";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toUpperCase() : "UNKNOWN";
}

export interface SelectedFile {
  file: File;
  name: string;
  size: number;
  format: string;
}

interface VideoUploadProps {
  onFileSelected: (file: SelectedFile | null) => void;
  disabled?: boolean;
}

export default function VideoUpload({ onFileSelected, disabled = false }: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      if (!ACCEPTED_VIDEO_TYPES.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv|flv|ogv|3gp|mpeg|mpg)$/i)) {
        setError("El archivo seleccionado no es un video válido. Formatos aceptados: MP4, WebM, MOV, AVI, MKV, FLV, OGV, 3GP, MPEG.");
        setSelectedFile(null);
        onFileSelected(null);
        return;
      }

      const selected: SelectedFile = {
        file,
        name: file.name,
        size: file.size,
        format: getExtension(file.name),
      };

      setSelectedFile(selected);
      onFileSelected(selected);
    },
    [onFileSelected]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        validateAndSelect(files[0]);
      }
    },
    [disabled, validateAndSelect]
  );

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        validateAndSelect(files[0]);
      }
    },
    [validateAndSelect]
  );

  const handleRemove = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    onFileSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [onFileSelected]);

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Seleccionar archivo de video"
      />

      {!selectedFile ? (
        <button
          type="button"
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={disabled}
          className={`
            w-full rounded-xl border-2 border-dashed p-10 transition-all duration-200
            flex flex-col items-center justify-center gap-4 cursor-pointer
            ${
              isDragging
                ? "border-accent-light bg-accent/10"
                : "border-border hover:border-border-hover hover:bg-surface-hover"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          {/* Upload icon */}
          <svg
            className={`h-12 w-12 ${isDragging ? "text-accent-light" : "text-text-muted"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>

          <div className="text-center">
            <p className="text-base text-text-secondary">
              {isDragging ? (
                <span className="text-accent-light font-medium">Suelta el archivo aquí</span>
              ) : (
                <>
                  <span className="text-accent-light font-medium">Haz clic para seleccionar</span>{" "}
                  o arrastra un video aquí
                </>
              )}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              MP4, WebM, MOV, AVI, MKV y más
            </p>
          </div>
        </button>
      ) : (
        <div className="w-full rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-4">
            {/* Video file icon */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/15">
              <svg
                className="h-6 w-6 text-accent-light"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {selectedFile.name}
              </p>
              <div className="mt-1 flex items-center gap-3 text-sm text-text-muted">
                <span>{formatFileSize(selectedFile.size)}</span>
                <span className="inline-block h-1 w-1 rounded-full bg-text-muted" />
                <span>{selectedFile.format}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="shrink-0 rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary disabled:opacity-50"
              aria-label="Eliminar archivo"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
