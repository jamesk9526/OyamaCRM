// Shared auth helpers for API/smoke tests.
import request from "supertest";

/** Logs in a seeded admin and returns bearer token plus auth header object. */
export async function loginAsAdmin(app: Awaited<typeof import("@/server/src/index")>["default"]) {
  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });

  if (login.status !== 200 || !login.body?.data?.accessToken) {
    throw new Error(`Admin login failed for tests: ${login.status} ${JSON.stringify(login.body)}`);
  }

  const token = String(login.body.data.accessToken);
  return {
    token,
    authHeader: { Authorization: `Bearer ${token}` },
  };
}

/** Creates one staff user and returns the new credentials and token. */
export async function createAndLoginStaffUser(app: Awaited<typeof import("@/server/src/index")>["default"], adminToken: string) {
  const unique = Date.now();
  const email = `test.staff.${unique}@hopefoundation.org`;
  const password = "staff12345!";

  const created = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      email,
      firstName: "Test",
      lastName: "Staff",
      role: "staff",
      password,
    });

  if (created.status !== 201) {
    throw new Error(`Failed to create staff test user: ${created.status} ${JSON.stringify(created.body)}`);
  }

  const login = await request(app).post("/api/auth/login").send({ email, password });
  if (login.status !== 200 || !login.body?.data?.accessToken) {
    throw new Error(`Failed to login staff test user: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return {
    email,
    password,
    token: String(login.body.data.accessToken),
  };
}
