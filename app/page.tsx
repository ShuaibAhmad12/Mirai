import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AuthButton } from "@/components/auth-button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 flex items-center justify-between px-6 border-b bg-background/60 backdrop-blur">
        <Link href="/" className="font-bold text-lg tracking-tight">
          MiraiSetu College Suite
        </Link>
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <AuthButton />
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-purple-600 text-transparent bg-clip-text">
            Unified College Management Platform
          </h1>
          <p className="text-lg text-foreground/70 leading-relaxed">
            Manage colleges, courses, academic sessions, fees, staff and agent
            networks in one secure, role-based dashboard. Streamline operations
            and gain real-time insight.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/sign-up"
              className="px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium shadow hover:opacity-90 transition"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="px-6 py-3 rounded-md border font-medium hover:bg-accent transition"
            >
              Login
            </Link>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-left mt-8">
            {[
              "College & Campus",
              "Course Catalog",
              "Session Scheduling",
              "Fee & Finance",
              "Staff HR",
              "Agent CRM",
            ].map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 rounded-md border bg-card/50 px-3 py-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {f}
              </li>
            ))}
          </ul>
        </div>
      </main>
      <footer className="h-14 flex items-center justify-center text-xs border-t">
        <span className="text-foreground/60">
          © {new Date().getFullYear()} MiraiSetu
        </span>
      </footer>
    </div>
  );
}
