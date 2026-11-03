import { Link } from "@tanstack/react-router";
import { BookA, ClipboardList } from "lucide-react";

import { NAV_DESTINATIONS } from "@/components/layout/destinations";
import { TYPE_COUNT } from "@/lib/pte";

export function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <Link to="/" className="flex min-h-[44px] shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-card"
          >
            <BookA className="size-4.5" strokeWidth={2.25} />
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight">PTE Master Hub</span>
          <span className="hidden rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary lg:inline">
            {TYPE_COUNT} task types
          </span>
        </Link>
        <nav
          aria-label="Navegação principal"
          className="hidden items-center justify-end gap-0.5 md:flex"
        >
          {NAV_DESTINATIONS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              title={label}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{
                className:
                  "bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground",
              }}
            >
              <Icon className="size-4.5" strokeWidth={2} aria-hidden />
              <span className="sr-only">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex min-h-[44px] items-center gap-1 md:hidden">
          <Link
            to="/session"
            aria-label="Sessão de treino"
            className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "bg-primary text-primary-foreground" }}
          >
            <ClipboardList className="size-5" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
