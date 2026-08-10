// Filter-operator catalogue + the pure helpers that pick which operators
// apply to a column and how they're labelled. Fully static - no grid state -
// so it lives outside the controller.
import type { Column, RowData } from "./index";
import type { FilterOperator, FilterOption } from "./SvGrid.types";

export const filterOperatorOptions: Array<FilterOption> = [
  { value: "contains", label: "Contains", iconName: "op-contains" },
  { value: "notContains", label: "Not contains", iconName: "op-notContains" },
  { value: "equals", label: "Equals", iconName: "op-equals" },
  { value: "notEquals", label: "Not equals", iconName: "op-notEquals" },
  { value: "startsWith", label: "Starts with", iconName: "op-startsWith" },
  { value: "endsWith", label: "Ends with", iconName: "op-endsWith" },
  { value: "regex", label: "Regex", iconName: "op-regex" },
  { value: "in", label: "In", iconName: "op-in" },
  { value: "notIn", label: "Not in", iconName: "op-notIn" },
  { value: "greaterThan", label: "Greater than", iconName: "op-greaterThan" },
  { value: "lessThan", label: "Less than", iconName: "op-lessThan" },
  { value: "between", label: "Between", iconName: "op-between" },
  { value: "isBlank", label: "Blank", iconName: "op-isBlank" },
  { value: "isNotBlank", label: "Not blank", iconName: "op-isNotBlank" },
];
/** Operators whose predicate is a set-membership test over a token list.
 *  The filter row renders a multi-value chip input for these instead of a
 *  single text box. */
export const SET_OPERATORS: ReadonlyArray<FilterOperator> = ["in", "notIn"];
/** Operators that need no value input - they act on emptiness alone. */
export const VALUELESS_OPERATORS: ReadonlyArray<FilterOperator> = [
  "isBlank",
  "isNotBlank",
];
/** Which operators make sense for each column editor type. */
export const TEXT_OPERATORS: Array<FilterOperator> = [
  "contains",
  "notContains",
  "equals",
  "notEquals",
  "startsWith",
  "endsWith",
  "regex",
  "in",
  "notIn",
  "isBlank",
  "isNotBlank",
];
export const NUMBER_OPERATORS: Array<FilterOperator> = [
  "equals",
  "notEquals",
  "greaterThan",
  "lessThan",
  "between",
  "in",
  "notIn",
  "isBlank",
  "isNotBlank",
];
export const DATE_OPERATORS: Array<FilterOperator> = [
  "equals",
  "notEquals",
  "lessThan",
  "greaterThan",
  "between",
  "isBlank",
  "isNotBlank",
];
export const CHECKBOX_OPERATORS: Array<FilterOperator> = [
  "equals",
  "isBlank",
  "isNotBlank",
];
export const fallbackOperatorOption: FilterOption = {
  value: "contains",
  label: "Contains",
  iconName: "op-contains",
};

export function operatorOption(value: FilterOperator): FilterOption {
  return (
    filterOperatorOptions.find((option) => option.value === value) ??
    fallbackOperatorOption
  );
}

/** Returns the operators that make sense for the given column's data type. */
export function operatorsForColumn<TData extends RowData>(
  column: Column<TData> | undefined,
): Array<FilterOption> {
  const editorType = column?.columnDef.editorType ?? "text";
  const ids =
    editorType === "number"
      ? NUMBER_OPERATORS
      : editorType === "date" || editorType === "datetime"
        ? DATE_OPERATORS
        : editorType === "checkbox"
          ? CHECKBOX_OPERATORS
          : TEXT_OPERATORS;
  return ids
    .map((id) => filterOperatorOptions.find((option) => option.value === id))
    .filter((option): option is FilterOption => Boolean(option));
}

/** Default operator for a column (first one valid for its type). */
export function defaultOperatorFor<TData extends RowData>(
  column: Column<TData> | undefined,
): FilterOperator {
  return operatorsForColumn(column)[0]?.value ?? "contains";
}

/** Date columns get friendlier labels for "less / greater than". */
export function operatorLabelFor<TData extends RowData>(
  option: FilterOption,
  column: Column<TData> | undefined,
): string {
  const editorType = column?.columnDef.editorType;
  if (editorType === "date" || editorType === "datetime") {
    if (option.value === "lessThan") return "Before";
    if (option.value === "greaterThan") return "After";
  }
  return option.label;
}

/** GridMessages key for each operator's label (see grid-messages.ts). */
const OPERATOR_MESSAGE_KEY: Record<FilterOperator, string> = {
  contains: "opContains",
  notContains: "opNotContains",
  equals: "opEquals",
  notEquals: "opNotEquals",
  startsWith: "opStartsWith",
  endsWith: "opEndsWith",
  regex: "opRegex",
  in: "opIn",
  notIn: "opNotIn",
  greaterThan: "opGreaterThan",
  lessThan: "opLessThan",
  between: "opBetween",
  isBlank: "opIsBlank",
  isNotBlank: "opIsNotBlank",
};

/**
 * Localized operator label: honors date `Before`/`After` relabels, then the
 * `localeText` override for the operator, falling back to the English
 * `option.label`. `messages` is a loose string map to avoid a type cycle.
 */
export function localizeOperatorLabel<TData extends RowData>(
  option: FilterOption,
  column: Column<TData> | undefined,
  messages?: Record<string, string> | null,
): string {
  const editorType = column?.columnDef.editorType;
  if (editorType === "date" || editorType === "datetime") {
    if (option.value === "lessThan") return messages?.opBefore || "Before";
    if (option.value === "greaterThan") return messages?.opAfter || "After";
  }
  const key = OPERATOR_MESSAGE_KEY[option.value];
  return (key && messages?.[key]) || option.label;
}
