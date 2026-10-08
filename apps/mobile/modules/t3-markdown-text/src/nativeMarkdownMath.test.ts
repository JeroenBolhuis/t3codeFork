import { describe, expect, it, vi } from "vite-plus/test";
import type { MarkdownNode } from "react-native-nitro-markdown/headless";

import { parseNativeMarkdownMath } from "./nativeMarkdownMath";

// The native binding returns code spans with text children. Keep that boundary
// explicit while exercising the real Markdown parser's delimiter precedence.
function codeSpans(source: string): MarkdownNode {
  return {
    type: "document",
    children: [...source.matchAll(/`([^`]+)`/g)].map((match) => ({
      type: "code_inline",
      children: [{ type: "text", content: match[1]! }],
    })),
  };
}

describe("native math parsing", () => {
  it.each([
    [String.raw`\(\sqrt{x}\)`, "math_inline"],
    [String.raw`\[\sqrt{x}\]`, "math_block"],
    ["$$\\sqrt{x}$$", "math_inline"],
    ["$$\n\\sqrt{x}\n$$", "math_block"],
    ["```math\n\\sqrt{x}\n```", "math_block"],
    ["``` math\n\\sqrt{x}\n```", "math_block"],
    ["> \\[\n> \\sqrt{x}\n> \\]", "math_block"],
  ])("preserves TeX in %s", (source, type) => {
    expect(parseNativeMarkdownMath(source, codeSpans).children).toEqual([
      { type, content: String.raw`\sqrt{x}`, children: [] },
    ]);
  });

  it.each([
    "Pay $20 or $30.",
    String.raw`Unfinished \[\sqrt{x}`,
    String.raw`Unfinished \(x`,
    "`\\(x\\)` and ```\\[y\\]```",
    "```tex\n\\[x\\]\n```",
    String.raw`[documentation](https://example.com/\(x\))`,
    String.raw`<span title="\(x\)">example</span>`,
    "[\n\\sqrt{x}\n]",
  ])("leaves non-math source unchanged: %s", (source) => {
    const parse = vi.fn((): MarkdownNode => ({ type: "document" }));
    parseNativeMarkdownMath(source, parse);
    expect(parse).toHaveBeenCalledExactlyOnceWith(source);
  });

  it("keeps Markdown around equations and avoids collisions with authored code", () => {
    const source = "**Growth \\(x_1\\)** and `t3-math:0` then \\[y^2\\].";
    const parse = vi.fn(codeSpans);
    const result = parseNativeMarkdownMath(source, parse);
    expect(parse).toHaveBeenCalledWith(
      "**Growth `t3-math::0`** and `t3-math:0` then `t3-math::1`.",
    );
    expect(result.children?.map((node) => node.type)).toEqual([
      "math_inline",
      "code_inline",
      "math_block",
    ]);
  });
});
