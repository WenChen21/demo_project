// Test setup file
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.PORT = "3001";
  process.env.TEMP_DIR = "./test-temp";
  process.env.LOGS_DIR = "./test-logs";
});

afterAll(() => {
  // Cleanup test environment
  const fs = require("fs-extra");

  // Clean up test directories
  fs.removeSync("./test-temp");
  fs.removeSync("./test-logs");
});
