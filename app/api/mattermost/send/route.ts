import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.MATTERMOST_SERVER_URL?.replace(/\/$/, "");

export async function POST(req: NextRequest) {
  if (!BASE) {
    return NextResponse.json({ error: "Servidor no configurado" }, { status: 500 });
  }

  const formData = await req.formData();
  const token = formData.get("token") as string;
  const recipientId = formData.get("channelId") as string;
  const recipientType = (formData.get("recipientType") as string) ?? "channel";
  const message = (formData.get("message") as string) ?? "";
  const file = formData.get("file") as Blob | null;

  if (!token || !recipientId) {
    return NextResponse.json({ error: "token and channelId are required" }, { status: 400 });
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  try {
    // Resolve the real channel ID for DMs
    let channelId = recipientId;
    if (recipientType === "user") {
      const meRes = await fetch(`${BASE}/api/v4/users/me`, { headers: authHeaders });
      if (!meRes.ok) {
        return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 });
      }
      const me: { id: string } = await meRes.json();

      const dmRes = await fetch(`${BASE}/api/v4/channels/direct`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify([me.id, recipientId]),
      });
      if (!dmRes.ok) {
        const text = await dmRes.text();
        return NextResponse.json(
          { error: `Failed to create DM channel: ${text}` },
          { status: dmRes.status }
        );
      }
      const dmChannel: { id: string } = await dmRes.json();
      channelId = dmChannel.id;
    }

    let fileIds: string[] = [];

    if (file) {
      const uploadForm = new FormData();
      uploadForm.append("channel_id", channelId);
      uploadForm.append("files", file, "grabacion.webm");

      const uploadRes = await fetch(`${BASE}/api/v4/files`, {
        method: "POST",
        headers: authHeaders,
        body: uploadForm,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        return NextResponse.json(
          { error: `File upload failed: ${text}` },
          { status: uploadRes.status }
        );
      }

      const uploadData: { file_infos: { id: string }[] } = await uploadRes.json();
      fileIds = uploadData.file_infos.map((f) => f.id);
    }

    const postRes = await fetch(`${BASE}/api/v4/posts`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: channelId, message, file_ids: fileIds }),
    });

    if (!postRes.ok) {
      const text = await postRes.text();
      return NextResponse.json(
        { error: `Post creation failed: ${text}` },
        { status: postRes.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to reach Mattermost server" }, { status: 502 });
  }
}
