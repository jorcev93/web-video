import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { serverUrl, token } = await req.json();

  if (!serverUrl || !token) {
    return NextResponse.json({ error: "serverUrl and token are required" }, { status: 400 });
  }

  const base = serverUrl.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    const teamsRes = await fetch(`${base}/api/v4/users/me/teams`, { headers });
    if (!teamsRes.ok) {
      return NextResponse.json({ error: "Invalid credentials or server URL" }, { status: 401 });
    }
    const teams: { id: string; display_name: string }[] = await teamsRes.json();

    const teamsWithChannels = await Promise.all(
      teams.map(async (team) => {
        const chRes = await fetch(
          `${base}/api/v4/users/me/teams/${team.id}/channels`,
          { headers }
        );
        const channels: { id: string; name: string; display_name: string; type: string }[] =
          chRes.ok ? await chRes.json() : [];

        return {
          id: team.id,
          name: team.display_name,
          channels: channels
            .filter((c) => c.type === "O" || c.type === "P")
            .map((c) => ({ id: c.id, name: c.display_name || c.name, type: c.type })),
        };
      })
    );

    return NextResponse.json({ teams: teamsWithChannels });
  } catch {
    return NextResponse.json({ error: "Failed to reach Mattermost server" }, { status: 502 });
  }
}
