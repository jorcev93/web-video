import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, stat } from "fs/promises";
import { createReadStream } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import ffmpeg from "fluent-ffmpeg";

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      if (!duration || duration <= 0) {
        return reject(new Error("No se pudo determinar la duración del video"));
      }
      resolve(duration);
    });
  });
}

function compressVideo(
  inputPath: string,
  outputPath: string,
  videoBitrate: number,
  audioBitrate: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoBitrate(videoBitrate)
      .audioBitrate(audioBitrate)
      .outputOptions(["-movflags", "+faststart"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}

export async function POST(request: NextRequest) {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.mp4`);

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const targetSizeMB = formData.get("targetSizeMB");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No se proporcionó un archivo de video" },
        { status: 400 }
      );
    }

    if (!targetSizeMB) {
      return NextResponse.json(
        { error: "No se proporcionó un tamaño objetivo" },
        { status: 400 }
      );
    }

    const targetMB = parseFloat(targetSizeMB as string);
    if (isNaN(targetMB) || targetMB < 1) {
      return NextResponse.json(
        { error: "El tamaño objetivo debe ser al menos 1 MB" },
        { status: 400 }
      );
    }

    const originalSizeMB = file.size / (1024 * 1024);
    if (targetMB >= originalSizeMB) {
      return NextResponse.json(
        { error: "El tamaño objetivo debe ser menor al tamaño original del video" },
        { status: 400 }
      );
    }

    // Write uploaded file to temp location
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    // Get video duration
    const duration = await getVideoDuration(inputPath);

    // Calculate target bitrate
    // targetSize in bits = targetMB * 1024 * 1024 * 8
    // Reserve ~128kbps for audio
    const audioBitrate = 128; // kbps
    const audioBitsTotal = audioBitrate * 1000 * duration;
    const targetBitsTotal = targetMB * 1024 * 1024 * 8;
    const videoBitsTotal = targetBitsTotal - audioBitsTotal;

    if (videoBitsTotal <= 0) {
      await unlink(inputPath).catch(() => {});
      return NextResponse.json(
        { error: "El tamaño objetivo es demasiado pequeño para este video" },
        { status: 400 }
      );
    }

    const videoBitrate = Math.floor(videoBitsTotal / duration / 1000); // kbps

    if (videoBitrate < 50) {
      await unlink(inputPath).catch(() => {});
      return NextResponse.json(
        { error: "El tamaño objetivo resultaría en una calidad de video inaceptable" },
        { status: 400 }
      );
    }

    // Compress video
    await compressVideo(inputPath, outputPath, videoBitrate, audioBitrate);

    // Get compressed file size
    const outputStat = await stat(outputPath);
    const compressedSizeMB = (outputStat.size / (1024 * 1024)).toFixed(2);

    // Stream the file back
    const fileStream = createReadStream(outputPath);
    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        fileStream.on("end", () => {
          controller.close();
          // Clean up temp files
          unlink(inputPath).catch(() => {});
          unlink(outputPath).catch(() => {});
        });
        fileStream.on("error", (err) => {
          controller.error(err);
          unlink(inputPath).catch(() => {});
          unlink(outputPath).catch(() => {});
        });
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="video_compressed_${compressedSizeMB}mb.mp4"`,
        "Content-Length": outputStat.size.toString(),
        "X-Compressed-Size": compressedSizeMB,
      },
    });
  } catch (error) {
    // Clean up temp files on error
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    const message =
      error instanceof Error ? error.message : "Error desconocido durante la compresión";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
