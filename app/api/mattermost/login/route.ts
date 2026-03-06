import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.MATTERMOST_SERVER_URL?.replace(/\/$/, "");

export async function POST(req: NextRequest) {
  if (!BASE) {
    return NextResponse.json({ error: "Servidor no configurado" }, { status: 500 });
  }

  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña son requeridos" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/api/v4/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id: username, password }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
    }

    const token = res.headers.get("Token");
    if (!token) {
      return NextResponse.json({ error: "El servidor no devolvió un token" }, { status: 502 });
    }

    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar al servidor" }, { status: 502 });
  }
}
