import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessAdminPath,
  canManageTeamMembers,
  getSuperAdminEmail,
  isSiteAdminRole,
  isSuperAdminEmail,
  isPitchDemoAdminEmail,
  normalizeAdminEmail,
  roleHasPermission,
} from "../roles";

describe("admin roles", () => {
  it("normalizes emails", () => {
    assert.equal(normalizeAdminEmail("  A@B.Com "), "a@b.com");
  });

  it("treats every ADMIN_EMAIL entry as super admin", () => {
    const prev = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = "owner@example.com, other@example.com";
    try {
      assert.equal(getSuperAdminEmail(), "owner@example.com");
      assert.equal(isSuperAdminEmail("owner@example.com"), true);
      assert.equal(isSuperAdminEmail("other@example.com"), true);
      assert.equal(isSuperAdminEmail("outsider@example.com"), false);
    } finally {
      if (prev == null) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = prev;
    }
  });

  it("allows @demo.io admins only on pitch demo sites", () => {
    const prev = process.env.DEMO_PITCH_SITE;
    try {
      delete process.env.DEMO_PITCH_SITE;
      assert.equal(isPitchDemoAdminEmail("ww@demo.io"), false);
      process.env.DEMO_PITCH_SITE = "1";
      assert.equal(isPitchDemoAdminEmail("ww@demo.io"), true);
      assert.equal(isPitchDemoAdminEmail("WW@Demo.io"), true);
      assert.equal(isPitchDemoAdminEmail("owner@gmail.com"), false);
    } finally {
      if (prev == null) delete process.env.DEMO_PITCH_SITE;
      else process.env.DEMO_PITCH_SITE = prev;
    }
  });

  it("site admins get full permissions; operators and captains are limited", () => {
    assert.equal(isSiteAdminRole("super_admin"), true);
    assert.equal(isSiteAdminRole("admin"), true);
    assert.equal(isSiteAdminRole("operator"), false);
    assert.equal(roleHasPermission("admin", "financials"), true);
    assert.equal(roleHasPermission("admin", "team"), true);
    assert.equal(canAccessAdminPath("admin", "/admin/financials"), true);
    assert.equal(canManageTeamMembers("admin"), true);
    assert.equal(canManageTeamMembers("operator"), false);
    assert.equal(roleHasPermission("operator", "financials"), false);
    assert.equal(roleHasPermission("captain", "dashboard"), true);
    assert.equal(roleHasPermission("captain", "calendar"), true);
    assert.equal(roleHasPermission("captain", "financials"), false);
    assert.equal(canAccessAdminPath("captain", "/admin/financials"), false);
    assert.equal(canAccessAdminPath("captain", "/admin/calendars"), true);
  });
});
