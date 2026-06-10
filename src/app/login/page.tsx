"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RedstoneMark } from "@/components/RedstoneLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = searchParams.get("from");
  const redirectTo = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Sign in failed");
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8">
        <RedstoneMark size={40} className="mb-4" />
        <h1 className="text-2xl font-normal text-primary tracking-tight">
          Sign in to Redstone
        </h1>
        <p className="text-sm text-secondary mt-2 text-center">
          Your session stays signed in on this browser.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="composer-surface rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <label className="block space-y-1.5">
          <span className="text-sm text-secondary">Username</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl bg-surface-muted border border-theme px-3 py-2.5 text-primary outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-secondary">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-surface-muted border border-theme px-3 py-2.5 text-primary outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl btn-send py-2.5 font-medium disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10 bg-base">
      <Suspense fallback={<div className="text-secondary text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
