export const formatPrice = (value?: number | string | null) => {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num.toFixed(2) : '0.00'
}

export const roundPrice = (value?: number | string | null) => {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0
}
