import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { serverUrl, token } = await req.json();

  if (!serverUrl || !token) {
    return NextResponse.json({ error: "serverUrl and token are required" }, { status: 400 });
  }

  const base = serverUrl.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    // Get current user id to exclude from DM list
    const meRes = await fetch(`${base}/api/v4/users/me`, { headers });
    if (!meRes.ok) {
      return NextResponse.json({ error: "Invalid credentials or server URL" }, { status: 401 });
    }
    const me: { id: string; username: string } = await meRes.json();

    // Active users for DMs
    const usersRes = await fetch(
      `${base}/api/v4/users?active=true&per_page=60`,
      { headers }
    );
    const rawUsers: { id: string; username: string; first_name: string; last_name: string }[] =
      usersRes.ok ? await usersRes.json() : [];

    const users = rawUsers
      .filter((u) => u.id !== me.id)
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username,
      }));

    // Group messages (type G) — need to iterate teams
    const teamsRes = await fetch(`${base}/api/v4/users/me/teams`, { headers });
    const teams: { id: string }[] = teamsRes.ok ? await teamsRes.json() : [];

    const groupsMap = new Map<string, { id: string; name: string }>();
    await Promise.all(
      teams.map(async (team) => {
        const chRes = await fetch(
          `${base}/api/v4/users/me/teams/${team.id}/channels`,
          { headers }
        );
        if (!chRes.ok) return;
        const channels: { id: string; name: string; display_name: string; type: string }[] =
          await chRes.json();
        for (const c of channels) {
          if (c.type === "G" && !groupsMap.has(c.id)) {
            groupsMap.set(c.id, {
              id: c.id,
              name: c.display_name || c.name,
            });
          }
        }
      })
    );

    return NextResponse.json({ users, groups: Array.from(groupsMap.values()) });
  } catch {
    return NextResponse.json({ error: "Failed to reach Mattermost server" }, { status: 502 });
  }
}
