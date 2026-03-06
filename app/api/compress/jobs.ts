export interface CompletedJob {
  outputPath: string;
  compressedSizeMB: string;
}

export const completedJobs = new Map<string, CompletedJob>();
