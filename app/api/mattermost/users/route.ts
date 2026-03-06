import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.MATTERMOST_SERVER_URL?.replace(/\/$/, "");

export async function POST(req: NextRequest) {
  if (!BASE) {
    return NextResponse.json({ error: "Servidor no configurado" }, { status: 500 });
  }

  const { token } = await req.json();

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    const meRes = await fetch(`${BASE}/api/v4/users/me`, { headers });
    if (!meRes.ok) {
      return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 });
    }
    const me: { id: string; username: string } = await meRes.json();

    const usersRes = await fetch(`${BASE}/api/v4/users?active=true&per_page=60`, { headers });
    const rawUsers: { id: string; username: string; first_name: string; last_name: string }[] =
      usersRes.ok ? await usersRes.json() : [];

    const users = rawUsers
      .filter((u) => u.id !== me.id)
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username,
      }));

    const teamsRes = await fetch(`${BASE}/api/v4/users/me/teams`, { headers });
    const teams: { id: string }[] = teamsRes.ok ? await teamsRes.json() : [];

    const groupsMap = new Map<string, { id: string; name: string }>();
    await Promise.all(
      teams.map(async (team) => {
        const chRes = await fetch(`${BASE}/api/v4/users/me/teams/${team.id}/channels`, { headers });
        if (!chRes.ok) return;
        const channels: { id: string; name: string; display_name: string; type: string }[] =
          await chRes.json();
        for (const c of channels) {
          if (c.type === "G" && !groupsMap.has(c.id)) {
            groupsMap.set(c.id, { id: c.id, name: c.display_name || c.name });
          }
        }
      })
    );

    return NextResponse.json({ users, groups: Array.from(groupsMap.values()) });
  } catch {
    return NextResponse.json({ error: "Failed to reach Mattermost server" }, { status: 502 });
  }
}
