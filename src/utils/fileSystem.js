const fs = require("fs-extra");
const path = require("path");
const logger = require("./logger");

/**
 * Create temporary directory for deployments
 */
async function createTempDirectory() {
  const tempDir = process.env.TEMP_DIR || "./temp";

  try {
    await fs.ensureDir(tempDir);
    logger.info(`Temp directory created/verified: ${tempDir}`);
    return tempDir;
  } catch (error) {
    logger.error(`Failed to create temp directory ${tempDir}:`, error);
    throw error;
  }
}

/**
 * Create logs directory
 */
async function createLogsDirectory() {
  const logsDir = process.env.LOGS_DIR || "./logs";

  try {
    await fs.ensureDir(logsDir);
    logger.info(`Logs directory created/verified: ${logsDir}`);
    return logsDir;
  } catch (error) {
    logger.error(`Failed to create logs directory ${logsDir}:`, error);
    throw error;
  }
}

/**
 * Create deployment-specific directory
 */
async function createDeploymentDirectory(deploymentId) {
  const tempDir = process.env.TEMP_DIR || "./temp";
  const deploymentDir = path.join(tempDir, deploymentId);

  try {
    await fs.ensureDir(deploymentDir);
    logger.info(`Deployment directory created: ${deploymentDir}`);
    return deploymentDir;
  } catch (error) {
    logger.error(
      `Failed to create deployment directory ${deploymentDir}:`,
      error
    );
    throw error;
  }
}

/**
 * Cleanup deployment files
 */
async function cleanupDeployment(deploymentId) {
  const tempDir = process.env.TEMP_DIR || "./temp";
  const deploymentDir = path.join(tempDir, deploymentId);

  try {
    if (await fs.pathExists(deploymentDir)) {
      await fs.remove(deploymentDir);
      logger.info(`Deployment directory cleaned up: ${deploymentDir}`);
    }
  } catch (error) {
    logger.warn(
      `Failed to cleanup deployment directory ${deploymentDir}:`,
      error
    );
    // Don't throw error for cleanup failures
  }
}

/**
 * Cleanup old temporary files
 */
async function cleanupOldFiles(maxAgeHours = 24) {
  const tempDir = process.env.TEMP_DIR || "./temp";

  try {
    if (!(await fs.pathExists(tempDir))) {
      return;
    }

    const items = await fs.readdir(tempDir);
    const now = Date.now();
    let cleanedCount = 0;

    for (const item of items) {
      const itemPath = path.join(tempDir, item);
      const stats = await fs.stat(itemPath).catch(() => null);

      if (stats) {
        const ageHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);

        if (ageHours > maxAgeHours) {
          await fs.remove(itemPath);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old files from temp directory`);
    }
  } catch (error) {
    logger.warn("Failed to cleanup old files:", error);
  }
}

/**
 * Get directory size in bytes
 */
async function getDirectorySize(dirPath) {
  try {
    let size = 0;
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        size += await getDirectorySize(filePath);
      } else {
        size += stats.size;
      }
    }

    return size;
  } catch (error) {
    logger.warn(`Failed to get directory size for ${dirPath}:`, error);
    return 0;
  }
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Check available disk space
 */
async function checkDiskSpace() {
  try {
    const tempDir = process.env.TEMP_DIR || "./temp";
    const stats = await fs.stat(tempDir).catch(() => null);

    if (stats) {
      // This is a simplified check - in production you'd use a proper disk space library
      return {
        available: true,
        path: tempDir,
        warning: false,
      };
    }

    return {
      available: false,
      path: tempDir,
      warning: true,
      message: "Temp directory not accessible",
    };
  } catch (error) {
    logger.warn("Failed to check disk space:", error);
    return {
      available: true,
      warning: true,
      message: "Could not check disk space",
    };
  }
}

/**
 * Create archive of deployment files
 */
async function createDeploymentArchive(deploymentId, outputPath) {
  const AdmZip = require("adm-zip");
  const tempDir = process.env.TEMP_DIR || "./temp";
  const deploymentDir = path.join(tempDir, deploymentId);

  try {
    if (!(await fs.pathExists(deploymentDir))) {
      throw new Error("Deployment directory not found");
    }

    const zip = new AdmZip();
    await zip.addLocalFolderPromise(deploymentDir, {});
    await zip.writeZipPromise(outputPath);

    logger.info(`Deployment archive created: ${outputPath}`);
    return outputPath;
  } catch (error) {
    logger.error(`Failed to create deployment archive:`, error);
    throw error;
  }
}

/**
 * Validate file path security
 */
function validateFilePath(filePath, allowedBasePath) {
  const resolvedPath = path.resolve(filePath);
  const resolvedBasePath = path.resolve(allowedBasePath);

  if (!resolvedPath.startsWith(resolvedBasePath)) {
    throw new Error("Invalid file path - outside allowed directory");
  }

  return resolvedPath;
}

/**
 * Safe file copy with validation
 */
async function safeCopyFile(
  sourcePath,
  destPath,
  allowedSourceBase,
  allowedDestBase
) {
  try {
    const validatedSource = validateFilePath(sourcePath, allowedSourceBase);
    const validatedDest = validateFilePath(destPath, allowedDestBase);

    await fs.ensureDir(path.dirname(validatedDest));
    await fs.copy(validatedSource, validatedDest);

    logger.debug(`File copied safely: ${validatedSource} -> ${validatedDest}`);
  } catch (error) {
    logger.error(`Safe file copy failed:`, error);
    throw error;
  }
}

/**
 * Get file hash for integrity checking
 */
async function getFileHash(filePath, algorithm = "sha256") {
  const crypto = require("crypto");

  try {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash(algorithm);
    hashSum.update(fileBuffer);

    return hashSum.digest("hex");
  } catch (error) {
    logger.error(`Failed to calculate file hash for ${filePath}:`, error);
    throw error;
  }
}

/**
 * Monitor directory changes
 */
function watchDirectory(dirPath, callback) {
  try {
    const watcher = fs.watch(
      dirPath,
      { recursive: true },
      (eventType, filename) => {
        callback(eventType, filename, dirPath);
      }
    );

    logger.debug(`Watching directory: ${dirPath}`);
    return watcher;
  } catch (error) {
    logger.error(`Failed to watch directory ${dirPath}:`, error);
    throw error;
  }
}

// Schedule automatic cleanup of old files
const cron = require("node-cron");

// Run cleanup every hour
cron.schedule("0 * * * *", () => {
  cleanupOldFiles(24); // Remove files older than 24 hours
});

// Run cleanup of very old files daily
cron.schedule("0 2 * * *", () => {
  cleanupOldFiles(168); // Remove files older than 1 week
});

module.exports = {
  createTempDirectory,
  createLogsDirectory,
  createDeploymentDirectory,
  cleanupDeployment,
  cleanupOldFiles,
  getDirectorySize,
  formatFileSize,
  checkDiskSpace,
  createDeploymentArchive,
  validateFilePath,
  safeCopyFile,
  getFileHash,
  watchDirectory,
};
