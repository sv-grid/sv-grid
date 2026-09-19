/**
 * What Insert Function shows for each function: its group, the argument
 * list, and one line on what it does. The engine's table (`FUNCTIONS`) is
 * the source of truth for which names exist; a name missing here is listed
 * with a bare `NAME(...)` and no description rather than left out, so a
 * custom function registered through `withCustomFunctions` appears too.
 */
import { FUNCTIONS } from './functions'
import { ARRAY_FUNCTIONS } from './packs/array'
import { SIGNATURES } from './autocomplete'

export type FunctionGroup =
  | 'Financial' | 'Math' | 'Statistical' | 'Logical' | 'Information' | 'Text' | 'Date & Time' | 'Lookup & Reference' | 'Other'

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
  HYPERLINK: { group: 'Lookup & Reference', description: 'Shows the friendly name and follows the link when the cell is clicked.', signature: 'HYPERLINK(link, [friendly_name])' },
  LET: { group: 'Lookup & Reference', description: 'Names a value inside a formula, then uses it in the calculation.', signature: 'LET(name1, value1, [name2, value2], ..., calculation)' },
  LAMBDA: { group: 'Lookup & Reference', description: 'A function written in the sheet: its parameters, then what it works out.', signature: 'LAMBDA(parameter1, ..., calculation)' },
  MAP: { group: 'Lookup & Reference', description: 'Puts every cell of an array through a LAMBDA.', signature: 'MAP(array1, ..., lambda)' },
  BYROW: { group: 'Lookup & Reference', description: 'One answer per row of an array, as a column.', signature: 'BYROW(array, lambda)' },
  BYCOL: { group: 'Lookup & Reference', description: 'One answer per column of an array, as a row.', signature: 'BYCOL(array, lambda)' },
  REDUCE: { group: 'Lookup & Reference', description: 'Folds an array to one value, carrying an accumulator.', signature: 'REDUCE(initial, array, lambda)' },
  SCAN: { group: 'Lookup & Reference', description: 'Folds an array and keeps every step, as a running total does.', signature: 'SCAN(initial, array, lambda)' },
  MAKEARRAY: { group: 'Lookup & Reference', description: 'Builds an array of the given size from the row and column numbers.', signature: 'MAKEARRAY(rows, columns, lambda)' },

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

  PMT: { group: 'Financial', description: 'Calculates the payment for a loan based on constant payments and a constant interest rate.', signature: 'PMT(rate, nper, pv, [fv], [type])' },
  IPMT: { group: 'Financial', description: 'Returns the interest payment for a given period of an investment, based on periodic, constant payments and a constant interest rate.', signature: 'IPMT(rate, per, nper, pv, [fv], [type])' },
  PPMT: { group: 'Financial', description: 'Returns the payment on the principal for a given period of an investment.', signature: 'PPMT(rate, per, nper, pv, [fv], [type])' },
  PV: { group: 'Financial', description: 'Returns the present value of an investment: the total amount that a series of future payments is worth now.', signature: 'PV(rate, nper, pmt, [fv], [type])' },
  FV: { group: 'Financial', description: 'Returns the future value of an investment based on periodic, constant payments and a constant interest rate.', signature: 'FV(rate, nper, pmt, [pv], [type])' },
  NPER: { group: 'Financial', description: 'Returns the number of periods for an investment based on periodic, constant payments and a constant interest rate.', signature: 'NPER(rate, pmt, pv, [fv], [type])' },
  RATE: { group: 'Financial', description: 'Returns the interest rate per period of a loan or an investment.', signature: 'RATE(nper, pmt, pv, [fv], [type], [guess])' },
  NPV: { group: 'Financial', description: 'Returns the net present value of an investment based on a discount rate and a series of future payments (negative values) and income (positive values).', signature: 'NPV(rate, value1, [value2], ...)' },
  IRR: { group: 'Financial', description: 'Returns the internal rate of return for a series of cash flows.', signature: 'IRR(values, [guess])' },
  SLN: { group: 'Financial', description: 'Returns the straight-line depreciation of an asset for one period.', signature: 'SLN(cost, salvage, life)' },

  PRODUCT: { group: 'Math', description: 'Multiplies all the numbers given as arguments.', signature: 'PRODUCT(number1, [number2], ...)' },
  SUMSQ: { group: 'Math', description: 'Returns the sum of the squares of the arguments.', signature: 'SUMSQ(number1, [number2], ...)' },
  SUMPRODUCT: { group: 'Math', description: 'Returns the sum of the products of corresponding ranges or arrays.', signature: 'SUMPRODUCT(array1, [array2], ...)' },
  CEILING: { group: 'Math', description: 'Rounds a number up, away from zero, to the nearest multiple of significance.', signature: 'CEILING(number, significance)' },
  'CEILING.MATH': { group: 'Math', description: 'Rounds a number up to the nearest integer or to the nearest multiple of significance.', signature: 'CEILING.MATH(number, [significance], [mode])' },
  FLOOR: { group: 'Math', description: 'Rounds a number down, toward zero, to the nearest multiple of significance.', signature: 'FLOOR(number, significance)' },
  'FLOOR.MATH': { group: 'Math', description: 'Rounds a number down to the nearest integer or to the nearest multiple of significance.', signature: 'FLOOR.MATH(number, [significance], [mode])' },
  MROUND: { group: 'Math', description: 'Returns a number rounded to the desired multiple.', signature: 'MROUND(number, multiple)' },
  TRUNC: { group: 'Math', description: 'Truncates a number to an integer by removing the decimal, or fractional, part of the number.', signature: 'TRUNC(number, [digits])' },
  LOG: { group: 'Math', description: 'Returns the logarithm of a number to the base you specify.', signature: 'LOG(number, [base])' },
  LOG10: { group: 'Math', description: 'Returns the base-10 logarithm of a number.', signature: 'LOG10(number)' },
  LN: { group: 'Math', description: 'Returns the natural logarithm of a number.', signature: 'LN(number)' },
  EXP: { group: 'Math', description: 'Returns e raised to the power of a given number.', signature: 'EXP(number)' },
  PI: { group: 'Math', description: 'Returns the value of pi, 3.14159265358979, accurate to 15 digits.', signature: 'PI()' },
  RAND: { group: 'Math', description: 'Returns a random number greater than or equal to 0 and less than 1, evenly distributed. Changes on recalculation.', signature: 'RAND()' },
  RANDBETWEEN: { group: 'Math', description: 'Returns a random number between the numbers you specify.', signature: 'RANDBETWEEN(bottom, top)' },
  SIGN: { group: 'Math', description: 'Returns the sign of a number: 1 if the number is positive, zero if the number is 0, or -1 if the number is negative.', signature: 'SIGN(number)' },
  EVEN: { group: 'Math', description: 'Rounds a positive number up and a negative number down to the nearest even integer.', signature: 'EVEN(number)' },
  ODD: { group: 'Math', description: 'Rounds a positive number up and a negative number down to the nearest odd integer.', signature: 'ODD(number)' },
  QUOTIENT: { group: 'Math', description: 'Returns the integer portion of a division.', signature: 'QUOTIENT(numerator, denominator)' },
  GCD: { group: 'Math', description: 'Returns the greatest common divisor.', signature: 'GCD(number1, [number2], ...)' },
  LCM: { group: 'Math', description: 'Returns the least common multiple.', signature: 'LCM(number1, [number2], ...)' },
  FACT: { group: 'Math', description: 'Returns the factorial of a number, equal to 1*2*3*...*number.', signature: 'FACT(number)' },

  LARGE: { group: 'Statistical', description: 'Returns the k-th largest value in a data set.', signature: 'LARGE(range, k)' },
  SMALL: { group: 'Statistical', description: 'Returns the k-th smallest value in a data set.', signature: 'SMALL(range, k)' },
  PERCENTILE: { group: 'Statistical', description: 'Returns the k-th percentile of values in a range.', signature: 'PERCENTILE(range, k)' },
  'PERCENTILE.INC': { group: 'Statistical', description: 'Returns the k-th percentile of values in a range, where k is in the range 0..1, inclusive.', signature: 'PERCENTILE.INC(range, k)' },
  'PERCENTILE.EXC': { group: 'Statistical', description: 'Returns the k-th percentile of values in a range, where k is in the range 0..1, exclusive.', signature: 'PERCENTILE.EXC(range, k)' },
  QUARTILE: { group: 'Statistical', description: 'Returns the quartile of a data set.', signature: 'QUARTILE(range, quart)' },
  'QUARTILE.INC': { group: 'Statistical', description: 'Returns the quartile of a data set, based on percentile values from 0..1, inclusive.', signature: 'QUARTILE.INC(range, quart)' },
  'QUARTILE.EXC': { group: 'Statistical', description: 'Returns the quartile of a data set, based on percentile values from 0..1, exclusive.', signature: 'QUARTILE.EXC(range, quart)' },
  VAR: { group: 'Statistical', description: 'Estimates variance based on a sample.', signature: 'VAR(number1, [number2], ...)' },
  'VAR.S': { group: 'Statistical', description: 'Estimates variance based on a sample.', signature: 'VAR.S(number1, [number2], ...)' },
  'VAR.P': { group: 'Statistical', description: 'Calculates variance based on the entire population.', signature: 'VAR.P(number1, [number2], ...)' },
  VARP: { group: 'Statistical', description: 'Calculates variance based on the entire population.', signature: 'VARP(number1, [number2], ...)' },
  'STDEV.S': { group: 'Statistical', description: 'Estimates standard deviation based on a sample.', signature: 'STDEV.S(number1, [number2], ...)' },
  'STDEV.P': { group: 'Statistical', description: 'Calculates standard deviation based on the entire population.', signature: 'STDEV.P(number1, [number2], ...)' },
  STDEVP: { group: 'Statistical', description: 'Calculates standard deviation based on the entire population.', signature: 'STDEVP(number1, [number2], ...)' },
  MODE: { group: 'Statistical', description: 'Returns the most frequently occurring, or repetitive, value in a range of data.', signature: 'MODE(number1, [number2], ...)' },
  'MODE.SNGL': { group: 'Statistical', description: 'Returns the most frequently occurring, or repetitive, value in a range of data.', signature: 'MODE.SNGL(number1, [number2], ...)' },
  GEOMEAN: { group: 'Statistical', description: 'Returns the geometric mean of a range of positive numeric data.', signature: 'GEOMEAN(number1, [number2], ...)' },
  AVERAGEIFS: { group: 'Statistical', description: 'Finds the average of the cells specified by a given set of conditions or criteria.', signature: 'AVERAGEIFS(avgRange, range, criterion, ...)' },
  MAXIFS: { group: 'Statistical', description: 'Returns the maximum value among cells specified by a given set of conditions or criteria.', signature: 'MAXIFS(maxRange, range, criterion, ...)' },
  MINIFS: { group: 'Statistical', description: 'Returns the minimum value among cells specified by a given set of conditions or criteria.', signature: 'MINIFS(minRange, range, criterion, ...)' },
  CORREL: { group: 'Statistical', description: 'Returns the correlation coefficient between two data sets.', signature: 'CORREL(range1, range2)' },
  SLOPE: { group: 'Statistical', description: 'Returns the slope of the linear regression line through the given data points.', signature: 'SLOPE(known_ys, known_xs)' },
  INTERCEPT: { group: 'Statistical', description: 'Calculates the point at which a line will intersect the y-axis by using a best-fit regression line.', signature: 'INTERCEPT(known_ys, known_xs)' },
  FORECAST: { group: 'Statistical', description: 'Calculates, or predicts, a future value along a linear trend by using existing values.', signature: 'FORECAST(x, known_ys, known_xs)' },
  'FORECAST.LINEAR': { group: 'Statistical', description: 'Calculates, or predicts, a future value along a linear trend by using existing values.', signature: 'FORECAST.LINEAR(x, known_ys, known_xs)' },

  ISERROR: { group: 'Information', description: 'Checks whether a value is an error, and returns TRUE or FALSE.', signature: 'ISERROR(value)' },
  ISERR: { group: 'Information', description: 'Checks whether a value is an error other than #N/A, and returns TRUE or FALSE.', signature: 'ISERR(value)' },
  ISNA: { group: 'Information', description: 'Checks whether a value is #N/A, and returns TRUE or FALSE.', signature: 'ISNA(value)' },
  NA: { group: 'Information', description: 'Returns the error value #N/A, which means a value is not available.', signature: 'NA()' },
  ISNONTEXT: { group: 'Information', description: 'Checks whether a value is not text (blank cells are not text), and returns TRUE or FALSE.', signature: 'ISNONTEXT(value)' },
  ISEVEN: { group: 'Information', description: 'Returns TRUE if the number is even.', signature: 'ISEVEN(number)' },
  ISODD: { group: 'Information', description: 'Returns TRUE if the number is odd.', signature: 'ISODD(number)' },
  N: { group: 'Information', description: 'Converts a value to a number: a number stays, TRUE is 1, anything else is 0.', signature: 'N(value)' },
  T: { group: 'Text', description: 'Returns the text referred to by value; anything that is not text is an empty string.', signature: 'T(value)' },

  PROPER: { group: 'Text', description: 'Converts a text string to proper case: the first letter in each word to uppercase, and all other letters to lowercase.', signature: 'PROPER(text)' },
  REPT: { group: 'Text', description: 'Repeats text a given number of times.', signature: 'REPT(text, count)' },
  VALUE: { group: 'Text', description: 'Converts a text string that represents a number to a number.', signature: 'VALUE(text)' },
  IMAGE: { group: 'Lookup & Reference', description: 'Puts a picture in the cell, from a web address or a data URL.', signature: 'IMAGE(source, [alt_text])' },
  NUMBERVALUE: { group: 'Text', description: 'Converts text to a number, with the decimal and group separators given rather than guessed.', signature: 'NUMBERVALUE(text, [decimal_separator], [group_separator])' },
  CHAR: { group: 'Text', description: 'Returns the character specified by the code number.', signature: 'CHAR(number)' },
  CODE: { group: 'Text', description: 'Returns a numeric code for the first character in a text string.', signature: 'CODE(text)' },
  UNICHAR: { group: 'Text', description: 'Returns the Unicode character referenced by the given numeric value.', signature: 'UNICHAR(number)' },
  UNICODE: { group: 'Text', description: 'Returns the number (code point) corresponding to the first character of the text.', signature: 'UNICODE(text)' },
  EXACT: { group: 'Text', description: 'Checks whether two text strings are exactly the same, and returns TRUE or FALSE. Case-sensitive.', signature: 'EXACT(text1, text2)' },
  CLEAN: { group: 'Text', description: 'Removes all nonprintable characters from text.', signature: 'CLEAN(text)' },
  REPLACE: { group: 'Text', description: 'Replaces part of a text string with a different text string.', signature: 'REPLACE(old_text, start, count, new_text)' },

  WEEKDAY: { group: 'Date & Time', description: 'Returns a number from 1 to 7 identifying the day of the week of a date.', signature: 'WEEKDAY(date, [type])' },
  EDATE: { group: 'Date & Time', description: 'Returns the date that is the indicated number of months before or after the start date.', signature: 'EDATE(date, months)' },
  NETWORKDAYS: { group: 'Date & Time', description: 'Returns the number of whole workdays between two dates.', signature: 'NETWORKDAYS(start_date, end_date, [holidays])' },
  WORKDAY: { group: 'Date & Time', description: 'Returns the date before or after a specified number of workdays.', signature: 'WORKDAY(start_date, days, [holidays])' },
  WEEKNUM: { group: 'Date & Time', description: 'Returns the week number in the year.', signature: 'WEEKNUM(date, [type])' },
  HOUR: { group: 'Date & Time', description: 'Returns the hour as a number from 0 (12:00 A.M.) to 23 (11:00 P.M.).', signature: 'HOUR(time)' },
  MINUTE: { group: 'Date & Time', description: 'Returns the minute, a number from 0 to 59.', signature: 'MINUTE(time)' },
  SECOND: { group: 'Date & Time', description: 'Returns the second, a number from 0 to 59.', signature: 'SECOND(time)' },
  TIME: { group: 'Date & Time', description: 'Converts hours, minutes and seconds given as numbers to a time serial number.', signature: 'TIME(hour, minute, second)' },
  DATEVALUE: { group: 'Date & Time', description: 'Converts a date in the form of text to a serial number.', signature: 'DATEVALUE(text)' },
  TIMEVALUE: { group: 'Date & Time', description: 'Converts a time in the form of text to a serial number.', signature: 'TIMEVALUE(text)' },
  DAYS360: { group: 'Date & Time', description: 'Calculates the number of days between two dates based on a 360-day year.', signature: 'DAYS360(start_date, end_date)' },
  YEARFRAC: { group: 'Date & Time', description: 'Returns the year fraction representing the number of whole days between two dates.', signature: 'YEARFRAC(start_date, end_date, [basis])' },

  ROW: { group: 'Lookup & Reference', description: 'Returns the row number of a reference, or of the cell the formula is in.', signature: 'ROW([reference])' },
  COLUMN: { group: 'Lookup & Reference', description: 'Returns the column number of a reference, or of the cell the formula is in.', signature: 'COLUMN([reference])' },
  ADDRESS: { group: 'Lookup & Reference', description: 'Creates a cell reference as text, given specified row and column numbers.', signature: 'ADDRESS(row, column, [abs], [a1], [sheet])' },
  OFFSET: { group: 'Lookup & Reference', description: 'Returns a reference to a range that is a given number of rows and columns from a given reference. Volatile.', signature: 'OFFSET(reference, rows, cols, [height], [width])' },
  INDIRECT: { group: 'Lookup & Reference', description: 'Returns the reference specified by a text string. Volatile.', signature: 'INDIRECT(text, [a1])' },
  CHOOSE: { group: 'Lookup & Reference', description: 'Chooses a value from a list of values, based on an index number.', signature: 'CHOOSE(index, value1, [value2], ...)' },
  ROWS: { group: 'Lookup & Reference', description: 'Returns the number of rows in a range.', signature: 'ROWS(range)' },
  COLUMNS: { group: 'Lookup & Reference', description: 'Returns the number of columns in a range.', signature: 'COLUMNS(range)' },
  FILTER: { group: 'Lookup & Reference', description: 'Filters a range or array by a condition. Spills the rows that match.', signature: 'FILTER(array, include, [if_empty])' },
  UNIQUE: { group: 'Lookup & Reference', description: 'Returns the unique values from a range or array. Spills.', signature: 'UNIQUE(array, [by_col], [exactly_once])' },
  SORT: { group: 'Lookup & Reference', description: 'Sorts a range or array by one of its columns. Spills.', signature: 'SORT(array, [sort_index], [sort_order], [by_col])' },
  SORTBY: { group: 'Lookup & Reference', description: 'Sorts a range or array by the values in another range or array. Spills.', signature: 'SORTBY(array, by_array1, [sort_order1], ...)' },
  SEQUENCE: { group: 'Math', description: 'Generates a list of sequential numbers in an array. Spills.', signature: 'SEQUENCE(rows, [columns], [start], [step])' },
  TRANSPOSE: { group: 'Lookup & Reference', description: 'Converts a vertical range into a horizontal one, or the reverse. Spills.', signature: 'TRANSPOSE(array)' },
  TEXTSPLIT: { group: 'Text', description: 'Splits text into columns and rows by delimiters. Spills.', signature: 'TEXTSPLIT(text, col_delimiter, [row_delimiter], [ignore_empty])' },
}

/** The IF family is dispatched by the evaluator, not the function table. */
const EVALUATOR_FUNCTIONS = ['IF', 'IFS', 'IFERROR', 'IFNA', 'SWITCH', 'ISERROR', 'ISERR', 'ISNA', 'ROW', 'COLUMN', 'ADDRESS', 'OFFSET', 'INDIRECT']

export const FUNCTION_GROUPS: ReadonlyArray<FunctionGroup> = [
  'Financial', 'Math', 'Statistical', 'Logical', 'Information', 'Text', 'Date & Time', 'Lookup & Reference', 'Other',
]

/** Every function the engine knows, described, alphabetical. */
export function functionCatalog(): FunctionInfo[] {
  const names = new Set<string>([...Object.keys(FUNCTIONS), ...Object.keys(ARRAY_FUNCTIONS), ...EVALUATOR_FUNCTIONS])
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
