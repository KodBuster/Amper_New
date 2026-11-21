import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, FeatureFlag, Modules } from "@medusajs/framework/utils"

/** Configure one administrator from runtime secrets without passing a password in CLI arguments. */
export default async function ensureAdmin({ container }: ExecArgs) {
  const rawEmail = process.env.MEDUSA_ADMIN_EMAIL
  const password = process.env.MEDUSA_ADMIN_PASSWORD
  if (rawEmail === undefined && password === undefined) return
  const email = rawEmail?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
    throw new Error("Set both MEDUSA_ADMIN_EMAIL and MEDUSA_ADMIN_PASSWORD (password: at least 12 characters)")
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const users = container.resolve(Modules.USER)
  const auth = container.resolve(Modules.AUTH)
  const workflows = container.resolve(Modules.WORKFLOW_ENGINE)
  try {
    let [user] = await users.listUsers({ email }, { take: 1 })
    let [identity] = await auth.listAuthIdentities({
      provider_identities: { provider: "emailpass", entity_id: email },
    }, { take: 1 })

    // Never attach a customer's credentials, or credentials belonging to another user, to an admin.
    const metadata = identity?.app_metadata || {}
    if (Object.keys(metadata).some((key) => key.endsWith("_id") && key !== "user_id" && metadata[key]) ||
        (metadata.user_id && metadata.user_id !== user?.id)) {
      throw new Error("Identity conflict")
    }

    if (!identity) {
      const registered = await auth.register("emailpass", { body: { email, password } })
      if (!registered.success || !registered.authIdentity) throw new Error("Registration failed")
      identity = registered.authIdentity
    } else {
      // The secrets remain authoritative while present; changing the secret rotates the password.
      const updated = await auth.updateProvider("emailpass", { entity_id: email, password })
      if (!updated.success) throw new Error("Password update failed")
    }

    if (!user) {
      let roles: string[] = []
      if (FeatureFlag.isFeatureEnabled("rbac")) {
        const rbac = container.resolve(Modules.RBAC)
        const superAdmin = await rbac.listRbacRoles({ id: "role_super_admin" })
        roles = superAdmin.map((role) => role.id)
      }
      const { result } = await workflows.run("create-users-workflow", {
        input: { users: [{ email, roles }] },
      })
      user = result[0]
    }
    await auth.updateAuthIdentities({
      id: identity.id,
      app_metadata: { ...identity.app_metadata, user_id: user.id },
    })
    logger.info("[admin-bootstrap] Administrator credentials configured from runtime secrets.")
  } catch {
    // Provider/DB errors may contain input data: do not print the original error with credentials.
    throw new Error("[admin-bootstrap] Unable to configure administrator. Check database access and use an email not assigned to another account type.")
  }
}
