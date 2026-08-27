import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoAccessPathExcluded } from "@/lib/seo/demo-access-gate";

describe("demoAccessPathExcluded", () => {
  it("allows admin login and APIs through the demo gate", () => {
    assert.equal(demoAccessPathExcluded("/admin/login"), true);
    assert.equal(demoAccessPathExcluded("/admin/login/"), true);
    assert.equal(demoAccessPathExcluded("/api/admin/session"), true);
    assert.equal(demoAccessPathExcluded("/api/admin/logout"), true);
    assert.equal(demoAccessPathExcluded("/admin"), true);
    assert.equal(demoAccessPathExcluded("/admin/bookings"), true);
  });

  it("allows /login alias for admin sign-in", () => {
    assert.equal(demoAccessPathExcluded("/login"), true);
  });

  it("allows static public assets through the demo gate", () => {
    assert.equal(demoAccessPathExcluded("/site.webmanifest"), true);
    assert.equal(demoAccessPathExcluded("/brand/logo.svg"), true);
    assert.equal(demoAccessPathExcluded("/photos/wakebusters/party-barge.jpg"), true);
  });

  it("still gates public marketing pages", () => {
    assert.equal(demoAccessPathExcluded("/"), false);
    assert.equal(demoAccessPathExcluded("/experiences/pontoon"), false);
    assert.equal(demoAccessPathExcluded("/our-story"), false);
  });
});
