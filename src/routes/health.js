const express = require("express");
const router = express.Router();

// Health check endpoint
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Arvo Auto-Deployment System is running",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// System status endpoint
router.get("/status", (req, res) => {
  const status = {
    success: true,
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    services: {
      terraform: process.env.TERRAFORM_PATH ? "configured" : "not configured",
      aws: process.env.AWS_ACCESS_KEY_ID ? "configured" : "not configured",
      gemini: process.env.GEMINI_API_KEY ? "configured" : "not configured",
    },
    timestamp: new Date().toISOString(),
  };

  res.json(status);
});

module.exports = router;
