"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface Channel {
  id: string;
  name: string;
  type: string;
}

interface Team {
  id: string;
  name: string;
  channels: Channel[];
}

interface User {
  id: string;
  username: string;
  displayName: string;
}

interface Group {
  id: string;
  name: string;
}

type Step = "config" | "browse" | "sending" | "done" | "error";
type Tab = "channels" | "users" | "groups";

const STORAGE_KEY = "mm_config";

interface Props {
  blob: Blob;
  onClose: () => void;
}

export default function MattermostShare({ blob, onClose }: Props) {
  const [step, setStep] = useState<Step>("config");
  const serverUrl = "";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [configError, setConfigError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>("channels");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"channel" | "user" | "group">("channel");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Load saved token on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { serverUrl: su, token: t } = JSON.parse(saved);
        if (su && t) {
          setToken(t);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const loadData = useCallback(async (_su: string, t: string) => {
    setConnecting(true);
    setConfigError("");
    try {
      const [chRes, usRes] = await Promise.all([
        fetch("/api/mattermost/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t }),
        }),
        fetch("/api/mattermost/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t }),
        }),
      ]);

      if (!chRes.ok) {
        const { error } = await chRes.json();
        setConfigError(error ?? "Error al conectar");
        setConnecting(false);
        return;
      }

      const { teams: t2 } = await chRes.json();
      setTeams(t2);

      if (usRes.ok) {
        const { users: u, groups: g } = await usRes.json();
        setUsers(u);
        setGroups(g);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t }));
      setStep("browse");
    } catch {
      setConfigError("No se pudo conectar al servidor");
    } finally {
      setConnecting(false);
    }
  }, []);

  // Auto-connect if credentials already saved
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { serverUrl: su, token: t } = JSON.parse(saved);
        if (su && t) {
          loadData(su, t);
        }
      }
    } catch {
      // ignore
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setConfigError("Ingresa tu usuario y contraseña");
      return;
    }
    setConnecting(true);
    setConfigError("");
    try {
      const res = await fetch("/api/mattermost/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfigError(data.error ?? "Error al iniciar sesión");
        return;
      }
      setToken(data.token);
      await loadData(serverUrl.trim(), data.token);
    } catch {
      setConfigError("No se pudo conectar al servidor");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStep("config");
    setToken("");
    setUsername("");
    setPassword("");
    setTeams([]);
    setUsers([]);
    setGroups([]);
    setSelectedId(null);
  };

  const handleSend = async () => {
    if (!selectedId) return;
    setStep("sending");

    const fd = new FormData();
    fd.append("token", token);
    fd.append("channelId", selectedId);
    fd.append("recipientType", selectedType);
    fd.append("message", message);
    fd.append("file", blob, "grabacion.webm");

    try {
      const res = await fetch("/api/mattermost/send", { method: "POST", body: fd });
      if (res.ok) {
        setStep("done");
      } else {
        const { error } = await res.json();
        setErrorMessage(error ?? "Error al enviar");
        setStep("error");
      }
    } catch {
      setErrorMessage("No se pudo conectar al servidor");
      setStep("error");
    }
  };

  // Filtered lists
  const filteredChannels = useMemo(() => {
    const q = search.toLowerCase();
    return teams
      .map((team) => ({
        ...team,
        channels: team.channels.filter((c) => c.name.toLowerCase().includes(q)),
      }))
      .filter((t) => t.channels.length > 0);
  }, [teams, search]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)
    );
  }, [users, search]);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-accent-light" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
            <span className="font-semibold text-text-primary">Enviar por Mattermost</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* Config step */}
          {step === "config" && (
            <form onSubmit={handleConnect} className="flex flex-col gap-4">
              <p className="text-sm text-text-secondary">
                Inicia sesión en Mattermost. La sesión se guardará localmente.
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Usuario</label>
                <input
                  type="text"
                  placeholder="tu.usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-light focus:outline-none"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-light focus:outline-none"
                  required
                />
              </div>
              {configError && (
                <p className="text-sm text-red-400">{configError}</p>
              )}
              <button
                type="submit"
                disabled={connecting}
                className="rounded-lg bg-accent px-6 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {connecting ? "Iniciando sesión…" : "Iniciar sesión"}
              </button>
            </form>
          )}

          {/* Browse step */}
          {step === "browse" && (
            <div className="flex flex-col gap-4">
              {/* Tabs */}
              <div className="flex gap-1 rounded-lg bg-background p-1">
                {(["channels", "users", "groups"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSelectedId(null); setSearch(""); setSelectedType(tab === "users" ? "user" : "channel"); }}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      activeTab === tab
                        ? "bg-surface text-text-primary shadow-sm"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {tab === "channels" ? "Canales" : tab === "users" ? "Mensajes directos" : "Grupos"}
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-light focus:outline-none"
              />

              {/* List */}
              <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
                {activeTab === "channels" && (
                  filteredChannels.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-text-muted">Sin resultados</p>
                  ) : (
                    filteredChannels.map((team) => (
                      <div key={team.id}>
                        <p className="sticky top-0 bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                          {team.name}
                        </p>
                        {team.channels.map((ch) => (
                          <button
                            key={ch.id}
                            onClick={() => { setSelectedId(ch.id); setSelectedType("channel"); }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover ${
                              selectedId === ch.id ? "bg-accent/10 text-accent-light" : "text-text-primary"
                            }`}
                          >
                            <span className="text-text-muted">{ch.type === "P" ? "🔒" : "#"}</span>
                            {ch.name}
                          </button>
                        ))}
                      </div>
                    ))
                  )
                )}

                {activeTab === "users" && (
                  filteredUsers.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-text-muted">Sin resultados</p>
                  ) : (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setSelectedId(u.id); setSelectedType("user"); }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover ${
                          selectedId === u.id ? "bg-accent/10 text-accent-light" : "text-text-primary"
                        }`}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent-light">
                          {u.displayName.charAt(0).toUpperCase()}
                        </span>
                        <span>{u.displayName}</span>
                        <span className="text-xs text-text-muted">@{u.username}</span>
                      </button>
                    ))
                  )
                )}

                {activeTab === "groups" && (
                  filteredGroups.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-text-muted">Sin grupos</p>
                  ) : (
                    filteredGroups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { setSelectedId(g.id); setSelectedType("group"); }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover ${
                          selectedId === g.id ? "bg-accent/10 text-accent-light" : "text-text-primary"
                        }`}
                      >
                        <span className="text-text-muted">👥</span>
                        {g.name}
                      </button>
                    ))
                  )
                )}
              </div>

              {/* Message */}
              <textarea
                placeholder="Mensaje opcional…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-light focus:outline-none"
              />

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleDisconnect}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
                >
                  Cambiar cuenta
                </button>
                <button
                  onClick={handleSend}
                  disabled={!selectedId}
                  className="flex-1 rounded-lg bg-accent px-6 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  Enviar video
                </button>
              </div>
            </div>
          )}

          {/* Sending */}
          {step === "sending" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <svg className="h-8 w-8 animate-spin text-accent-light" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-text-secondary">Subiendo video…</p>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-medium text-text-primary">¡Video enviado!</p>
              <p className="text-sm text-text-secondary">El video fue publicado en Mattermost.</p>
              <button
                onClick={onClose}
                className="rounded-lg bg-accent px-6 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="font-medium text-text-primary">Error al enviar</p>
              <p className="text-sm text-red-400">{errorMessage}</p>
              <button
                onClick={() => setStep("browse")}
                className="rounded-lg border border-border px-6 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
              >
                Volver a intentar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
