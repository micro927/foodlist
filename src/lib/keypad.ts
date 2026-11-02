// The amount keypad is a small calculator: "1200+450×2" works out to 2100 as you type. Amounts are whole yen.

export const operators = ['÷', '×', '−', '+'] as const
export type Operator = (typeof operators)[number]

export const isOperator = (c: string): c is Operator => (operators as readonly string[]).includes(c)

/** The expression after pressing `key` (a digit, "00", an operator, "⌫" or "C"). */
export function press(expression: string, key: string): string {
  if (key === 'C') return ''
  if (key === '⌫') return expression.slice(0, -1)
  const last = expression.at(-1) ?? ''
  if (isOperator(key)) {
    if (!expression) return expression
    // A second operator in a row replaces the first.
    return isOperator(last) ? expression.slice(0, -1) + key : expression + key
  }
  const number = expression.split(/[+−×÷]/).at(-1) ?? ''
  // No leading zeros, and no silly lengths.
  if (number === '0') return key === '0' || key === '00' ? expression : expression.slice(0, -1) + key
  if (!number && key === '00') return expression + '0'
  if (number.length >= 8) return expression
  return expression + key
}

/** The value of the expression in whole yen, or `null` when there's nothing to work out. Multiplication and division first. */
export function evaluate(expression: string): number | null {
  const tokens = expression.match(/\d+|[+−×÷]/g)
  if (!tokens) return null
  if (isOperator(tokens.at(-1)!)) tokens.pop()
  const terms: number[] = [Number(tokens[0])]
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as Operator
    const n = Number(tokens[i + 1])
    if (op === '×') terms.push(terms.pop()! * n)
    else if (op === '÷') terms.push(n === 0 ? NaN : terms.pop()! / n)
    else terms.push(op === '+' ? n : -n)
  }
  const value = terms.reduce((a, b) => a + b, 0)
  return Number.isFinite(value) ? Math.round(value) : null
}

