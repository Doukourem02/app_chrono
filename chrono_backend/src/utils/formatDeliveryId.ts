const PREFIX = 'CHLV'
const PREFIX_SEPARATOR = '–'

const sanitizeId = (value?: string) => {
  if (!value) return '0000'
  const clean = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (clean.length >= 4) return clean.slice(-4)
  return clean.padEnd(4, '0')
}

const formatDatePart = (input?: string | Date | null) => {
  let date: Date
  if (!input) {
    date = new Date()
  } else if (input instanceof Date) {
    date = input
  } else {
    const parsed = new Date(input)
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed
    } else {
      const parts = input.split(/[\/\-]/)
      if (parts.length === 3) {
        const [first, second, third] = parts
        if (first.length === 4) {
          date = new Date(`${first}-${second}-${third}`)
        } else {
          date = new Date(`${third}-${second}-${first}`)
        }
      } else {
        date = new Date()
      }
    }
  }

  const yy = date.getFullYear().toString().slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

export const formatDeliveryId = (rawId?: string, createdAt?: string | Date | null) => {
  const datePart = formatDatePart(createdAt)
  const suffix = sanitizeId(rawId)
  return `${PREFIX}${PREFIX_SEPARATOR}${datePart}-${suffix}`
}

export default formatDeliveryId

