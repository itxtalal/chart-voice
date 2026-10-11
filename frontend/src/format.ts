export const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? 'missing' : n.toLocaleString(undefined, { maximumFractionDigits: 2 })

export const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n))
