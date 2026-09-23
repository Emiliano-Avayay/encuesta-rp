"use client";

import { Lock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "No se pudo iniciar sesion.");
      setLoading(false);
      return;
    }
    router.push("/staff-rp/respuestas");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="w-full border-t-4 border-rp-orange bg-white p-7 shadow-sm">
      <div className="mb-6 flex h-12 w-12 items-center justify-center bg-rp-orange text-white">
        <Lock />
      </div>
      <h1 className="text-3xl font-black uppercase text-rp-graphite">Panel privado RP</h1>
      <p className="mt-2 text-sm font-semibold text-zinc-600">
        Acceso exclusivo para personal autorizado. En modo demo usa admin / admin.
      </p>
      <label className="mt-6 block">
        <span className="field-label">Usuario</span>
        <input className="field-input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
      </label>
      <label className="mt-4 block">
        <span className="field-label">Contrasena</span>
        <input
          className="field-input"
          value={password}
          type="password"
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && <p className="field-error">{error}</p>}
      <button
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-2 bg-rp-orange px-5 py-4 font-black uppercase text-white disabled:bg-zinc-400"
      >
        {loading ? <Loader2 className="animate-spin" /> : <Lock size={18} />}
        Ingresar
      </button>
    </form>
  );
}
