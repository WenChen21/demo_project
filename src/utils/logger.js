const winston = require("winston");
const path = require("path");
const fs = require("fs-extra");

// Ensure logs directory exists
const logsDir = process.env.LOGS_DIR || "./logs";
fs.ensureDirSync(logsDir);

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: "HH:mm:ss",
  }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: {
    service: "arvo-deployment-system",
  },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    }),

    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Add deployment-specific logger
logger.deployment = (deploymentId) => {
  return logger.child({ deploymentId });
};

// Create deployment-specific log file
logger.createDeploymentLogger = (deploymentId) => {
  const deploymentLogsDir = path.join(logsDir, deploymentId);
  fs.ensureDirSync(deploymentLogsDir);

  const deploymentLogger = winston.createLogger({
    level: "info",
    format: logFormat,
    defaultMeta: {
      service: "arvo-deployment-system",
      deploymentId,
    },
    transports: [
      new winston.transports.File({
        filename: path.join(deploymentLogsDir, "deployment.log"),
        maxsize: 5242880, // 5MB
        maxFiles: 3,
        tailable: true,
      }),
    ],
  });

  if (process.env.NODE_ENV !== "production") {
    deploymentLogger.add(
      new winston.transports.Console({
        format: consoleFormat,
      })
    );
  }

  return deploymentLogger;
};

// Helper function to log deployment steps
logger.logDeploymentStep = (deploymentId, step, status, details = {}) => {
  const deploymentLogger = logger.createDeploymentLogger(deploymentId);

  const logData = {
    step,
    status,
    timestamp: new Date().toISOString(),
    ...details,
  };

  if (status === "started") {
    deploymentLogger.info(`Step ${step} started`, logData);
  } else if (status === "completed") {
    deploymentLogger.info(`Step ${step} completed`, logData);
  } else if (status === "failed") {
    deploymentLogger.error(`Step ${step} failed`, logData);
  } else {
    deploymentLogger.info(`Step ${step} - ${status}`, logData);
  }
};

// Helper function to log terraform output
logger.logTerraformOutput = (
  deploymentId,
  command,
  output,
  isError = false
) => {
  const deploymentLogger = logger.createDeploymentLogger(deploymentId);

  const logData = {
    command: `terraform ${command}`,
    output: output.substring(0, 10000), // Limit output length
    timestamp: new Date().toISOString(),
  };

  if (isError) {
    deploymentLogger.error("Terraform command failed", logData);
  } else {
    deploymentLogger.info("Terraform command output", logData);
  }
};

// Helper function to log application analysis
logger.logAnalysis = (deploymentId, analysis) => {
  const deploymentLogger = logger.createDeploymentLogger(deploymentId);

  deploymentLogger.info("Application analysis completed", {
    appType: analysis.appType,
    framework: analysis.framework,
    language: analysis.language,
    dependencies: Object.keys(analysis.dependencies),
    port: analysis.port,
    dockerized: analysis.dockerized,
    databaseRequirements: analysis.databaseRequirements,
    recommendations: analysis.recommendations.length,
    timestamp: new Date().toISOString(),
  });
};

// Helper function to log deployment strategy
logger.logStrategy = (deploymentId, strategy) => {
  const deploymentLogger = logger.createDeploymentLogger(deploymentId);

  deploymentLogger.info("Deployment strategy determined", {
    type: strategy.type,
    reasoning: strategy.reasoning,
    estimatedCost: strategy.estimated_cost,
    complexity: strategy.complexity,
    timestamp: new Date().toISOString(),
  });
};

// Error handling for uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
});

module.exports = logger;
