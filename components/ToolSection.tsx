"use client";

import { useState, useCallback } from "react";
import CompressorSection from "@/components/CompressorSection";
import ScreenRecorder from "@/components/ScreenRecorder";
import { type SelectedFile } from "@/components/VideoUpload";

type Tab = "compress" | "record";

export default function ToolSection() {
  const [activeTab, setActiveTab] = useState<Tab>("record");
  const [initialFile, setInitialFile] = useState<SelectedFile | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const handleSendToCompressor = useCallback((file: SelectedFile) => {
    setInitialFile(file);
    setActiveTab("compress");
  }, []);

  const handleReset = useCallback(() => {
    setInitialFile(null);
  }, []);

  return (
    <section id="compresor" className="mx-auto max-w-2xl px-4 py-20">
      {/* Tab switcher */}
      <div className="mb-8 flex gap-2 rounded-xl border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setActiveTab("record")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors
            ${activeTab === "record"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary"
            }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3" />
          </svg>
          Grabar pantalla
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("compress")}
          disabled={isRecording}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40
            ${activeTab === "compress"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary"
            }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Comprimir video
        </button>
      </div>

      {activeTab === "compress" && (
        <CompressorSection initialFile={initialFile} onReset={handleReset} />
      )}
      {activeTab === "record" && (
        <ScreenRecorder onSendToCompressor={handleSendToCompressor} onRecordingChange={setIsRecording} />
      )}
    </section>
  );
}
