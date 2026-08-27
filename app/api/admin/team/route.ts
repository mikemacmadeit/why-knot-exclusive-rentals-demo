import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, getAdminPrincipalFromSessionCookie } from "@/lib/admin-auth-firebase";
import {
  canManageTeamMembers,
  getSuperAdminDisplayName,
  getSuperAdminEmails,
  isTeamInviteRole,
} from "@/lib/admin/roles";
import {
  ensureFirebaseUserAndResetLink,
  listTeamMembers,
  upsertTeamInvite,
} from "@/lib/admin/team-store";
import { emailTeamPasswordSetupLink } from "@/lib/admin/team-invite-email";
import { writeAdminAuditLog } from "@/lib/booking/admin-audit-log";
import { requireFeatureResponse } from "@/lib/plan";

export async function GET(request: NextRequest) {
  // PLAN_FEATURE_GATE
  {
    const planDenied = requireFeatureResponse("teamOps");
    if (planDenied) return planDenied;
  }

  const unauthorized = await requireAdminSession(request.headers.get("cookie"));
  if (unauthorized) return unauthorized;

  try {
    const members = await listTeamMembers();
    const superAdmins = getSuperAdminEmails().map((email, index) => ({
      email,
      name: index === 0 ? getSuperAdminDisplayName() : "Super Admin",
      role: "super_admin" as const,
      status: "active" as const,
      locked: true as const,
    }));
    return NextResponse.json({
      /** @deprecated Prefer `superAdmins` — kept for older clients. */
      superAdmin: superAdmins[0] ?? null,
      superAdmins,
      admins: members.filter((m) => m.role === "admin"),
      operators: members.filter((m) => m.role === "operator"),
      captains: members.filter((m) => m.role === "captain"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // PLAN_FEATURE_GATE
  {
    const planDenied = requireFeatureResponse("teamOps");
    if (planDenied) return planDenied;
  }

  const unauthorized = await requireAdminSession(request.headers.get("cookie"));
  if (unauthorized) return unauthorized;

  const principal = await getAdminPrincipalFromSessionCookie(request.headers.get("cookie"));
  if (!principal || !canManageTeamMembers(principal.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string; name?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = isTeamInviteRole(body.role) ? body.role : "operator";

  try {
    const member = await upsertTeamInvite({
      email: body.email ?? "",
      name: body.name ?? "",
      role,
      invitedBy: principal.email,
    });
    const { resetLink, createdUser } = await ensureFirebaseUserAndResetLink(member.email);
    let emailSent = false;
    if (resetLink) {
      emailSent = await emailTeamPasswordSetupLink({
        to: member.email,
        name: member.name,
        role: member.role,
        resetLink,
      });
    }
    const auditEvent =
      role === "admin"
        ? "team_admin_invited"
        : role === "captain"
          ? "team_captain_invited"
          : "team_operator_invited";
    void writeAdminAuditLog(auditEvent, {
      email: member.email,
      role,
      invitedBy: principal.email,
      createdUser,
      emailSent,
    });
    return NextResponse.json({
      member,
      resetLink,
      createdUser,
      emailSent,
    });
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
    const message = err instanceof Error ? err.message : String(err);
    const status = code === "INVALID_EMAIL" || code === "SUPER_ADMIN_LOCKED" || code === "INVALID_ROLE" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
