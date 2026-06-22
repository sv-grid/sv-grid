// Filter-operator catalogue + the pure helpers that pick which operators
// apply to a column and how they're labelled. Fully static - no grid state -
// so it lives outside the controller.
import type { Column, RowData } from "./index";
import type { FilterOperator, FilterOption } from "./SvGrid.types";

export const filterOperatorOptions: Array<FilterOption> = [
  { value: "contains", label: "Contains", iconName: "op-contains" },
  { value: "equals", label: "Equals", iconName: "op-equals" },
  { value: "startsWith", label: "Starts with", iconName: "op-startsWith" },
  { value: "greaterThan", label: "Greater than", iconName: "op-greaterThan" },
  { value: "lessThan", label: "Less than", iconName: "op-lessThan" },
  { value: "between", label: "Between", iconName: "op-between" },
  { value: "isBlank", label: "Is blank", iconName: "op-isBlank" },
];
/** Which operators make sense for each column editor type. */
export const TEXT_OPERATORS: Array<FilterOperator> = [
  "contains",
  "equals",
  "startsWith",
  "isBlank",
];
export const NUMBER_OPERATORS: Array<FilterOperator> = [
  "equals",
  "greaterThan",
  "lessThan",
  "between",
  "isBlank",
];
export const DATE_OPERATORS: Array<FilterOperator> = [
  "equals",
  "lessThan",
  "greaterThan",
  "between",
  "isBlank",
];
export const CHECKBOX_OPERATORS: Array<FilterOperator> = ["equals", "isBlank"];
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
