import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { siteConfig } from "@/config/site";
import { allowUntaggedAdminTeamMembers, teamMemberBelongsToThisSite } from "../team-tenant";

describe("teamMemberBelongsToThisSite", () => {
  it("accepts members tagged with this site tenantId", () => {
    assert.equal(teamMemberBelongsToThisSite(siteConfig.tenantId), true);
  });

  it("rejects members tagged for a different customer site", () => {
    assert.equal(teamMemberBelongsToThisSite("other-customer-demo"), false);
  });

  it("rejects untagged members unless ADMIN_ALLOW_UNTAGGED_TEAM=1", () => {
    const prev = process.env.ADMIN_ALLOW_UNTAGGED_TEAM;
    try {
      delete process.env.ADMIN_ALLOW_UNTAGGED_TEAM;
      assert.equal(allowUntaggedAdminTeamMembers(), false);
      assert.equal(teamMemberBelongsToThisSite(null), false);
      assert.equal(teamMemberBelongsToThisSite(""), false);
      process.env.ADMIN_ALLOW_UNTAGGED_TEAM = "1";
      assert.equal(teamMemberBelongsToThisSite(null), true);
    } finally {
      if (prev == null) delete process.env.ADMIN_ALLOW_UNTAGGED_TEAM;
      else process.env.ADMIN_ALLOW_UNTAGGED_TEAM = prev;
    }
  });
});
