// Short, readable date for cards and comments, e.g. "Nov 16, 2026"
export function readableDate(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date)
}
