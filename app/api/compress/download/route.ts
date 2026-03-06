import { NextRequest, NextResponse } from "next/server";
import { stat, unlink } from "fs/promises";
import { createReadStream } from "fs";
import { completedJobs } from "../jobs";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId requerido" }, { status: 400 });
  }

  const job = completedJobs.get(jobId);
  if (!job) {
    return NextResponse.json(
      { error: "Job no encontrado o ya descargado" },
      { status: 404 }
    );
  }

  completedJobs.delete(jobId);

  try {
    const outputStat = await stat(job.outputPath);
    const fileStream = createReadStream(job.outputPath);

    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        fileStream.on("end", () => {
          controller.close();
          unlink(job.outputPath).catch(() => {});
        });
        fileStream.on("error", (err) => {
          controller.error(err);
          unlink(job.outputPath).catch(() => {});
        });
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="video_compressed_${job.compressedSizeMB}mb.mp4"`,
        "Content-Length": outputStat.size.toString(),
        "X-Compressed-Size": job.compressedSizeMB,
      },
    });
  } catch {
    unlink(job.outputPath).catch(() => {});
    return NextResponse.json(
      { error: "Error al descargar el archivo" },
      { status: 500 }
    );
  }
}
