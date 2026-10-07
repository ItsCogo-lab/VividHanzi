import { describe, expect, it } from "vitest";
import { givesContext, rankExamples } from "./exampleChoice.ts";

describe("givesContext", () => {
  it("needs a few characters besides the word", () => {
    expect(givesContext("完成了！", "完成")).toBe(false);
    expect(givesContext("我们完成了!", "完成")).toBe(false);
    expect(givesContext("我已经完成作业了。", "完成")).toBe(true);
  });
});

describe("rankExamples", () => {
  const rank = (sentences: string[]) =>
    rankExamples(sentences, "完成", (sentence) => sentence);

  it("puts sentences with context first and keeps the order otherwise", () => {
    expect(
      rank([
        "完成了。",
        "我们完成了!",
        "我已经完成作业了。",
        "这个工作很难完成。",
      ]),
    ).toEqual([
      "我已经完成作业了。",
      "这个工作很难完成。",
      "完成了。",
      "我们完成了!",
    ]);
  });

  it("drops sentences that only differ in punctuation", () => {
    expect(rank(["完成了。", "完成了！", "完成了!"])).toEqual(["完成了。"]);
  });
});
