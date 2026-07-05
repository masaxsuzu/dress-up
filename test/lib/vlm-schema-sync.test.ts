// lib/vlm.ts の TOOL_SCHEMA (Gemini `@google/genai` の Type.* ベースで手書き) と
// schema/clothing.ts の VLMExtractionSchema (data shape の source of truth) が
// ズレていないかを検証する。CLAUDE.md ハードルール「tool 入力 JSON Schema は
// 手動同期が必要」を機械的に担保するテスト。
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ColorSchema, VLMExtractionSchema } from "@/schema/clothing";
import { TOOL_SCHEMA } from "@/lib/vlm";

// @google/genai の Schema 型は minItems/maxItems が string 型など癖があるため、
// このテストで参照する分だけの最小限の shape を自前で定義する。
interface ToolSchemaNode {
  type?: unknown;
  properties?: Record<string, ToolSchemaNode>;
  required?: string[];
  enum?: string[];
  items?: ToolSchemaNode;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
}

/** enum (直接、または ARRAY の items 経由) の許容値集合を取り出す */
function getToolEnumOptions(node: ToolSchemaNode | undefined): string[] {
  if (!node) throw new Error("フィールドが TOOL_SCHEMA に存在しない");
  if (node.enum) return node.enum;
  if (node.items?.enum) return node.items.enum;
  throw new Error("enum (直接 or items 経由) が見つからない");
}

const toolSchema = TOOL_SCHEMA as unknown as ToolSchemaNode;

/** JSON Schema の "required" 相当: Zod でキー省略 (undefined) が許容されないか */
function isRequiredField(field: z.ZodType): boolean {
  return !field.safeParse(undefined).success;
}

/** TOOL_SCHEMA の `nullable: true` 相当: Zod で null が許容されるか */
function isNullableField(field: z.ZodType): boolean {
  return field.safeParse(null).success;
}

function unwrapNullable(field: z.ZodType): z.ZodType {
  return field instanceof z.ZodNullable
    ? unwrapNullable(field.unwrap() as z.ZodType)
    : field;
}

/** enum (または enum の配列) フィールドの許容値集合を取り出す */
function getEnumOptions(field: z.ZodType): string[] {
  const base = unwrapNullable(field);
  if (base instanceof z.ZodArray) {
    const element = unwrapNullable(base.element as z.ZodType);
    if (element instanceof z.ZodEnum) return [...element.options] as string[];
    throw new Error("array の要素が ZodEnum ではない");
  }
  if (base instanceof z.ZodEnum) return [...base.options] as string[];
  throw new Error("ZodEnum (または ZodEnum の配列) ではない");
}

/** properties のキー集合 と required 配列が Zod の shape と一致するかを検証する */
function expectKeysAndRequiredMatch(
  label: string,
  toolNode: ToolSchemaNode,
  zodShape: Record<string, z.ZodType>,
) {
  const toolKeys = Object.keys(toolNode.properties ?? {}).sort();
  const zodKeys = Object.keys(zodShape).sort();
  expect(toolKeys, `${label}: properties のキー集合が Zod と不一致`).toEqual(
    zodKeys,
  );

  const expectedRequired = Object.entries(zodShape)
    .filter(([, field]) => isRequiredField(field))
    .map(([key]) => key)
    .sort();
  const actualRequired = [...(toolNode.required ?? [])].sort();
  expect(
    actualRequired,
    `${label}: required 配列が Zod の必須キー集合と不一致`,
  ).toEqual(expectedRequired);
}

describe("TOOL_SCHEMA <-> VLMExtractionSchema 同期", () => {
  const shape = VLMExtractionSchema.shape;

  it("トップレベル properties のキー集合が Zod の shape と一致する", () => {
    expectKeysAndRequiredMatch("TOOL_SCHEMA", toolSchema, shape);
  });

  it("required 配列が Zod で省略不可なキー集合と一致する", () => {
    const expectedRequired = Object.entries(shape)
      .filter(([, field]) => isRequiredField(field))
      .map(([key]) => key)
      .sort();
    expect([...(toolSchema.required ?? [])].sort()).toEqual(expectedRequired);
  });

  it("nullable: true のフィールドが Zod の .nullable() と一致する", () => {
    for (const [key, field] of Object.entries(shape)) {
      const toolField = toolSchema.properties?.[key];
      expect(toolField, `${key}: TOOL_SCHEMA.properties に存在しない`).toBeDefined();
      const zodNullable = isNullableField(field);
      const toolNullable = toolField?.nullable === true;
      expect(
        toolNullable,
        `${key}: nullable フラグ不一致 (TOOL_SCHEMA=${String(toolNullable)}, Zod=${String(zodNullable)})`,
      ).toBe(zodNullable);
    }
  });

  it.each([
    ["category", "category"],
    ["pattern", "pattern"],
    ["season", "season"],
  ] as const)("%s の enum 許容値が Zod と一致する", (_label, key) => {
    const toolOptions = [...getToolEnumOptions(toolSchema.properties?.[key])].sort();
    const zodOptions = getEnumOptions(shape[key]).sort();
    expect(toolOptions, `${key}: enum 許容値が不一致`).toEqual(zodOptions);
  });

  it("formality の範囲 (min/max) が Zod と一致する", () => {
    // formality は enum ではなく 1〜5 の整数レンジ。TOOL_SCHEMA の
    // minimum/maximum と Zod の .min()/.max() を突き合わせる。
    const field = shape.formality as unknown as {
      minValue: number | null;
      maxValue: number | null;
    };
    expect(toolSchema.properties?.formality?.minimum).toBe(field.minValue);
    expect(toolSchema.properties?.formality?.maximum).toBe(field.maxValue);
  });

  describe("colors (ネストされた object 配列)", () => {
    it("colors.items の properties/required が ColorSchema と一致する", () => {
      const colorsNode = toolSchema.properties?.colors;
      expect(colorsNode, "colors が TOOL_SCHEMA.properties に存在しない").toBeDefined();
      const itemsNode = colorsNode?.items;
      expect(itemsNode, "colors.items が定義されていない").toBeDefined();
      expectKeysAndRequiredMatch(
        "colors.items",
        itemsNode ?? {},
        ColorSchema.shape,
      );
    });
  });
});
