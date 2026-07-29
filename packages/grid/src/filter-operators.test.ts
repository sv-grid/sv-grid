import { describe, expect, it } from "vitest";
import {
  filterOperatorOptions,
  fallbackOperatorOption,
  TEXT_OPERATORS,
  NUMBER_OPERATORS,
  DATE_OPERATORS,
  CHECKBOX_OPERATORS,
  SET_OPERATORS,
  VALUELESS_OPERATORS,
  operatorOption,
  operatorsForColumn,
  defaultOperatorFor,
  operatorLabelFor,
} from "./filter-operators";
import type { FilterOperator, FilterOption } from "./SvGrid.types";

// `operatorsForColumn` / `defaultOperatorFor` / `operatorLabelFor` only ever
// read `column?.columnDef.editorType`, so a minimal duck-typed stub is enough
// to exercise every branch without standing up a real grid/column instance.
function col(editorType?: string): any {
  return editorType === undefined
    ? { columnDef: {} }
    : { columnDef: { editorType } };
}

describe("filter-operators: catalogue integrity", () => {
  it("every option exposes value/label/iconName and a unique value", () => {
    const values = filterOperatorOptions.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    for (const o of filterOperatorOptions) {
      expect(typeof o.value).toBe("string");
      expect(typeof o.label).toBe("string");
      expect(o.iconName).toMatch(/^op-/);
    }
  });

  it("fallback option is the 'contains' operator", () => {
    expect(fallbackOperatorOption.value).toBe("contains");
    expect(fallbackOperatorOption.label).toBe("Contains");
  });

  it("each type's operator list only references catalogued operators", () => {
    const known = new Set(filterOperatorOptions.map((o) => o.value));
    for (const list of [
      TEXT_OPERATORS,
      NUMBER_OPERATORS,
      DATE_OPERATORS,
      CHECKBOX_OPERATORS,
    ]) {
      for (const id of list) expect(known.has(id)).toBe(true);
    }
  });

  it("the catalogue includes between / isBlank for numeric + date filtering", () => {
    const values = filterOperatorOptions.map((o) => o.value);
    expect(values).toContain("between");
    expect(values).toContain("isBlank");
  });

  it("catalogues the extended operator set (parity with jQWidgets-style row)", () => {
    const values = filterOperatorOptions.map((o) => o.value);
    for (const op of [
      "notContains",
      "notEquals",
      "endsWith",
      "regex",
      "in",
      "notIn",
      "isNotBlank",
    ]) {
      expect(values).toContain(op);
    }
  });

  it("SET_OPERATORS and VALUELESS_OPERATORS reference catalogued operators", () => {
    const known = new Set(filterOperatorOptions.map((o) => o.value));
    for (const id of [...SET_OPERATORS, ...VALUELESS_OPERATORS]) {
      expect(known.has(id)).toBe(true);
    }
    expect([...SET_OPERATORS]).toEqual(["in", "notIn"]);
    expect([...VALUELESS_OPERATORS]).toEqual(["isBlank", "isNotBlank"]);
  });
});

describe("filter-operators: per-type coverage of the new operators", () => {
  it("text columns expose the full string + set operator range", () => {
    for (const op of [
      "notContains",
      "notEquals",
      "endsWith",
      "regex",
      "in",
      "notIn",
      "isNotBlank",
    ] as FilterOperator[]) {
      expect(TEXT_OPERATORS).toContain(op);
    }
  });

  it("number columns gain notEquals + in/notIn + isNotBlank but not text-only ops", () => {
    expect(NUMBER_OPERATORS).toContain("notEquals");
    expect(NUMBER_OPERATORS).toContain("in");
    expect(NUMBER_OPERATORS).toContain("isNotBlank");
    expect(NUMBER_OPERATORS).not.toContain("contains");
    expect(NUMBER_OPERATORS).not.toContain("regex");
  });

  it("checkbox columns gain isNotBlank alongside equals/isBlank", () => {
    expect(CHECKBOX_OPERATORS).toContain("isNotBlank");
  });

  it("date columns keep before/after semantics and add isNotBlank", () => {
    expect(DATE_OPERATORS).toContain("isNotBlank");
    expect(DATE_OPERATORS).not.toContain("in");
  });
});

describe("operatorOption", () => {
  it("returns the matching option for every catalogued operator", () => {
    for (const o of filterOperatorOptions) {
      expect(operatorOption(o.value)).toBe(o);
    }
  });

  it("looks up a specific operator by value", () => {
    expect(operatorOption("between")).toMatchObject({
      value: "between",
      label: "Between",
    });
    expect(operatorOption("greaterThan").label).toBe("Greater than");
    expect(operatorOption("lessThan").label).toBe("Less than");
    expect(operatorOption("startsWith").label).toBe("Starts with");
  });

  it("falls back to 'contains' for an unknown operator value", () => {
    const result = operatorOption("nope" as FilterOperator);
    expect(result).toBe(fallbackOperatorOption);
    expect(result.value).toBe("contains");
  });
});

describe("operatorsForColumn", () => {
  const labels = (opts: FilterOption[]) => opts.map((o) => o.value);

  it("number columns get equals/greaterThan/lessThan/between/isBlank", () => {
    expect(labels(operatorsForColumn(col("number")))).toEqual(NUMBER_OPERATORS);
  });

  it("date columns get the date operator set", () => {
    expect(labels(operatorsForColumn(col("date")))).toEqual(DATE_OPERATORS);
  });

  it("datetime columns share the date operator set", () => {
    expect(labels(operatorsForColumn(col("datetime")))).toEqual(DATE_OPERATORS);
  });

  it("checkbox columns get only equals + isBlank", () => {
    expect(labels(operatorsForColumn(col("checkbox")))).toEqual(
      CHECKBOX_OPERATORS,
    );
  });

  it("text columns get the text operator set", () => {
    expect(labels(operatorsForColumn(col("text")))).toEqual(TEXT_OPERATORS);
  });

  it("an unknown editor type defaults to the text operator set", () => {
    expect(labels(operatorsForColumn(col("currency")))).toEqual(TEXT_OPERATORS);
  });

  it("a column with no editorType defaults to text", () => {
    expect(labels(operatorsForColumn(col()))).toEqual(TEXT_OPERATORS);
  });

  it("an undefined column defaults to the text operator set", () => {
    expect(labels(operatorsForColumn(undefined))).toEqual(TEXT_OPERATORS);
  });

  it("returns full FilterOption objects (value+label+iconName), in order", () => {
    const opts = operatorsForColumn(col("number"));
    expect(opts[0]).toMatchObject({ value: "equals", iconName: "op-equals" });
    for (const o of opts) {
      expect(o).toHaveProperty("label");
      expect(o).toHaveProperty("iconName");
    }
  });
});

describe("defaultOperatorFor", () => {
  it("picks the first operator valid for the column type", () => {
    expect(defaultOperatorFor(col("number"))).toBe("equals");
    expect(defaultOperatorFor(col("date"))).toBe("equals");
    expect(defaultOperatorFor(col("checkbox"))).toBe("equals");
    expect(defaultOperatorFor(col("text"))).toBe("contains");
  });

  it("defaults to 'contains' for text / unknown / undefined columns", () => {
    expect(defaultOperatorFor(col())).toBe("contains");
    expect(defaultOperatorFor(undefined)).toBe("contains");
    expect(defaultOperatorFor(col("mystery"))).toBe("contains");
  });
});

describe("operatorLabelFor", () => {
  const less = operatorOption("lessThan");
  const greater = operatorOption("greaterThan");
  const equals = operatorOption("equals");

  it("renames lessThan/greaterThan to Before/After for date columns", () => {
    expect(operatorLabelFor(less, col("date"))).toBe("Before");
    expect(operatorLabelFor(greater, col("date"))).toBe("After");
  });

  it("applies the date relabelling for datetime columns too", () => {
    expect(operatorLabelFor(less, col("datetime"))).toBe("Before");
    expect(operatorLabelFor(greater, col("datetime"))).toBe("After");
  });

  it("leaves non-relabelled operators untouched on date columns", () => {
    expect(operatorLabelFor(equals, col("date"))).toBe(equals.label);
  });

  it("keeps the catalogue label for non-date columns", () => {
    expect(operatorLabelFor(less, col("number"))).toBe("Less than");
    expect(operatorLabelFor(greater, col("number"))).toBe("Greater than");
    expect(operatorLabelFor(less, col("text"))).toBe("Less than");
  });

  it("keeps the catalogue label when the column is undefined", () => {
    expect(operatorLabelFor(greater, undefined)).toBe("Greater than");
  });
});
