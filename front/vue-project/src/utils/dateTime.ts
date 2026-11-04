export const formatDateTime = (value: string | number | Date | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-'

  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return '-'
    const localDateTime = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/)
    if (localDateTime) return `${localDateTime[1]} ${localDateTime[2]}`
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  const pad = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
