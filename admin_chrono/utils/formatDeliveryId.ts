const PREFIX = 'CHLV'
const PREFIX_SEPARATOR = '–' // en dash

function normalizeDate(input?: string | Date | null): Date {
  if (!input) {
    return new Date()
  }

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? new Date() : input
  }

  const parsed = new Date(input)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed
  }

  // Essayer de parser les dates au format dd/mm/yyyy
  const parts = input.split(/[\/\-]/)
  if (parts.length === 3) {
    const [first, second, third] = parts.map((part) => part.trim())
    // Si l'année est en premier (ISO court) on laisse Date gérer
    if (first.length === 4) {
      const fallback = new Date(`${first}-${second}-${third}`)
      if (!Number.isNaN(fallback.getTime())) {
        return fallback
      }
    } else {
      // Considérer le format dd/mm/yyyy
      const iso = `${third}-${second}-${first}`
      const fallback = new Date(iso)
      if (!Number.isNaN(fallback.getTime())) {
        return fallback
      }
    }
  }

  return new Date()
}

function formatDatePart(date: Date): string {
  const yy = date.getFullYear().toString().slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

function formatSuffix(rawId?: string): string {
  if (!rawId) {
    return '0000'
  }

  const clean = rawId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (clean.length >= 4) {
    return clean.slice(-4)
  }

  return clean.padEnd(4, '0')
}

export function formatDeliveryId(rawId?: string, createdAt?: string | Date | null): string {
  const date = normalizeDate(createdAt)
  const datePart = formatDatePart(date)
  const suffix = formatSuffix(rawId)
  return `${PREFIX}${PREFIX_SEPARATOR}${datePart}-${suffix}`
}

export default formatDeliveryId

