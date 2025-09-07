const request = require("supertest");
const app = require("../src/index");

describe("Health Endpoints", () => {
  test("GET /api/health should return system status", async () => {
    const response = await request(app).get("/api/health").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain("Arvo Auto-Deployment System");
  });

  test("GET /api/health/status should return detailed status", async () => {
    const response = await request(app).get("/api/health/status").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.system).toBeDefined();
    expect(response.body.services).toBeDefined();
  });
});

describe("Deployment Endpoints", () => {
  test("POST /api/deployment/analyze should require description", async () => {
    const response = await request(app)
      .post("/api/deployment/analyze")
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("description");
  });

  test("POST /api/deployment/chat should require message", async () => {
    const response = await request(app)
      .post("/api/deployment/chat")
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("message");
  });
});

describe("Error Handling", () => {
  test("should return 404 for unknown routes", async () => {
    const response = await request(app).get("/api/unknown").expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Route not found");
  });
});
