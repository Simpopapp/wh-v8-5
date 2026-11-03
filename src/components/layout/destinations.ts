import type { LucideIcon } from "lucide-react";
import {
  BookMarked,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Headphones,
  Home,
  Mic,
  PenLine,
  Settings,
  Timer,
  TrendingUp,
} from "lucide-react";

/**
 * Fonte única de destinos de navegação (PRD §6.2 / §8): TopNav (desktop)
 * e TabBar (mobile) derivam daqui — nunca listas divergentes.
 */
export interface NavDestination {
  to:
    | "/"
    | "/speaking"
    | "/writing"
    | "/reading"
    | "/listening"
    | "/session"
    | "/exam"
    | "/practice"
    | "/progress"
    | "/vocabulary"
    | "/settings";
  label: string;
  icon: LucideIcon;
}

/**
 * Destinos de primeiro nível no TopNav desktop (projeto 13, §4.4.7): as
 * quatro habilidades ficam agrupadas no menu "Habilidades" (abaixo).
 */
export const TOP_DESTINATIONS: NavDestination[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/practice", label: "Praticar", icon: GraduationCap },
  { to: "/session", label: "Sessão", icon: ClipboardList },
  { to: "/exam", label: "Simulado", icon: Timer },
  { to: "/progress", label: "Progresso", icon: TrendingUp },
  { to: "/vocabulary", label: "Vocabulário", icon: BookMarked },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

/** Grupo "Habilidades" do TopNav: as quatro seções da prova. */
export const SKILL_DESTINATIONS: NavDestination[] = [
  { to: "/speaking", label: "Falar", icon: Mic },
  { to: "/writing", label: "Escrever", icon: PenLine },
  { to: "/reading", label: "Ler", icon: BookOpen },
  { to: "/listening", label: "Ouvir", icon: Headphones },
];

/** Tab bar mobile (D6): 5 destinos primários; o resto fica na Home/desktop. */
export const TABBAR_DESTINATIONS: NavDestination[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/practice", label: "Praticar", icon: GraduationCap },
  { to: "/progress", label: "Progresso", icon: TrendingUp },
  { to: "/vocabulary", label: "Vocabulário", icon: BookMarked },
  { to: "/settings", label: "Ajustes", icon: Settings },
];
