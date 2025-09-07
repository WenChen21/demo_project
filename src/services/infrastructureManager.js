const logger = require("../utils/logger");

class InfrastructureManager {
  constructor() {
    this.deploymentStrategies = {
      static: this.generateStaticStrategy,
      serverless: this.generateServerlessStrategy,
      container: this.generateContainerStrategy,
      vm: this.generateVMStrategy,
      kubernetes: this.generateKubernetesStrategy,
    };
  }

  /**
   * Determine the best deployment strategy based on analysis
   */
  async determineDeploymentStrategy({
    codeAnalysis,
    nlpAnalysis,
    description,
  }) {
    try {
      logger.info("Determining deployment strategy");

      const strategy = {
        type: "vm", // default
        reasoning: [],
        infrastructure: {},
        configuration: {},
        estimated_cost: "low",
        complexity: "medium",
      };

      // Priority 1: User explicitly specified deployment type
      if (nlpAnalysis.deploymentType) {
        strategy.type = nlpAnalysis.deploymentType;
        strategy.reasoning.push(
          `User requested ${nlpAnalysis.deploymentType} deployment`
        );
      }

      // Priority 2: Application characteristics
      else if (
        codeAnalysis.appType === "static" ||
        (codeAnalysis.staticFiles && !codeAnalysis.appType)
      ) {
        strategy.type = "static";
        strategy.reasoning.push(
          "Static files detected - optimal for CDN deployment"
        );
      }

      // Priority 3: Framework-specific recommendations
      else if (this.shouldUseServerless(codeAnalysis, nlpAnalysis)) {
        strategy.type = "serverless";
        strategy.reasoning.push("Suitable for serverless architecture");
      }

      // Priority 4: Containerization
      else if (
        codeAnalysis.dockerized ||
        this.shouldUseContainer(codeAnalysis, nlpAnalysis)
      ) {
        strategy.type = "container";
        strategy.reasoning.push(
          "Application is containerized or suitable for containers"
        );
      }

      // Priority 5: Complex applications need VMs or Kubernetes
      else if (this.shouldUseKubernetes(codeAnalysis, nlpAnalysis)) {
        strategy.type = "kubernetes";
        strategy.reasoning.push("Complex application requiring orchestration");
      }

      // Default to VM
      else {
        strategy.type = "vm";
        strategy.reasoning.push("Standard VM deployment for flexibility");
      }

      // Generate specific strategy details
      await this.generateStrategyDetails(strategy, codeAnalysis, nlpAnalysis);

      logger.info(`Deployment strategy determined: ${strategy.type}`, {
        reasoning: strategy.reasoning,
      });

      return strategy;
    } catch (error) {
      logger.error("Failed to determine deployment strategy:", error);
      throw new Error(`Strategy determination failed: ${error.message}`);
    }
  }

  /**
   * Generate deployment configuration
   */
  async generateDeploymentConfig({ analysis, deploymentId }) {
    try {
      logger.info(`Generating deployment config for ${deploymentId}`);

      const { codeAnalysis, nlpAnalysis, deploymentStrategy, repositoryUrl, description } = analysis;
      const cloudProvider = nlpAnalysis.cloudProvider || "aws";

      const config = {
        deploymentId,
        cloudProvider,
        strategy: deploymentStrategy,
        repositoryUrl: repositoryUrl || "https://github.com/Arvo-AI/hello_world",
        description: description || "",
        appName: `app-${deploymentId.substring(0, 8)}`,
        appType: codeAnalysis.appType || "python",
        framework: codeAnalysis.framework || "flask",
        language: codeAnalysis.language || "python",
        appPort: codeAnalysis.port || 8080,
        application: {
          name: `app-${deploymentId.substring(0, 8)}`,
          type: codeAnalysis.appType,
          framework: codeAnalysis.framework,
          language: codeAnalysis.language,
          port: codeAnalysis.port || 8080,
          buildCommands: codeAnalysis.buildCommands,
          startCommands: codeAnalysis.startCommands,
        },
        infrastructure: await this.generateInfrastructureConfig(
          deploymentStrategy,
          cloudProvider,
          codeAnalysis,
          nlpAnalysis
        ),
        networking: await this.generateNetworkingConfig(
          deploymentStrategy,
          cloudProvider,
          nlpAnalysis
        ),
        security: await this.generateSecurityConfig(nlpAnalysis),
        monitoring: await this.generateMonitoringConfig(nlpAnalysis),
        environment: {
          variables: codeAnalysis.environmentVariables,
          secrets: this.identifySecrets(codeAnalysis.environmentVariables),
        },
      };

      // Add database configuration if needed
      if (
        codeAnalysis.databaseRequirements.length > 0 ||
        nlpAnalysis.databaseNeeded
      ) {
        config.database = await this.generateDatabaseConfig(
          codeAnalysis.databaseRequirements,
          cloudProvider
        );
      }

      // Add storage configuration if needed
      if (nlpAnalysis.storageNeeded) {
        config.storage = await this.generateStorageConfig(cloudProvider);
      }

      logger.info(`Deployment config generated for ${deploymentId}`);
      return config;
    } catch (error) {
      logger.error(
        `Failed to generate deployment config for ${deploymentId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Deploy to infrastructure
   */
  async deployToInfrastructure({
    deploymentId,
    infrastructure,
    codebasePath,
    deploymentConfig,
  }) {
    try {
      logger.info(`Deploying application ${deploymentId} to infrastructure`);

      const deployment = {
        deploymentId,
        status: "deploying",
        infrastructure,
        publicUrl: null,
        internalUrl: null,
        deploymentSteps: [],
        startTime: new Date().toISOString(),
      };

      // Step 1: Prepare application code
      await this.prepareApplicationCode(
        codebasePath,
        deploymentConfig,
        deployment
      );

      // Step 2: Upload code to infrastructure
      await this.uploadCodeToInfrastructure(
        codebasePath,
        infrastructure,
        deployment
      );

      // Step 3: Configure application
      await this.configureApplication(
        infrastructure,
        deploymentConfig,
        deployment
      );

      // Step 4: Start application
      await this.startApplication(infrastructure, deploymentConfig, deployment);

      // Step 5: Verify deployment
      await this.verifyDeployment(infrastructure, deploymentConfig, deployment);

      deployment.status = "deployed";
      deployment.endTime = new Date().toISOString();
      deployment.publicUrl = this.generatePublicUrl(
        infrastructure,
        deploymentConfig
      );

      logger.info(`Application ${deploymentId} deployed successfully`, {
        publicUrl: deployment.publicUrl,
      });

      return deployment;
    } catch (error) {
      logger.error(`Deployment failed for ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Strategy determination helpers
   */
  shouldUseServerless(codeAnalysis, nlpAnalysis) {
    const serverlessFrameworks = ["flask", "fastapi", "express"];
    const hasStatelessArchitecture =
      !codeAnalysis.databaseRequirements.includes("sqlite");
    const lowComplexity =
      codeAnalysis.dependencies &&
      Object.keys(codeAnalysis.dependencies).length < 10;

    return (
      serverlessFrameworks.includes(codeAnalysis.framework) &&
      hasStatelessArchitecture &&
      lowComplexity &&
      nlpAnalysis.estimatedTraffic !== "high"
    );
  }

  shouldUseContainer(codeAnalysis, nlpAnalysis) {
    return (
      codeAnalysis.dockerized ||
      codeAnalysis.databaseRequirements.length > 0 ||
      nlpAnalysis.scalingRequirements === "high" ||
      ["django", "spring-boot", "laravel"].includes(codeAnalysis.framework)
    );
  }

  shouldUseKubernetes(codeAnalysis, nlpAnalysis) {
    return (
      nlpAnalysis.estimatedTraffic === "high" ||
      nlpAnalysis.scalingRequirements === "high" ||
      codeAnalysis.databaseRequirements.length > 1 ||
      nlpAnalysis.requirements.includes("high-availability")
    );
  }

  /**
   * Strategy detail generators
   */
  async generateStrategyDetails(strategy, codeAnalysis, nlpAnalysis) {
    const generator = this.deploymentStrategies[strategy.type];
    if (generator) {
      await generator.call(this, strategy, codeAnalysis, nlpAnalysis);
    }
  }

  generateStaticStrategy(strategy, codeAnalysis, nlpAnalysis) {
    strategy.infrastructure = {
      type: "cdn",
      services: ["s3", "cloudfront"],
      estimated_cost: "very_low",
      scalability: "excellent",
    };
    strategy.complexity = "low";
  }

  generateServerlessStrategy(strategy, codeAnalysis, nlpAnalysis) {
    strategy.infrastructure = {
      type: "serverless",
      services: ["lambda", "api_gateway"],
      estimated_cost: "low",
      scalability: "auto",
    };
    strategy.complexity = "medium";
  }

  generateContainerStrategy(strategy, codeAnalysis, nlpAnalysis) {
    strategy.infrastructure = {
      type: "container",
      services: ["ecs", "fargate", "alb"],
      estimated_cost: "medium",
      scalability: "good",
    };
    strategy.complexity = "medium";
  }

  generateVMStrategy(strategy, codeAnalysis, nlpAnalysis) {
    strategy.infrastructure = {
      type: "vm",
      services: ["ec2", "elb"],
      estimated_cost: "medium",
      scalability: "manual",
    };
    strategy.complexity = "medium";
  }

  generateKubernetesStrategy(strategy, codeAnalysis, nlpAnalysis) {
    strategy.infrastructure = {
      type: "kubernetes",
      services: ["eks", "alb"],
      estimated_cost: "high",
      scalability: "excellent",
    };
    strategy.complexity = "high";
  }

  /**
   * Configuration generators
   */
  async generateInfrastructureConfig(
    strategy,
    cloudProvider,
    codeAnalysis,
    nlpAnalysis
  ) {
    const baseConfig = {
      provider: cloudProvider,
      region: "us-east-1", // Default region
      type: strategy.type,
    };

    switch (strategy.type) {
      case "static":
        return {
          ...baseConfig,
          s3_bucket: `static-site-${Date.now()}`,
          cloudfront_distribution: true,
        };

      case "serverless":
        return {
          ...baseConfig,
          lambda_runtime: this.getLambdaRuntime(codeAnalysis.language),
          memory: 256,
          timeout: 30,
        };

      case "container":
        return {
          ...baseConfig,
          cluster_name: "app-cluster",
          service_name: "app-service",
          task_cpu: 256,
          task_memory: 512,
          desired_count: 1,
        };

      case "vm":
        return {
          ...baseConfig,
          instance_type: "t3.micro",
          ami: await this.getAMI(codeAnalysis.language, baseConfig.region),
          key_pair: "app-keypair",
        };

      case "kubernetes":
        return {
          ...baseConfig,
          cluster_name: "app-cluster",
          node_group: {
            instance_types: ["t3.medium"],
            scaling_config: {
              desired_size: 2,
              max_size: 10,
              min_size: 1,
            },
          },
        };

      default:
        return baseConfig;
    }
  }

  async generateNetworkingConfig(strategy, cloudProvider, nlpAnalysis) {
    return {
      vpc: {
        cidr: "10.0.0.0/16",
        enable_dns: true,
      },
      subnets: {
        public: ["10.0.1.0/24", "10.0.2.0/24"],
        private: ["10.0.3.0/24", "10.0.4.0/24"],
      },
      security_groups: {
        web: {
          ingress: [
            { port: 80, protocol: "tcp", cidr: "0.0.0.0/0" },
            { port: 443, protocol: "tcp", cidr: "0.0.0.0/0" },
          ],
        },
        app: {
          ingress: [{ port: 8080, protocol: "tcp", source_sg: "web" }],
        },
      },
      load_balancer: strategy.type !== "static",
    };
  }

  async generateSecurityConfig(nlpAnalysis) {
    return {
      https_enabled: nlpAnalysis.https !== false,
      ssl_certificate: nlpAnalysis.customDomain ? "acm" : "default",
      iam_roles: {
        execution_role: true,
        task_role: true,
      },
      secrets_manager: nlpAnalysis.requirements?.includes("security"),
      waf_enabled: nlpAnalysis.requirements?.includes("security"),
    };
  }

  async generateMonitoringConfig(nlpAnalysis) {
    return {
      cloudwatch_logs: true,
      cloudwatch_metrics: true,
      alarms: nlpAnalysis.monitoring !== false,
      xray_tracing: nlpAnalysis.requirements?.includes("performance"),
    };
  }

  async generateDatabaseConfig(databaseRequirements, cloudProvider) {
    const dbType = databaseRequirements[0] || "postgresql";

    return {
      engine: dbType,
      instance_class: "db.t3.micro",
      allocated_storage: 20,
      multi_az: false,
      backup_retention: 7,
      subnet_group: "app-db-subnet-group",
    };
  }

  async generateStorageConfig(cloudProvider) {
    return {
      s3_bucket: `app-storage-${Date.now()}`,
      versioning: true,
      encryption: true,
    };
  }

  /**
   * Deployment helpers
   */
  async prepareApplicationCode(codebasePath, deploymentConfig, deployment) {
    deployment.deploymentSteps.push({
      step: "prepare_code",
      status: "in_progress",
      timestamp: new Date().toISOString(),
    });

    // Simulate code preparation
    await this.delay(2000);

    deployment.deploymentSteps[deployment.deploymentSteps.length - 1].status =
      "completed";
  }

  async uploadCodeToInfrastructure(codebasePath, infrastructure, deployment) {
    deployment.deploymentSteps.push({
      step: "upload_code",
      status: "in_progress",
      timestamp: new Date().toISOString(),
    });

    // Simulate code upload
    await this.delay(3000);

    deployment.deploymentSteps[deployment.deploymentSteps.length - 1].status =
      "completed";
  }

  async configureApplication(infrastructure, deploymentConfig, deployment) {
    deployment.deploymentSteps.push({
      step: "configure_app",
      status: "in_progress",
      timestamp: new Date().toISOString(),
    });

    // Simulate configuration
    await this.delay(2000);

    deployment.deploymentSteps[deployment.deploymentSteps.length - 1].status =
      "completed";
  }

  async startApplication(infrastructure, deploymentConfig, deployment) {
    deployment.deploymentSteps.push({
      step: "start_app",
      status: "in_progress",
      timestamp: new Date().toISOString(),
    });

    // Simulate application start
    await this.delay(5000);

    deployment.deploymentSteps[deployment.deploymentSteps.length - 1].status =
      "completed";
  }

  async verifyDeployment(infrastructure, deploymentConfig, deployment) {
    deployment.deploymentSteps.push({
      step: "verify_deployment",
      status: "in_progress",
      timestamp: new Date().toISOString(),
    });

    // Simulate verification
    await this.delay(3000);

    deployment.deploymentSteps[deployment.deploymentSteps.length - 1].status =
      "completed";
  }

  generatePublicUrl(infrastructure, deploymentConfig) {
    // Use the actual application_url from Terraform outputs if available
    if (infrastructure.application_url && infrastructure.application_url.value) {
      return infrastructure.application_url.value;
    }
    
    // Fallback: construct URL from IP and port if available
    if (infrastructure.instance_public_ip && infrastructure.instance_public_ip.value) {
      const port = deploymentConfig.port || 8080;
      return `http://${infrastructure.instance_public_ip.value}:${port}`;
    }
    
    // Fallback: construct URL from DNS if available
    if (infrastructure.instance_public_dns && infrastructure.instance_public_dns.value) {
      const port = deploymentConfig.port || 8080;
      return `http://${infrastructure.instance_public_dns.value}:${port}`;
    }

    // Legacy fallback for mock URLs (should not be used in real deployments)
    const region = infrastructure.region || "us-east-1";
    switch (infrastructure.type) {
      case "static":
        return `https://d${Math.random()
          .toString(36)
          .substring(2, 15)}.cloudfront.net`;
      case "serverless":
        return `https://${Math.random()
          .toString(36)
          .substring(2, 15)}.execute-api.${region}.amazonaws.com/prod`;
      default:
        const port = deploymentConfig.port || 8080;
        return `http://ec2-${Math.floor(Math.random() * 255)}-${Math.floor(
          Math.random() * 255
        )}-${Math.floor(Math.random() * 255)}-${Math.floor(
          Math.random() * 255
        )}.${region}.compute.amazonaws.com:${port}`;
    }
  }

  /**
   * Helper methods
   */
  identifySecrets(envVars) {
    const secretPatterns = ["password", "secret", "key", "token", "api"];
    return envVars.filter((varName) =>
      secretPatterns.some((pattern) => varName.toLowerCase().includes(pattern))
    );
  }

  getLambdaRuntime(language) {
    const runtimes = {
      javascript: "nodejs18.x",
      python: "python3.9",
      java: "java11",
      go: "go1.x",
    };

    return runtimes[language] || "nodejs18.x";
  }

  async getAMI(language, region = "us-east-1") {
    // Get the latest Amazon Linux 2023 AMI ID dynamically
    try {
      const { execSync } = require('child_process');
      const amiId = execSync(
        `aws ec2 describe-images --owners amazon --filters "Name=name,Values=al2023-ami-*" "Name=architecture,Values=x86_64" --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' --output text --region ${region}`,
        { encoding: 'utf8' }
      ).trim();
      
      if (amiId && amiId.startsWith('ami-')) {
        logger.info(`Using AMI ID: ${amiId} for region ${region}`);
        return amiId;
      }
    } catch (error) {
      logger.warn(`Failed to get latest AMI, using fallback:`, error.message);
    }
    
    // Fallback to known good AMI IDs by region
    const fallbackAMIs = {
      "us-east-1": "ami-0b3a73487ec93ea0b",
      "us-west-2": "ami-0c02fb55956c7d316", 
      "eu-west-1": "ami-0c9c942bd7bf113a2",
      "ap-southeast-1": "ami-0df7a207adb9748c7"
    };
    
    return fallbackAMIs[region] || fallbackAMIs["us-east-1"];
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = InfrastructureManager;
