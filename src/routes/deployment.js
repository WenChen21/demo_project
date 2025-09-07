const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const DeploymentService = require("../services/deploymentService");
const logger = require("../utils/logger");

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: process.env.TEMP_DIR || "./temp",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/zip", "application/x-zip-compressed"];
    if (
      allowedTypes.includes(file.mimetype) ||
      file.originalname.endsWith(".zip")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are allowed"), false);
    }
  },
});

const deploymentService = new DeploymentService();

/**
 * POST /api/deployment/analyze
 * Analyze a repository or uploaded zip file
 */
router.post("/analyze", upload.single("codebase"), async (req, res) => {
  const deploymentId = uuidv4();

  try {
    const { description, repositoryUrl } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: description",
      });
    }

    if (!repositoryUrl && !req.file) {
      return res.status(400).json({
        success: false,
        error: "Either repositoryUrl or codebase file must be provided",
      });
    }

    logger.info(`Starting analysis for deployment ${deploymentId}`, {
      description,
      repositoryUrl,
      hasFile: !!req.file,
    });

    const analysisResult = await deploymentService.analyzeApplication({
      deploymentId,
      description,
      repositoryUrl,
      uploadedFile: req.file,
    });

    res.json({
      success: true,
      deploymentId,
      analysis: analysisResult,
      message: "Application analysis completed successfully",
    });
  } catch (error) {
    logger.error(`Analysis failed for deployment ${deploymentId}:`, error);
    res.status(500).json({
      success: false,
      deploymentId,
      error: "Analysis failed",
      message: error.message,
    });
  }
});

/**
 * POST /api/deployment/deploy
 * Deploy an application based on analysis
 */
router.post("/deploy", async (req, res) => {
  const deploymentId = uuidv4();

  try {
    const { description, repositoryUrl, analysisId } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: description",
      });
    }

    if (!repositoryUrl && !analysisId) {
      return res.status(400).json({
        success: false,
        error: "Either repositoryUrl or analysisId must be provided",
      });
    }

    logger.info(`Starting deployment ${deploymentId}`, {
      description,
      repositoryUrl,
      analysisId,
    });

    // Start deployment process (async)
    const deploymentPromise = deploymentService.deployApplication({
      deploymentId,
      description,
      repositoryUrl,
      analysisId,
    });

    // Return immediately with deployment ID
    res.json({
      success: true,
      deploymentId,
      message: "Deployment started successfully",
      status: "in_progress",
    });

    // Handle deployment completion/failure
    deploymentPromise.catch((error) => {
      logger.error(`Deployment ${deploymentId} failed:`, error);
    });
  } catch (error) {
    logger.error(`Deployment initiation failed for ${deploymentId}:`, error);
    res.status(500).json({
      success: false,
      deploymentId,
      error: "Deployment initiation failed",
      message: error.message,
    });
  }
});

/**
 * POST /api/deployment/chat
 * Chat-based deployment interface (async)
 */
router.post("/chat", upload.single("codebase"), async (req, res) => {
  const deploymentId = uuidv4();

  try {
    const { message, repositoryUrl } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: message",
      });
    }

    if (!repositoryUrl && !req.file) {
      return res.status(400).json({
        success: false,
        error: "Either repositoryUrl or codebase file must be provided",
      });
    }

    logger.info(`Starting chat-based deployment ${deploymentId}`, {
      message,
      repositoryUrl,
      hasFile: !!req.file,
    });

    // Start the chat deployment process asynchronously
    const deploymentPromise = deploymentService.processChatDeployment({
      deploymentId,
      message,
      repositoryUrl,
      uploadedFile: req.file,
    });

    // Return immediately with deployment ID
    res.json({
      success: true,
      deploymentId,
      message: "Chat deployment started successfully",
      status: "in_progress",
      statusUrl: `/api/deployment/${deploymentId}/status`,
    });

    // Handle deployment completion/failure in background
    deploymentPromise.catch((error) => {
      logger.error(`Chat deployment ${deploymentId} failed:`, error);
    });
  } catch (error) {
    logger.error(
      `Chat deployment initiation failed for ${deploymentId}:`,
      error
    );
    res.status(500).json({
      success: false,
      deploymentId,
      error: "Chat deployment initiation failed",
      message: error.message,
    });
  }
});

/**
 * GET /api/deployment/list
 * Get all deployments
 */
router.get("/list", async (req, res) => {
  try {
    const deployments = await deploymentService.getAllDeployments();

    res.json({
      success: true,
      deployments,
    });
  } catch (error) {
    logger.error(`Failed to get deployments list:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to get deployments list",
      message: error.message,
    });
  }
});

/**
 * GET /api/deployment/:deploymentId/status
 * Get deployment status
 */
router.get("/:deploymentId/status", async (req, res) => {
  try {
    const { deploymentId } = req.params;

    const status = await deploymentService.getDeploymentStatus(deploymentId);

    res.json({
      success: true,
      deploymentId,
      status,
    });
  } catch (error) {
    logger.error(`Failed to get deployment status:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to get deployment status",
      message: error.message,
    });
  }
});

/**
 * GET /api/deployment/:deploymentId/steps
 * Get deployment steps
 */
router.get("/:deploymentId/steps", async (req, res) => {
  try {
    const { deploymentId } = req.params;

    const status = await deploymentService.getDeploymentStatus(deploymentId);
    const steps = status.steps || [];

    res.json({
      success: true,
      deploymentId,
      steps,
    });
  } catch (error) {
    logger.error(`Failed to get deployment steps:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to get deployment steps",
      message: error.message,
    });
  }
});

/**
 * GET /api/deployment/:deploymentId/logs
 * Get deployment logs
 */
router.get("/:deploymentId/logs", async (req, res) => {
  try {
    const { deploymentId } = req.params;

    const logs = await deploymentService.getDeploymentLogs(deploymentId);

    res.json({
      success: true,
      deploymentId,
      logs,
    });
  } catch (error) {
    logger.error(`Failed to get deployment logs:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to get deployment logs",
      message: error.message,
    });
  }
});

/**
 * GET /api/deployment/:deploymentId/instructions
 * Get deployment instructions for manual replication
 */
router.get("/:deploymentId/instructions", async (req, res) => {
  try {
    const { deploymentId } = req.params;

    const status = await deploymentService.getDeploymentStatus(deploymentId);
    
    if (status.instructions) {
      res.json({
        success: true,
        deploymentId,
        instructions: status.instructions,
      });
    } else {
      res.json({
        success: true,
        deploymentId,
        instructions: ["Instructions not available for this deployment"],
      });
    }
  } catch (error) {
    logger.error(`Failed to get deployment instructions:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to get deployment instructions",
      message: error.message,
    });
  }
});

/**
 * DELETE /api/deployment/:deploymentId
 * Destroy deployment
 */
router.delete("/:deploymentId", async (req, res) => {
  try {
    const { deploymentId } = req.params;

    await deploymentService.destroyDeployment(deploymentId);

    res.json({
      success: true,
      deploymentId,
      message: "Deployment destroyed successfully",
    });
  } catch (error) {
    logger.error(`Failed to destroy deployment:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to destroy deployment",
      message: error.message,
    });
  }
});

module.exports = router;
