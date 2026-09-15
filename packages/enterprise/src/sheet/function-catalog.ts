/**
 * What Insert Function shows for each function: its group, the argument
 * list, and one line on what it does. The engine's table (`FUNCTIONS`) is
 * the source of truth for which names exist; a name missing here is listed
 * with a bare `NAME(...)` and no description rather than left out, so a
 * custom function registered through `withCustomFunctions` appears too.
 */
import { FUNCTIONS } from './functions'
import { SIGNATURES } from './autocomplete'

export type FunctionGroup =
  | 'Math' | 'Statistical' | 'Logical' | 'Information' | 'Text' | 'Date & Time' | 'Lookup & Reference' | 'Other'

export type FunctionInfo = {
  name: string
  group: FunctionGroup
  signature: string
  description: string
}

const CATALOG: Record<string, { group: FunctionGroup; description: string; signature?: string }> = {
  SUM: { group: 'Math', description: 'Adds all the numbers in a range of cells.', signature: 'SUM(number1, [number2], ...)' },
  ABS: { group: 'Math', description: 'Returns the absolute value of a number, a number without its sign.', signature: 'ABS(number)' },
  INT: { group: 'Math', description: 'Rounds a number down to the nearest integer.', signature: 'INT(number)' },
  MOD: { group: 'Math', description: 'Returns the remainder after a number is divided by a divisor.', signature: 'MOD(number, divisor)' },
  POWER: { group: 'Math', description: 'Returns the result of a number raised to a power.', signature: 'POWER(number, power)' },
  SQRT: { group: 'Math', description: 'Returns the square root of a number.', signature: 'SQRT(number)' },
  ROUND: { group: 'Math', description: 'Rounds a number to a specified number of digits.' },
  ROUNDUP: { group: 'Math', description: 'Rounds a number up, away from zero.', signature: 'ROUNDUP(number, digits)' },
  ROUNDDOWN: { group: 'Math', description: 'Rounds a number down, toward zero.', signature: 'ROUNDDOWN(number, digits)' },
  SUMIF: { group: 'Math', description: 'Adds the cells specified by a given condition or criteria.' },
  SUMIFS: { group: 'Math', description: 'Adds the cells specified by a given set of conditions or criteria.' },

  AVERAGE: { group: 'Statistical', description: 'Returns the average (arithmetic mean) of its arguments.', signature: 'AVERAGE(number1, [number2], ...)' },
  AVG: { group: 'Statistical', description: 'The same as AVERAGE.', signature: 'AVG(number1, [number2], ...)' },
  MIN: { group: 'Statistical', description: 'Returns the smallest number in a set of values.', signature: 'MIN(number1, [number2], ...)' },
  MAX: { group: 'Statistical', description: 'Returns the largest value in a set of values.', signature: 'MAX(number1, [number2], ...)' },
  COUNT: { group: 'Statistical', description: 'Counts the number of cells in a range that contain numbers.', signature: 'COUNT(value1, [value2], ...)' },
  COUNTA: { group: 'Statistical', description: 'Counts the number of cells in a range that are not empty.', signature: 'COUNTA(value1, [value2], ...)' },
  COUNTBLANK: { group: 'Statistical', description: 'Counts the number of empty cells in a range.', signature: 'COUNTBLANK(range)' },
  MEDIAN: { group: 'Statistical', description: 'Returns the median, the number in the middle of a set of numbers.', signature: 'MEDIAN(number1, [number2], ...)' },
  STDEV: { group: 'Statistical', description: 'Estimates standard deviation based on a sample.', signature: 'STDEV(number1, [number2], ...)' },
  RANK: { group: 'Statistical', description: 'Returns the rank of a number in a list of numbers.', signature: 'RANK(number, ref, [order])' },
  COUNTIF: { group: 'Statistical', description: 'Counts the number of cells within a range that meet the given condition.' },
  COUNTIFS: { group: 'Statistical', description: 'Counts the number of cells specified by a given set of conditions.' },
  AVERAGEIF: { group: 'Statistical', description: 'Finds the average of the cells specified by a given condition.' },

  IF: { group: 'Logical', description: 'Checks whether a condition is met, and returns one value if TRUE and another if FALSE.' },
  IFS: { group: 'Logical', description: 'Checks whether one or more conditions are met and returns a value corresponding to the first TRUE condition.' },
  IFERROR: { group: 'Logical', description: 'Returns a value you specify if a formula evaluates to an error; otherwise, returns the result of the formula.' },
  IFNA: { group: 'Logical', description: 'Returns the value you specify if the expression resolves to #N/A, otherwise returns the result of the expression.', signature: 'IFNA(value, fallback)' },
  SWITCH: { group: 'Logical', description: 'Evaluates an expression against a list of values and returns the result corresponding to the first matching value.' },
  AND: { group: 'Logical', description: 'Checks whether all arguments are TRUE, and returns TRUE if all arguments are TRUE.', signature: 'AND(logical1, [logical2], ...)' },
  OR: { group: 'Logical', description: 'Checks whether any of the arguments are TRUE, and returns TRUE or FALSE.', signature: 'OR(logical1, [logical2], ...)' },
  NOT: { group: 'Logical', description: 'Changes FALSE to TRUE, or TRUE to FALSE.', signature: 'NOT(logical)' },
  XOR: { group: 'Logical', description: 'Returns a logical exclusive OR of all arguments.', signature: 'XOR(logical1, [logical2], ...)' },

  ISNUMBER: { group: 'Information', description: 'Checks whether a value is a number, and returns TRUE or FALSE.', signature: 'ISNUMBER(value)' },
  ISTEXT: { group: 'Information', description: 'Checks whether a value is text, and returns TRUE or FALSE.', signature: 'ISTEXT(value)' },
  ISLOGICAL: { group: 'Information', description: 'Checks whether a value is a logical value (TRUE or FALSE), and returns TRUE or FALSE.', signature: 'ISLOGICAL(value)' },
  ISBLANK: { group: 'Information', description: 'Checks whether a reference is to an empty cell, and returns TRUE or FALSE.', signature: 'ISBLANK(value)' },

  LEN: { group: 'Text', description: 'Returns the number of characters in a text string.', signature: 'LEN(text)' },
  LEFT: { group: 'Text', description: 'Returns the specified number of characters from the start of a text string.', signature: 'LEFT(text, [count])' },
  RIGHT: { group: 'Text', description: 'Returns the specified number of characters from the end of a text string.', signature: 'RIGHT(text, [count])' },
  MID: { group: 'Text', description: 'Returns the characters from the middle of a text string, given a starting position and length.' },
  UPPER: { group: 'Text', description: 'Converts a text string to all uppercase letters.', signature: 'UPPER(text)' },
  LOWER: { group: 'Text', description: 'Converts all letters in a text string to lowercase.', signature: 'LOWER(text)' },
  TRIM: { group: 'Text', description: 'Removes all spaces from a text string except for single spaces between words.', signature: 'TRIM(text)' },
  CONCAT: { group: 'Text', description: 'Concatenates a list or range of text strings.', signature: 'CONCAT(text1, [text2], ...)' },
  CONCATENATE: { group: 'Text', description: 'Joins several text strings into one text string.', signature: 'CONCATENATE(text1, [text2], ...)' },
  TEXTJOIN: { group: 'Text', description: 'Concatenates a list or range of text strings using a delimiter.' },
  SUBSTITUTE: { group: 'Text', description: 'Replaces existing text with new text in a text string.' },
  FIND: { group: 'Text', description: 'Returns the starting position of one text string within another; case-sensitive.', signature: 'FIND(find, within, [start])' },
  SEARCH: { group: 'Text', description: 'Returns the position of one text string within another; not case-sensitive.', signature: 'SEARCH(find, within, [start])' },
  TEXT: { group: 'Text', description: 'Converts a value to text in a specific number format.' },

  TODAY: { group: 'Date & Time', description: "Returns the current date formatted as a date.", signature: 'TODAY()' },
  NOW: { group: 'Date & Time', description: 'Returns the current date and time formatted as a date and time.', signature: 'NOW()' },
  YEAR: { group: 'Date & Time', description: 'Returns the year of a date, an integer in the range 1900 - 9999.', signature: 'YEAR(date)' },
  MONTH: { group: 'Date & Time', description: 'Returns the month, a number from 1 (January) to 12 (December).', signature: 'MONTH(date)' },
  DAY: { group: 'Date & Time', description: 'Returns the day of the month, a number from 1 to 31.', signature: 'DAY(date)' },
  DATE: { group: 'Date & Time', description: 'Returns the date for a given year, month and day.' },
  EOMONTH: { group: 'Date & Time', description: 'Returns the last day of the month before or after a specified number of months.' },
  DAYS: { group: 'Date & Time', description: 'Returns the number of days between two dates.', signature: 'DAYS(end_date, start_date)' },
  DATEDIF: { group: 'Date & Time', description: 'Calculates the number of days, months or years between two dates.', signature: 'DATEDIF(start_date, end_date, unit)' },

  VLOOKUP: { group: 'Lookup & Reference', description: 'Looks for a value in the leftmost column of a table, and returns a value in the same row from a column you specify.' },
  HLOOKUP: { group: 'Lookup & Reference', description: 'Looks for a value in the top row of a table, and returns a value in the same column from a row you specify.' },
  XLOOKUP: { group: 'Lookup & Reference', description: 'Searches a range for a match and returns the corresponding item from a second range.' },
  INDEX: { group: 'Lookup & Reference', description: 'Returns a value from a range at the intersection of a given row and column.' },
  MATCH: { group: 'Lookup & Reference', description: 'Returns the relative position of an item in a range that matches a specified value.' },
}

/** The IF family is dispatched by the evaluator, not the function table. */
const EVALUATOR_FUNCTIONS = ['IF', 'IFS', 'IFERROR', 'IFNA', 'SWITCH']

export const FUNCTION_GROUPS: ReadonlyArray<FunctionGroup> = [
  'Math', 'Statistical', 'Logical', 'Information', 'Text', 'Date & Time', 'Lookup & Reference', 'Other',
]

/** Every function the engine knows, described, alphabetical. */
export function functionCatalog(): FunctionInfo[] {
  const names = new Set<string>([...Object.keys(FUNCTIONS), ...EVALUATOR_FUNCTIONS])
  return [...names].sort().map((name) => {
    const entry = CATALOG[name]
    return {
      name,
      group: entry?.group ?? 'Other',
      signature: entry?.signature ?? SIGNATURES[name] ?? `${name}(...)`,
      description: entry?.description ?? '',
    }
  })
}
