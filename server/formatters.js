function parseList(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    return []
  }
}

function maskPhone(phone) {
  const value = String(phone || '')
  if (value.length !== 11) return value
  return `${value.slice(0, 3)}****${value.slice(7)}`
}

module.exports = {
  parseList,
  maskPhone
}
