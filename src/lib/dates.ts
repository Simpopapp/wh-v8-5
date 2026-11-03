// Utilidades de data local (sem passo fixo de 24 h — iteração por CHAVE de dia).
// Corrige o achado A5 do projeto 9: streak e médias diárias agora andam de dia
// em dia no calendário local, imunes a mudança de offset (horário de verão).

/** Chave local "YYYY-MM-DD" do instante dado. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Meia-noite local da chave "YYYY-MM-DD" (null se inválida). */
export function keyToMidnight(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number) as unknown as [string, number, number, number];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt.getTime();
}

/** Chave do dia deslocado em `delta` dias no calendário local (delta negativo = passado). */
export function shiftDayKey(key: string, delta: number): string {
  const midnight = keyToMidnight(key);
  if (midnight === null) return key;
  const d = new Date(midnight);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta).getTime());
}

/** Lista as chaves dos últimos `days` dias, da mais antiga para a mais recente. */
export function lastDayKeys(days: number, now = Date.now()): string[] {
  const today = dayKey(now);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(shiftDayKey(today, -i));
  return out;
}

/** true se `a` é estritamente anterior a `b` (chaves válidas). */
export function isBeforeDayKey(a: string, b: string): boolean {
  const ta = keyToMidnight(a);
  const tb = keyToMidnight(b);
  if (ta === null || tb === null) return false;
  return ta < tb;
}
