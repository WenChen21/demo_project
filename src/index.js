const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs-extra");

// Load environment variables
dotenv.config();

// Import routes and middleware
const deploymentRoutes = require("./routes/deployment");
const healthRoutes = require("./routes/health");
const logger = require("./utils/logger");
const {
  createTempDirectory,
  createLogsDirectory,
} = require("./utils/fileSystem");

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.ALLOWED_ORIGINS?.split(",")
        : "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });
  next();
});

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/deployment", deploymentRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error("Unhandled error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    message: `The requested endpoint ${req.originalUrl} does not exist`,
  });
});

// Initialize application
async function initializeApp() {
  try {
    // Create necessary directories
    await createTempDirectory();
    await createLogsDirectory();

    logger.info("Application directories initialized successfully");

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Arvo Auto-Deployment System started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Temp directory: ${process.env.TEMP_DIR || "./temp"}`);
      logger.info(`Logs directory: ${process.env.LOGS_DIR || "./logs"}`);
    });
  } catch (error) {
    logger.error("Failed to initialize application:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Start the application
initializeApp();

module.exports = app;
