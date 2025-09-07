const fs = require("fs-extra");
const path = require("path");
const AdmZip = require("adm-zip");
const simpleGit = require("simple-git");
const logger = require("../utils/logger");

class RepositoryAnalyzer {
  constructor() {
    this.git = simpleGit();
  }

  /**
   * Clone a GitHub repository
   */
  async cloneRepository(repositoryUrl, destinationDir) {
    try {
      const repoName = this.extractRepoName(repositoryUrl);
      const clonePath = path.join(destinationDir, repoName);

      logger.info(`Cloning repository ${repositoryUrl} to ${clonePath}`);

      await this.git.clone(repositoryUrl, clonePath);

      logger.info(`Repository cloned successfully to ${clonePath}`);
      return clonePath;
    } catch (error) {
      logger.error(`Failed to clone repository ${repositoryUrl}:`, error);
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Extract uploaded zip file
   */
  async extractZipFile(zipFilePath, destinationDir) {
    try {
      logger.info(`Extracting zip file ${zipFilePath} to ${destinationDir}`);

      const zip = new AdmZip(zipFilePath);
      const extractPath = path.join(destinationDir, "extracted");

      zip.extractAllTo(extractPath, true);

      // Clean up zip file
      await fs.remove(zipFilePath);

      logger.info(`Zip file extracted successfully to ${extractPath}`);
      return extractPath;
    } catch (error) {
      logger.error(`Failed to extract zip file ${zipFilePath}:`, error);
      throw new Error(`Failed to extract zip file: ${error.message}`);
    }
  }

  /**
   * Analyze codebase to determine application type and requirements
   */
  async analyzeCodebase(codebasePath) {
    try {
      logger.info(`Analyzing codebase at ${codebasePath}`);

      const analysis = {
        appType: "unknown",
        framework: null,
        language: null,
        dependencies: {},
        buildCommands: [],
        startCommands: [],
        port: null,
        environmentVariables: [],
        databaseRequirements: [],
        staticFiles: false,
        dockerized: false,
        hasTests: false,
        configFiles: {},
        recommendations: [],
      };

      // Check for various application types and configurations
      await this.detectApplicationType(codebasePath, analysis);
      await this.analyzeDependencies(codebasePath, analysis);
      await this.detectCommands(codebasePath, analysis);
      await this.analyzeConfiguration(codebasePath, analysis);
      await this.detectDatabaseRequirements(codebasePath, analysis);
      await this.generateRecommendations(analysis);

      logger.info(`Codebase analysis completed`, {
        appType: analysis.appType,
        framework: analysis.framework,
        language: analysis.language,
      });

      return analysis;
    } catch (error) {
      logger.error(`Failed to analyze codebase at ${codebasePath}:`, error);
      throw new Error(`Codebase analysis failed: ${error.message}`);
    }
  }

  /**
   * Detect application type based on files and structure
   */
  async detectApplicationType(codebasePath, analysis) {
    const files = await this.getFileList(codebasePath);

    // Node.js applications
    if (files.includes("package.json")) {
      analysis.language = "javascript";
      const packageJson = await this.readJsonFile(
        path.join(codebasePath, "package.json")
      );

      if (packageJson.dependencies) {
        if (packageJson.dependencies.express) {
          analysis.appType = "node-express";
          analysis.framework = "express";
        } else if (packageJson.dependencies.next) {
          analysis.appType = "next-js";
          analysis.framework = "next.js";
        } else if (packageJson.dependencies.react) {
          analysis.appType = "react";
          analysis.framework = "react";
        } else if (packageJson.dependencies.vue) {
          analysis.appType = "vue";
          analysis.framework = "vue";
        } else {
          analysis.appType = "node";
          analysis.framework = "node.js";
        }
      }
    }

    // Python applications
    else if (
      files.includes("requirements.txt") ||
      files.includes("pyproject.toml") ||
      files.includes("Pipfile")
    ) {
      analysis.language = "python";

      if (files.includes("manage.py")) {
        analysis.appType = "django";
        analysis.framework = "django";
      } else if (
        await this.containsPatterns(codebasePath, [
          "from flask import",
          "Flask(__name__)",
        ])
      ) {
        analysis.appType = "flask";
        analysis.framework = "flask";
      } else if (
        await this.containsPatterns(codebasePath, [
          "from fastapi import",
          "FastAPI()",
        ])
      ) {
        analysis.appType = "fastapi";
        analysis.framework = "fastapi";
      } else {
        analysis.appType = "python";
        analysis.framework = "python";
      }
    }

    // Java applications
    else if (files.includes("pom.xml") || files.includes("build.gradle")) {
      analysis.language = "java";

      if (files.includes("pom.xml")) {
        const pomContent = await fs.readFile(
          path.join(codebasePath, "pom.xml"),
          "utf8"
        );
        if (pomContent.includes("spring-boot")) {
          analysis.appType = "spring-boot";
          analysis.framework = "spring-boot";
        }
      }

      if (!analysis.framework) {
        analysis.appType = "java";
        analysis.framework = "java";
      }
    }

    // Go applications
    else if (files.includes("go.mod") || files.includes("main.go")) {
      analysis.language = "go";
      analysis.appType = "go";
      analysis.framework = "go";
    }

    // PHP applications
    else if (
      files.includes("composer.json") ||
      (await this.containsPatterns(codebasePath, ["<?php"]))
    ) {
      analysis.language = "php";

      if (files.includes("artisan")) {
        analysis.appType = "laravel";
        analysis.framework = "laravel";
      } else {
        analysis.appType = "php";
        analysis.framework = "php";
      }
    }

    // Ruby applications
    else if (files.includes("Gemfile") || files.includes("config.ru")) {
      analysis.language = "ruby";

      if (files.includes("config.ru")) {
        analysis.appType = "rails";
        analysis.framework = "rails";
      } else {
        analysis.appType = "ruby";
        analysis.framework = "ruby";
      }
    }

    // Check for Docker
    if (files.includes("Dockerfile")) {
      analysis.dockerized = true;
    }

    // Check for static sites
    if (files.includes("index.html") && !analysis.appType !== "unknown") {
      analysis.staticFiles = true;
      if (analysis.appType === "unknown") {
        analysis.appType = "static";
        analysis.language = "html";
      }
    }
  }

  /**
   * Analyze dependencies and package files
   */
  async analyzeDependencies(codebasePath, analysis) {
    const files = await this.getFileList(codebasePath);

    // Node.js dependencies
    if (files.includes("package.json")) {
      const packageJson = await this.readJsonFile(
        path.join(codebasePath, "package.json")
      );
      analysis.dependencies.npm = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
    }

    // Python dependencies
    if (files.includes("requirements.txt")) {
      const requirements = await fs.readFile(
        path.join(codebasePath, "requirements.txt"),
        "utf8"
      );
      analysis.dependencies.pip = requirements
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));
    }

    // Java dependencies
    if (files.includes("pom.xml")) {
      analysis.dependencies.maven = "pom.xml";
    }

    if (files.includes("build.gradle")) {
      analysis.dependencies.gradle = "build.gradle";
    }

    // Go dependencies
    if (files.includes("go.mod")) {
      analysis.dependencies.go = "go.mod";
    }

    // PHP dependencies
    if (files.includes("composer.json")) {
      const composerJson = await this.readJsonFile(
        path.join(codebasePath, "composer.json")
      );
      analysis.dependencies.composer = composerJson.require || {};
    }

    // Ruby dependencies
    if (files.includes("Gemfile")) {
      analysis.dependencies.gem = "Gemfile";
    }
  }

  /**
   * Detect build and start commands
   */
  async detectCommands(codebasePath, analysis) {
    const files = await this.getFileList(codebasePath);

    // Node.js commands
    if (files.includes("package.json")) {
      const packageJson = await this.readJsonFile(
        path.join(codebasePath, "package.json")
      );

      if (packageJson.scripts) {
        if (packageJson.scripts.build) {
          analysis.buildCommands.push("npm run build");
        }
        if (packageJson.scripts.start) {
          analysis.startCommands.push("npm start");
        } else if (packageJson.main) {
          analysis.startCommands.push(`node ${packageJson.main}`);
        }
      }
    }

    // Python commands
    if (analysis.appType === "django") {
      analysis.startCommands.push("python manage.py runserver 0.0.0.0:8000");
    } else if (analysis.appType === "flask") {
      analysis.startCommands.push("python app.py");
    } else if (analysis.appType === "fastapi") {
      analysis.startCommands.push(
        "uvicorn main:app --host 0.0.0.0 --port 8000"
      );
    }

    // Java commands
    if (analysis.appType === "spring-boot") {
      analysis.buildCommands.push("mvn clean package");
      analysis.startCommands.push("java -jar target/*.jar");
    }

    // Go commands
    if (analysis.appType === "go") {
      analysis.buildCommands.push("go build");
      analysis.startCommands.push("./main");
    }

    // Docker commands
    if (analysis.dockerized) {
      analysis.buildCommands.push("docker build -t app .");
      analysis.startCommands.push("docker run -p 8080:8080 app");
    }
  }

  /**
   * Analyze configuration files
   */
  async analyzeConfiguration(codebasePath, analysis) {
    const files = await this.getFileList(codebasePath);
    const configFiles = {};

    // Common config files
    const configPatterns = [
      ".env",
      ".env.example",
      ".env.local",
      "config.json",
      "config.yaml",
      "config.yml",
      "docker-compose.yml",
      "docker-compose.yaml",
      "nginx.conf",
      "apache.conf",
    ];

    for (const pattern of configPatterns) {
      if (files.includes(pattern)) {
        configFiles[pattern] = await fs
          .readFile(path.join(codebasePath, pattern), "utf8")
          .catch(() => null);
      }
    }

    analysis.configFiles = configFiles;

    // Extract environment variables
    if (configFiles[".env"] || configFiles[".env.example"]) {
      const envContent = configFiles[".env"] || configFiles[".env.example"];
      const envVars = envContent
        .split("\n")
        .filter((line) => line.includes("=") && !line.startsWith("#"))
        .map((line) => line.split("=")[0].trim());

      analysis.environmentVariables = envVars;
    }

    // Detect port
    this.detectPort(configFiles, analysis);
  }

  /**
   * Detect database requirements
   */
  async detectDatabaseRequirements(codebasePath, analysis) {
    const patterns = {
      postgresql: ["postgresql", "psycopg2", "pg"],
      mysql: ["mysql", "mysql2", "pymysql"],
      mongodb: ["mongodb", "mongoose", "pymongo"],
      redis: ["redis", "redis-py"],
      sqlite: ["sqlite3", "sqlite"],
    };

    const dependencies = JSON.stringify(analysis.dependencies).toLowerCase();

    for (const [dbType, keywords] of Object.entries(patterns)) {
      if (keywords.some((keyword) => dependencies.includes(keyword))) {
        analysis.databaseRequirements.push(dbType);
      }
    }
  }

  /**
   * Generate deployment recommendations
   */
  async generateRecommendations(analysis) {
    const recommendations = [];

    // Deployment type recommendations
    if (analysis.staticFiles && analysis.appType === "static") {
      recommendations.push(
        "Consider using AWS S3 + CloudFront for static site hosting"
      );
    } else if (
      analysis.appType.includes("node") ||
      analysis.appType.includes("react")
    ) {
      recommendations.push("Consider using AWS EC2 with Node.js runtime");
    } else if (analysis.appType.includes("python")) {
      recommendations.push("Consider using AWS EC2 with Python runtime");
    }

    // Database recommendations
    if (analysis.databaseRequirements.length > 0) {
      recommendations.push(
        `Database required: ${analysis.databaseRequirements.join(", ")}`
      );
      recommendations.push(
        "Consider using AWS RDS for managed database service"
      );
    }

    // Docker recommendations
    if (analysis.dockerized) {
      recommendations.push(
        "Application is containerized - consider using AWS ECS or EKS"
      );
    } else {
      recommendations.push("Consider adding Dockerfile for containerization");
    }

    // Security recommendations
    if (analysis.environmentVariables.length > 0) {
      recommendations.push(
        "Environment variables detected - use AWS Systems Manager Parameter Store"
      );
    }

    analysis.recommendations = recommendations;
  }

  /**
   * Helper methods
   */
  extractRepoName(repositoryUrl) {
    return repositoryUrl.split("/").pop().replace(".git", "");
  }

  async getFileList(dir) {
    try {
      const files = await fs.readdir(dir);
      return files;
    } catch (error) {
      return [];
    }
  }

  async readJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  async containsPatterns(dir, patterns) {
    try {
      const files = await this.getAllFiles(dir);

      for (const file of files) {
        if (
          file.endsWith(".py") ||
          file.endsWith(".js") ||
          file.endsWith(".java")
        ) {
          const content = await fs.readFile(file, "utf8").catch(() => "");
          if (patterns.some((pattern) => content.includes(pattern))) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  async getAllFiles(dir) {
    const files = [];
    const items = await fs.readdir(dir).catch(() => []);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath).catch(() => null);

      if (
        stat?.isDirectory() &&
        !item.startsWith(".") &&
        item !== "node_modules"
      ) {
        files.push(...(await this.getAllFiles(fullPath)));
      } else if (stat?.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  detectPort(configFiles, analysis) {
    const portPatterns = [
      /PORT\s*=\s*(\d+)/i,
      /port\s*:\s*(\d+)/i,
      /listen\s+(\d+)/i,
      /:(\d{4,5})/g,
    ];

    const allConfig = Object.values(configFiles).join("\n");

    for (const pattern of portPatterns) {
      const match = allConfig.match(pattern);
      if (match && match[1]) {
        analysis.port = parseInt(match[1]);
        break;
      }
    }

    // Default ports by application type
    if (!analysis.port) {
      const defaultPorts = {
        "node-express": 3000,
        "next-js": 3000,
        react: 3000,
        flask: 5000,
        django: 8000,
        fastapi: 8000,
        "spring-boot": 8080,
        go: 8080,
        static: 80,
      };

      analysis.port = defaultPorts[analysis.appType] || 8080;
    }
  }
}

module.exports = RepositoryAnalyzer;
