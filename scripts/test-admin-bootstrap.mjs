import assert from "node:assert/strict"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { default: ensureAdmin } = require("../apps/backend/.medusa/server/src/scripts/ensure-admin.js")
const { Modules, ContainerRegistrationKeys } = require("@medusajs/framework/utils")
const email = "admin@example.com"
const firstPassword = "first-test-password-123"
const nextPassword = "second-test-password-456"
let user, identity, password, creates = 0, registrations = 0, rotations = 0, failCreate = false
const logs = []
const services = {
  [ContainerRegistrationKeys.LOGGER]: { info: (message) => logs.push(message) },
  [Modules.USER]: { listUsers: async () => user ? [user] : [] },
  [Modules.AUTH]: {
    listAuthIdentities: async () => identity ? [identity] : [],
    register: async (_provider, data) => {
      registrations++
      password = data.body.password
      identity = { id: "auth_test", app_metadata: {} }
      return { success: true, authIdentity: identity }
    },
    updateProvider: async (_provider, data) => {
      assert.equal(data.entity_id, email)
      rotations++
      password = data.password
      return { success: true, authIdentity: identity }
    },
    updateAuthIdentities: async (data) => { identity = { ...identity, ...data }; return identity },
  },
  [Modules.WORKFLOW_ENGINE]: { run: async (name, data) => {
    assert.equal(name, "create-users-workflow")
    if (failCreate) throw new Error(`Sensitive failure: ${firstPassword}`)
    creates++
    user = { id: "user_test", email: data.input.users[0].email }
    return { result: [user] }
  } },
}
const args = { container: { resolve: (key) => { assert.ok(services[key], `Unexpected service ${key}`); return services[key] } } }
const saved = [process.env.MEDUSA_ADMIN_EMAIL, process.env.MEDUSA_ADMIN_PASSWORD]
try {
  delete process.env.MEDUSA_ADMIN_EMAIL
  delete process.env.MEDUSA_ADMIN_PASSWORD
  await ensureAdmin({ container: { resolve: () => assert.fail("No secrets must mean no changes") } })
  process.env.MEDUSA_ADMIN_EMAIL = email
  await assert.rejects(ensureAdmin(args), /Set both/)
  process.env.MEDUSA_ADMIN_PASSWORD = "short"
  await assert.rejects(ensureAdmin(args), /at least 12/)
  process.env.MEDUSA_ADMIN_PASSWORD = firstPassword
  process.env.MEDUSA_ADMIN_EMAIL = " ADMIN@example.com "
  await ensureAdmin(args)
  assert.equal(user.email, email)
  assert.equal(identity.app_metadata.user_id, user.id)
  assert.equal(password, firstPassword)
  await ensureAdmin(args)
  assert.equal(creates, 1)
  assert.equal(registrations, 1)
  process.env.MEDUSA_ADMIN_PASSWORD = nextPassword
  await ensureAdmin(args)
  assert.equal(password, nextPassword)
  assert.equal(rotations, 2)

  identity.app_metadata = { customer_id: "customer_test" }
  const before = rotations
  await assert.rejects(ensureAdmin(args), /Unable to configure/)
  assert.equal(rotations, before, "Customer credentials must not change")
  identity.app_metadata = { user_id: "different_user" }
  await assert.rejects(ensureAdmin(args), /Unable to configure/)
  assert.equal(rotations, before)

  identity = undefined
  await ensureAdmin(args)
  assert.equal(creates, 1, "Existing user without auth identity must be repaired")
  assert.equal(identity.app_metadata.user_id, user.id)

  user = undefined
  identity = undefined
  failCreate = true
  await assert.rejects(ensureAdmin(args), (error) => !error.message.includes(firstPassword) && /Unable to configure/.test(error.message))
  failCreate = false
  await ensureAdmin(args)
  assert.equal(identity.app_metadata.user_id, user.id, "Retry after partial creation must repair the link")
  assert.ok(logs.every((message) => !message.includes(firstPassword) && !message.includes(nextPassword)))
  console.log("PASS: absent/invalid secrets, creation, repeat startup, password rotation, identity conflict protection, partial-creation recovery, redacted errors")
} finally {
  for (const [index, key] of ["MEDUSA_ADMIN_EMAIL", "MEDUSA_ADMIN_PASSWORD"].entries()) {
    if (saved[index] === undefined) delete process.env[key]
    else process.env[key] = saved[index]
  }
}
