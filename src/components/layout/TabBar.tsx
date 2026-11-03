import { Link } from "@tanstack/react-router";

import { TABBAR_DESTINATIONS } from "@/components/layout/destinations";

/**
 * Barra de destinos fixa no rodapé (mobile <640px — PRD §6.2, D6).
 * Renderizada junto do TopNav (mesmo ponto de montagem em todas as rotas);
 * o body reserva o espaço via styles.css.
 */
export function TabBar() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {TABBAR_DESTINATIONS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            aria-label={label}
            className="m-1 flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-full px-1 pt-1 text-[10px] font-medium text-muted-foreground transition-[transform,opacity] duration-200 hover:text-foreground motion-reduce:transition-none active:scale-95"
            activeProps={{
              className: "bg-primary/10 font-semibold text-primary",
              "aria-current": "page" as const,
            }}
          >
            <Icon className="size-5" strokeWidth={2} aria-hidden />
            <span className="leading-none">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
