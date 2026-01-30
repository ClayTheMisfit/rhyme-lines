const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

const twoDigitWords = (n: number) => {
  if (n < 10) return ONES[n]
  if (n < 20) return TEENS[n - 10]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens]
}

const threeDigitWords = (n: number) => {
  if (n < 100) return twoDigitWords(n)
  const hundreds = Math.floor(n / 100)
  const remainder = n % 100
  const parts = [`${ONES[hundreds]} hundred`]
  if (remainder) {
    parts.push(twoDigitWords(remainder))
  }
  return parts.join(' ')
}

export function numberToWords(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 9999) return String(n)
  if (n === 0) return 'zero'
  if (n < 1000) return threeDigitWords(n)
  const thousands = Math.floor(n / 1000)
  const remainder = n % 1000
  const parts = [`${ONES[thousands]} thousand`]
  if (remainder) {
    parts.push(threeDigitWords(remainder))
  }
  return parts.join(' ')
}
