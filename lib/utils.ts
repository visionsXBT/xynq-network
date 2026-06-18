export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatTps(n: number): string {
  return `${n.toFixed(1)} tok/s`;
}

export function formatVram(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(0)} GB` : `${mb} MB`;
}
