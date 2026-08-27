import { siteConfig } from "@/config/site";

/** This deployment's admin-team tenant — team logins from other customer sites must not match. */
export function getAdminTeamTenantId(): string {
  return siteConfig.tenantId.trim();
}

/**
 * Untagged `adminTeam` docs (no tenantId) are denied by default so a shared Firebase
 * project cannot let another customer's operators into this site.
 * Set ADMIN_ALLOW_UNTAGGED_TEAM=1 only on the original site that created those docs.
 */
export function allowUntaggedAdminTeamMembers(): boolean {
  return process.env.ADMIN_ALLOW_UNTAGGED_TEAM === "1";
}

export function teamMemberBelongsToThisSite(memberTenantId: string | null | undefined): boolean {
  const tagged = (memberTenantId ?? "").trim();
  if (tagged) return tagged === getAdminTeamTenantId();
  return allowUntaggedAdminTeamMembers();
}
