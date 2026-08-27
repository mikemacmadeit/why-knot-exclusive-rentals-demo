import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldBlockSearchIndexing } from "@/lib/seo/block-search-indexing";

describe("shouldBlockSearchIndexing", () => {
  it("blocks indexing for this sales-demo customer config", () => {
    assert.equal(shouldBlockSearchIndexing(), true);
  });
});
