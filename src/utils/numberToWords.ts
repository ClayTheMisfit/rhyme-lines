const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'] as const
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const

const wordsBelow100 = (value: number): string => {
  if (value < 10) return ONES[value]
  if (value < 20) return TEENS[value - 10]
  const ten = Math.floor(value / 10)
  const remainder = value % 10
  return remainder ? `${TENS[ten]} ${ONES[remainder]}` : TENS[ten]
}

const wordsBelow1000 = (value: number): string => {
  if (value < 100) return wordsBelow100(value)
  const hundred = Math.floor(value / 100)
  const remainder = value % 100
  return remainder ? `${ONES[hundred]} hundred ${wordsBelow100(remainder)}` : `${ONES[hundred]} hundred`
}

export const numberToWords = (value: number): string => {
  if (value < 1000) return wordsBelow1000(value)
  const thousands = Math.floor(value / 1000)
  const remainder = value % 1000
  const base = `${ONES[thousands]} thousand`
  return remainder ? `${base} ${wordsBelow1000(remainder)}` : base
}
