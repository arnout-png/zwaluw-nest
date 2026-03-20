"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ZwaluwLogo } from "@/components/zwaluw-logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Er is een fout opgetreden.");
        return;
      }

      // Redirect based on role
      const roleRoutes: Record<string, string> = {
        ADMIN: "/dashboard",
        PLANNER: "/dashboard/agenda",
        ADVISEUR: "/dashboard/mijn-agenda",
        MONTEUR: "/dashboard/mijn-werk",
        CALLCENTER: "/dashboard",
        BACKOFFICE: "/dashboard",
        WAREHOUSE: "/dashboard",
      };

      router.push(roleRoutes[data.user.role] || "/dashboard");
    } catch {
      setError("Kan geen verbinding maken met de server.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-gradient relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Ambient glow effects */}
      <div className="login-glow -top-20 -left-20" />
      <div
        className="login-glow -right-20 -bottom-20"
        style={{ animationDelay: "3s" }}
      />

      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(104,176,166,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(104,176,166,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Login card */}
      <div className="fade-in glass-card relative z-10 w-full max-w-md rounded-2xl p-8 shadow-2xl sm:p-10">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <ZwaluwLogo className="h-16 w-16" />
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              ZwaluwNest
            </h1>
            <p className="mt-1 font-mono text-xs tracking-widest text-zwaluw-teal uppercase">
              HR & Operations Portal
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-zwaluw-border" />
          <span className="text-xs text-muted">Inloggen</span>
          <div className="h-px flex-1 bg-zwaluw-border" />
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-zwaluw-sage"
            >
              E-mailadres
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-5 w-5 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="naam@veiligdouchen.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-focus-ring w-full rounded-lg border border-zwaluw-border bg-zwaluw-charcoal py-3 pl-10 pr-4 text-sm text-white placeholder-muted transition-all duration-200"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-zwaluw-sage"
            >
              Wachtwoord
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-5 w-5 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="Voer je wachtwoord in"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-focus-ring w-full rounded-lg border border-zwaluw-border bg-zwaluw-charcoal py-3 pl-10 pr-12 text-sm text-white placeholder-muted transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted transition-colors hover:text-zwaluw-sage"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-shimmer flex w-full items-center justify-center gap-2 rounded-lg bg-zwaluw-teal px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-zwaluw-teal-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Bezig met inloggen...
              </>
            ) : (
              "Inloggen"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 border-t border-zwaluw-border pt-6">
          <p className="text-center text-xs text-muted">
            Problemen met inloggen?{" "}
            <span className="cursor-pointer text-zwaluw-teal transition-colors hover:text-zwaluw-teal-light">
              Neem contact op met de beheerder
            </span>
          </p>
        </div>

        {/* Branding footer */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-muted/50">
          <span>Veilig Douchen</span>
          <span>&middot;</span>
          <span>ZwaluwNest v1.0</span>
        </div>
      </div>
    </div>
  );
}
