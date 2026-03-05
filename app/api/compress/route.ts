import { NextRequest } from "next/server";
import { writeFile, unlink, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import ffmpeg from "fluent-ffmpeg";
import { completedJobs } from "./jobs";

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // Primer intento: ffprobe estándar
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`ffprobe falló: ${err.message}`));

      const raw = metadata.format.duration;
      const duration = typeof raw === "number" && isFinite(raw) && raw > 0 ? raw : null;

      if (duration) return resolve(duration);

      // Segundo intento: contar paquetes para estimar duración
      // Necesario para WebM de MediaRecorder (no incluye duración en el header)
      ffmpeg.ffprobe(
        filePath,
        ["-count_packets", "-analyzeduration", "2147483647", "-probesize", "2147483647"],
        (err2, meta2) => {
          if (err2) return reject(new Error("No se pudo determinar la duración del video"));

          const stream = meta2.streams?.[0];
          const frameRateStr = (stream?.r_frame_rate ?? stream?.avg_frame_rate) as string | undefined;
          const nbPackets = stream?.nb_read_packets;

          if (frameRateStr && nbPackets && nbPackets !== "N/A") {
            const [num, den] = frameRateStr.split("/").map(Number);
            const fps = num / den;
            const frames = parseInt(nbPackets as string, 10);
            if (fps > 0 && frames > 0) {
              return resolve(frames / fps);
            }
          }

          reject(new Error("No se pudo determinar la duración del video"));
        }
      );
    });
  });
}

export async function POST(request: NextRequest) {
  const inputPath = join(tmpdir(), `input-${randomUUID()}.webm`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.mp4`);
  const jobId = randomUUID();
  const encoder = new TextEncoder();

  const sendEvent = (
    controller: ReadableStreamDefaultController,
    data: object
  ) => {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      // El cliente puede haber desconectado
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        const targetSizeMB = formData.get("targetSizeMB");

        if (!file || !(file instanceof Blob)) {
          sendEvent(controller, { type: "error", message: "No se proporcionó un archivo de video" });
          controller.close();
          return;
        }

        if (!targetSizeMB) {
          sendEvent(controller, { type: "error", message: "No se proporcionó un tamaño objetivo" });
          controller.close();
          return;
        }

        const targetMB = parseFloat(targetSizeMB as string);
        if (isNaN(targetMB) || targetMB < 1) {
          sendEvent(controller, { type: "error", message: "El tamaño objetivo debe ser al menos 1 MB" });
          controller.close();
          return;
        }

        const originalSizeMB = file.size / (1024 * 1024);
        if (targetMB >= originalSizeMB) {
          sendEvent(controller, { type: "error", message: "El tamaño objetivo debe ser menor al tamaño original del video" });
          controller.close();
          return;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(inputPath, buffer);

        const duration = await getVideoDuration(inputPath);

        const targetBitsTotal = targetMB * 1024 * 1024 * 8;
        const videoBitrate = Math.floor(targetBitsTotal / duration / 1000); // kbps

        if (!isFinite(videoBitrate) || isNaN(videoBitrate) || videoBitrate <= 0) {
          await unlink(inputPath).catch(() => {});
          sendEvent(controller, { type: "error", message: "No se pudo calcular el bitrate para este video" });
          controller.close();
          return;
        }

        if (videoBitrate < 50) {
          await unlink(inputPath).catch(() => {});
          sendEvent(controller, { type: "error", message: "El tamaño objetivo resultaría en una calidad de video inaceptable" });
          controller.close();
          return;
        }

        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .videoCodec("libx264")
            .videoBitrate(videoBitrate)
            .noAudio()
            .outputOptions(["-preset", "ultrafast", "-movflags", "+faststart"])
            .output(outputPath)
            .on("progress", (info) => {
              const parts = (info.timemark ?? "0:0:0").split(":");
              const currentSeconds =
                parseFloat(parts[0]) * 3600 +
                parseFloat(parts[1]) * 60 +
                parseFloat(parts[2]);
              if (!isNaN(currentSeconds)) {
                const percent = Math.min(Math.max(Math.round((currentSeconds / duration) * 100), 0), 99);
                sendEvent(controller, { type: "progress", percent });
              }
            })
            .on("end", () => resolve())
            .on("error", (err: Error) => reject(err))
            .run();
        });

        await unlink(inputPath).catch(() => {});

        const outputStat = await stat(outputPath);
        const compressedSizeMB = (outputStat.size / (1024 * 1024)).toFixed(2);

        completedJobs.set(jobId, { outputPath, compressedSizeMB });

        sendEvent(controller, { type: "done", jobId, compressedSizeMB });
        controller.close();
      } catch (error) {
        await unlink(inputPath).catch(() => {});
        await unlink(outputPath).catch(() => {});
        const message =
          error instanceof Error ? error.message : "Error desconocido durante la compresión";
        sendEvent(controller, { type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
