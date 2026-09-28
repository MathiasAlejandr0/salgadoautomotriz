"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/layout/Logo";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Demo: permitir entrar sin Supabase
        if (data.demo) {
          router.push("/admin");
          return;
        }
        setError(data.error || "Credenciales inválidas");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050a14] p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c2138] p-8 shadow-xl">
        <div className="flex justify-center mb-6">
          <Logo height={64} />
        </div>
        <h1 className="text-xl font-black text-white text-center mb-1">Panel Admin</h1>
        <p className="text-sm text-[#94A3B8] text-center mb-6">
          Ingresa con tu cuenta de Supabase Auth
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="admin@salgadoautomotriz.cl"
            />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1.5">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#00BCFE] py-3 font-bold text-[#041018] hover:bg-[#33cfff] disabled:opacity-60"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        <p className="text-[11px] text-[#94A3B8] text-center mt-4">
          Sin Supabase: el panel demo solo abre en desarrollo o con{" "}
          <code className="text-[#00BCFE]">ALLOW_DEMO_MODE=true</code>.
        </p>
      </div>
    </div>
  );
}
