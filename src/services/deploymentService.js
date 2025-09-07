
const fs = require("fs-extra");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const RepositoryAnalyzer = require("./repositoryAnalyzer");
const NLPProcessor = require("./nlpProcessor");
const InfrastructureManager = require("./infrastructureManager");
const TerraformService = require("./terraformService");
const logger = require("../utils/logger");
const {
  createDeploymentDirectory,
  cleanupDeployment,
} = require("../utils/fileSystem");

class DeploymentService {
  constructor() {
    this.repositoryAnalyzer = new RepositoryAnalyzer();
    this.nlpProcessor = new NLPProcessor();
    this.infrastructureManager = new InfrastructureManager();
    this.terraformService = new TerraformService();
    this.deployments = new Map(); // In-memory storage for deployment state
  }

  /**
   * Analyze an application for deployment requirements
   */
  async analyzeApplication({
    deploymentId,
    description,
    repositoryUrl,
    uploadedFile,
  }) {
    try {
      logger.info(`Analyzing application for deployment ${deploymentId}`);

      // Create deployment directory
      const deploymentDir = await createDeploymentDirectory(deploymentId);

      // Step 1: Download/extract the repository
      let codebasePath;
      if (repositoryUrl) {
        codebasePath = await this.repositoryAnalyzer.cloneRepository(
          repositoryUrl,
          deploymentDir
        );
      } else if (uploadedFile) {
        codebasePath = await this.repositoryAnalyzer.extractZipFile(
          uploadedFile.path,
          deploymentDir
        );
      }

      // Step 2: Analyze the codebase
      const codeAnalysis = await this.repositoryAnalyzer.analyzeCodebase(
        codebasePath
      );

      // Step 3: Process natural language description
      const nlpAnalysis = await this.nlpProcessor.processDeploymentDescription(
        description
      );

      // Step 4: Determine deployment strategy
      const deploymentStrategy =
        await this.infrastructureManager.determineDeploymentStrategy({
          codeAnalysis,
          nlpAnalysis,
          description,
        });

      // Store analysis results
      const analysisResult = {
        deploymentId,
        timestamp: new Date().toISOString(),
        repositoryUrl,
        description,
        codeAnalysis,
        nlpAnalysis,
        deploymentStrategy,
        codebasePath,
        status: "analyzed",
      };

      this.deployments.set(deploymentId, analysisResult);

      logger.info(`Analysis completed for deployment ${deploymentId}`, {
        appType: codeAnalysis.appType,
        strategy: deploymentStrategy.type,
      });

      return analysisResult;
    } catch (error) {
      logger.error(`Analysis failed for deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Deploy an application based on analysis
   */
  async deployApplication({
    deploymentId,
    description,
    repositoryUrl,
    analysisId,
  }) {
    try {
      logger.info(`Starting deployment ${deploymentId}`);

      let analysisResult;

      // Get analysis result
      if (analysisId && this.deployments.has(analysisId)) {
        analysisResult = this.deployments.get(analysisId);
      } else {
        // Perform new analysis
        analysisResult = await this.analyzeApplication({
          deploymentId,
          description,
          repositoryUrl,
        });
      }

      // Update deployment status
      analysisResult.status = "deploying";
      analysisResult.deploymentStarted = new Date().toISOString();
      
      // Generate deployment steps for UI display
      analysisResult.steps = this.generateDeploymentSteps(analysisResult);
      
      this.deployments.set(deploymentId, analysisResult);

      // Step 1: Prepare deployment configuration
      const deploymentConfig =
        await this.infrastructureManager.generateDeploymentConfig({
          analysis: analysisResult,
          deploymentId,
        });

      // Step 2: Generate Terraform configuration
      const terraformConfig =
        await this.terraformService.generateTerraformConfig(deploymentConfig);

      // Step 3: Apply Terraform configuration
      const infrastructureResult =
        await this.terraformService.applyInfrastructure(
          {
            deploymentId,
            workingDirectory: analysisResult.codebasePath,
          },
          terraformConfig
        );

      // Step 4: Deploy application to infrastructure
      const deploymentResult =
        await this.infrastructureManager.deployToInfrastructure({
          deploymentId,
          infrastructure: infrastructureResult,
          codebasePath: analysisResult.codebasePath,
          deploymentConfig,
        });

      // Get the actual public URL from Terraform outputs (not from infrastructure manager)
      let publicUrl = null;
      if (infrastructureResult.outputs && infrastructureResult.outputs.application_url) {
        publicUrl = infrastructureResult.outputs.application_url.value;
      } else if (infrastructureResult.outputs && infrastructureResult.outputs.instance_public_ip) {
        publicUrl = `http://${infrastructureResult.outputs.instance_public_ip.value}:${deploymentConfig.port || 8080}`;
      } else {
        // Fallback to deployment result URL if no Terraform outputs available
        publicUrl = deploymentResult.publicUrl;
      }

      // Update deployment status
      analysisResult.status = "deployed";
      analysisResult.deploymentCompleted = new Date().toISOString();
      analysisResult.infrastructure = infrastructureResult;
      analysisResult.deployment = deploymentResult;
      analysisResult.publicUrl = publicUrl;
      
      // Generate deployment instructions for manual replication
      analysisResult.instructions = this.generateDeploymentInstructions(
        analysisResult, 
        infrastructureResult.outputs
      );

      this.deployments.set(deploymentId, analysisResult);

      logger.info(`Deployment completed for ${deploymentId}`, {
        publicUrl: publicUrl,
      });

      return analysisResult;
    } catch (error) {
      logger.error(`Deployment failed for ${deploymentId}:`, error);

      // Update deployment status
      if (this.deployments.has(deploymentId)) {
        const deployment = this.deployments.get(deploymentId);
        deployment.status = "failed";
        deployment.error = error.message;
        deployment.deploymentFailed = new Date().toISOString();
        this.deployments.set(deploymentId, deployment);
      }

      throw error;
    }
  }

  /**
   * Process chat-based deployment (combined analyze + deploy)
   */
  async processChatDeployment({
    deploymentId,
    message,
    repositoryUrl,
    uploadedFile,
  }) {
    try {
      logger.info(`Processing chat deployment ${deploymentId}`);

      // Initialize deployment status
      this.deployments.set(deploymentId, {
        deploymentId,
        status: "initializing",
        timestamp: new Date().toISOString(),
        message,
        repositoryUrl,
        steps: [],
      });

      // Step 1: Analyze the application
      this.updateDeploymentStatus(
        deploymentId,
        "analyzing",
        "Analyzing application..."
      );
      const analysisResult = await this.analyzeApplication({
        deploymentId,
        description: message,
        repositoryUrl,
        uploadedFile,
      });

      // Step 2: Deploy the application
      this.updateDeploymentStatus(
        deploymentId,
        "deploying",
        "Starting deployment..."
      );
      const deploymentResult = await this.deployApplication({
        deploymentId,
        description: message,
        analysisId: deploymentId,
      });

      // Step 3: Generate chat response
      this.updateDeploymentStatus(
        deploymentId,
        "completing",
        "Generating response..."
      );
      const chatResponse = await this.nlpProcessor.generateChatResponse({
        message,
        analysisResult,
        deploymentResult,
      });

      // Final result
      const finalResult = {
        analysis: analysisResult,
        deployment: deploymentResult,
        chatResponse,
        steps: this.generateDeploymentSteps(analysisResult),
        deploymentId,
        repositoryUrl,
      };

      this.updateDeploymentStatus(
        deploymentId,
        "completed",
        "Deployment completed successfully",
        finalResult
      );

      return finalResult;
    } catch (error) {
      logger.error(`Chat deployment failed for ${deploymentId}:`, error);
      this.updateDeploymentStatus(
        deploymentId,
        "failed",
        `Deployment failed: ${error.message}`,
        null,
        error
      );
      throw error;
    }
  }

  /**
   * Generate detailed deployment steps based on analysis
   */
  generateDeploymentSteps(analysisResult) {
    const steps = [];
    
    // Basic steps
    steps.push({
      id: 1,
      title: "Repository Analysis",
      description: "Analyzing codebase structure and dependencies",
      status: "completed"
    });
    
    steps.push({
      id: 2,
      title: "Infrastructure Configuration",
      description: "Generating Terraform configuration for AWS resources",
      status: "completed"
    });
    
    steps.push({
      id: 3,
      title: "Security Setup",
      description: "Configuring VPC, subnets, and security groups",
      status: "completed"
    });
    
    steps.push({
      id: 4,
      title: "EC2 Instance Provisioning",
      description: "Creating and configuring EC2 instance",
      status: "completed"
    });
    
    // Application-specific steps
    if (analysisResult.appType === 'flask' || analysisResult.framework === 'flask') {
      steps.push({
        id: 5,
        title: "Python Environment Setup",
        description: "Installing Python, pip, and creating virtual environment",
        status: "completed"
      });
      
      steps.push({
        id: 6,
        title: "Flask Application Deployment",
        description: "Cloning repository, installing dependencies, and configuring Flask",
        status: "completed"
      });
      
      steps.push({
        id: 7,
        title: "Service Configuration",
        description: "Setting up systemd service for Flask application",
        status: "completed"
      });
    } else if (analysisResult.framework === 'express' || analysisResult.language === 'javascript') {
      steps.push({
        id: 5,
        title: "Node.js Environment Setup",
        description: "Installing Node.js and npm",
        status: "completed"
      });
      
      steps.push({
        id: 6,
        title: "Node.js Application Deployment",
        description: "Cloning repository and installing npm dependencies",
        status: "completed"
      });
      
      steps.push({
        id: 7,
        title: "Service Configuration",
        description: "Setting up systemd service for Node.js application",
        status: "completed"
      });
    } else {
      steps.push({
        id: 5,
        title: "Application Environment Setup",
        description: "Installing required runtime and dependencies",
        status: "completed"
      });
      
      steps.push({
        id: 6,
        title: "Application Deployment",
        description: "Cloning repository and configuring application",
        status: "completed"
      });
      
      steps.push({
        id: 7,
        title: "Service Configuration",
        description: "Setting up application service",
        status: "completed"
      });
    }
    
    steps.push({
      id: 8,
      title: "Network Configuration",
      description: "Configuring Elastic IP and DNS",
      status: "completed"
    });
    
    steps.push({
      id: 9,
      title: "Application Startup",
      description: "Starting application service and verifying deployment",
      status: "completed"
    });
    
    return steps;
  }

  /**
   * Update deployment status
   */
  updateDeploymentStatus(
    deploymentId,
    status,
    message,
    result = null,
    error = null
  ) {
    const deployment = this.deployments.get(deploymentId) || {};
    const step = {
      timestamp: new Date().toISOString(),
      status,
      message,
    };

    if (error) {
      step.error = error.message;
    }

    const updatedDeployment = {
      ...deployment,
      deploymentId,
      status,
      currentStep: message,
      lastUpdated: new Date().toISOString(),
      steps: [...(deployment.steps || []), step],
    };

    if (result) {
      updatedDeployment.result = result;
    }

    if (error) {
      updatedDeployment.error = error.message;
    }

    this.deployments.set(deploymentId, updatedDeployment);
    logger.info(`Deployment ${deploymentId} status updated:`, {
      status,
      message,
    });
  }

  /**
   * Get all deployments
   */
  async getAllDeployments() {
    const deployments = Array.from(this.deployments.values());
    return deployments.map((deployment) => ({
      deploymentId: deployment.deploymentId,
      status: deployment.status,
      message: deployment.message,
      repositoryUrl: deployment.repositoryUrl,
      timestamp: deployment.timestamp,
      lastUpdated: deployment.lastUpdated,
      currentStep: deployment.currentStep,
      publicUrl: deployment.publicUrl,
      deploymentCompleted: deployment.deploymentCompleted,
      error: deployment.error,
    }));
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId) {
    // If deployment is in memory, return it
    if (this.deployments.has(deploymentId)) {
      const deployment = this.deployments.get(deploymentId);
      return {
        deploymentId,
        status: deployment.status,
        timestamp: deployment.timestamp,
        publicUrl: deployment.publicUrl,
        error: deployment.error,
        progress: this.calculateProgress(deployment),
        instructions: deployment.instructions || null,
      };
    }

    // If not in memory, try to reconstruct from filesystem
    try {
      const deploymentDir = path.join(
        process.env.TEMP_DIR || "./temp",
        deploymentId
      );
      const terraformDir = path.join(deploymentDir, "hello_world", "terraform");
      const terraformStateFile = path.join(terraformDir, "terraform.tfstate");

      // Check if deployment directory and terraform state exists
      if (
        (await fs.pathExists(deploymentDir)) &&
        (await fs.pathExists(terraformStateFile))
      ) {
        logger.info(
          `Reconstructing deployment status for ${deploymentId} from filesystem`
        );

        // Try to get Terraform outputs to determine if deployment was successful
        try {
          const terraformOutputs =
            await this.terraformService.getTerraformOutputs(terraformDir);

          let publicUrl = null;
          if (terraformOutputs.application_url) {
            publicUrl = terraformOutputs.application_url.value;
          } else if (terraformOutputs.instance_public_ip) {
            publicUrl = `http://${terraformOutputs.instance_public_ip.value}:8080`;
          }

          // Generate steps for reconstructed deployment (assume completed)
          const steps = this.generateDeploymentSteps({ 
            appType: 'unknown', 
            framework: 'flask' // Default assumption for reconstruction
          });
          const instructions = this.generateDeploymentInstructions({
            repositoryUrl: null,
            appType: 'flask',
            framework: 'flask',
          }, terraformOutputs);

          // Reconstruct deployment object and store it back in memory
          const reconstructedDeployment = {
            deploymentId,
            status: "completed",
            timestamp: new Date().toISOString(),
            publicUrl: publicUrl,
            infrastructure: terraformOutputs,
            steps: steps,
            instructions: instructions,
            reconstructed: true,
          };

          this.deployments.set(deploymentId, reconstructedDeployment);

          return {
            deploymentId,
            status: "completed",
            timestamp: reconstructedDeployment.timestamp,
            publicUrl: publicUrl,
            error: null,
            progress: 100,
            note: "Status reconstructed from deployment artifacts",
            instructions: instructions,
          };
        } catch (terraformError) {
          logger.warn(
            `Failed to get Terraform outputs for ${deploymentId}:`,
            terraformError.message
          );

          // If terraform outputs fail, but state exists, assume it's in progress or failed
          return {
            deploymentId,
            status: "unknown",
            timestamp: new Date().toISOString(),
            publicUrl: null,
            error: null,
            progress: 50,
            note: "Deployment artifacts found but status unclear",
          };
        }
      }

      // No deployment artifacts found
      throw new Error("Deployment not found");
    } catch (error) {
      logger.warn(
        `Failed to reconstruct deployment status for ${deploymentId}:`,
        error.message
      );
      throw new Error("Deployment not found");
    }
  }

  /**
   * Get deployment logs
   */
  async getDeploymentLogs(deploymentId) {
    try {
      const logs = [];
      
      // Try to get logs from the in-memory deployment first
      if (this.deployments.has(deploymentId)) {
        const deployment = this.deployments.get(deploymentId);
        if (deployment.logs) {
          return deployment.logs;
        }
      }

      // Fallback: Look for logs in various locations
      const tempDir = process.env.TEMP_DIR || "./temp";
      const deploymentDir = path.join(tempDir, deploymentId);
      
      // Check if deployment directory exists
      if (await fs.pathExists(deploymentDir)) {
        // Look for common log files in the deployment directory
        const possibleLogPaths = [
          path.join(deploymentDir, "deployment.log"),
          path.join(deploymentDir, "terraform.log"),
          path.join(deploymentDir, "build.log"),
        ];

        for (const logPath of possibleLogPaths) {
          if (await fs.pathExists(logPath)) {
            const content = await fs.readFile(logPath, "utf8");
            logs.push({
              file: path.basename(logPath),
              content: content.split("\n").filter((line) => line.trim()),
              timestamp: new Date().toISOString()
            });
          }
        }

        // Also check for terraform-specific logs in terraform directory
        const terraformDir = path.join(deploymentDir, "hello_world", "terraform");
        if (await fs.pathExists(terraformDir)) {
          const terraformLogPath = path.join(terraformDir, "terraform.log");
          if (await fs.pathExists(terraformLogPath)) {
            const content = await fs.readFile(terraformLogPath, "utf8");
            logs.push({
              file: "terraform.log",
              content: content.split("\n").filter((line) => line.trim()),
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // If no logs found, create a basic status log from current deployment info
      if (logs.length === 0) {
        const status = await this.getDeploymentStatus(deploymentId);
        if (status) {
          logs.push({
            file: "deployment-status.log",
            content: [
              `Deployment ID: ${deploymentId}`,
              `Status: ${status.status}`,
              `Timestamp: ${status.timestamp}`,
              status.publicUrl ? `Public URL: ${status.publicUrl}` : null,
              status.error ? `Error: ${status.error}` : null,
              "Note: Detailed logs may not be available for this deployment"
            ].filter(Boolean),
            timestamp: new Date().toISOString()
          });
        }
      }

      return logs;
    } catch (error) {
      logger.error(`Failed to get logs for deployment ${deploymentId}:`, error);
      // Return basic error log instead of throwing
      return [{
        file: "error.log",
        content: [`Failed to retrieve logs: ${error.message}`],
        timestamp: new Date().toISOString()
      }];
    }
  }

  /**
   * Destroy a deployment
   */
  async destroyDeployment(deploymentId) {
    try {
      logger.info(`Destroying deployment ${deploymentId}`);

      if (!this.deployments.has(deploymentId)) {
        throw new Error("Deployment not found");
      }

      const deployment = this.deployments.get(deploymentId);

      // Destroy infrastructure using Terraform
      if (deployment.infrastructure) {
        await this.terraformService.destroyInfrastructure({
          deploymentId,
          workingDir: deployment.codebasePath,
        });
      }

      // Cleanup local files
      await cleanupDeployment(deploymentId);

      // Remove from memory
      this.deployments.delete(deploymentId);

      logger.info(`Deployment ${deploymentId} destroyed successfully`);
    } catch (error) {
      logger.error(`Failed to destroy deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate deployment progress
   */
  calculateProgress(deployment) {
    const stages = ["analyzed", "deploying", "deployed", "failed"];
    const currentStageIndex = stages.indexOf(deployment.status);

    if (currentStageIndex === -1) return 0;
    if (deployment.status === "failed") return 100;

    return Math.round(((currentStageIndex + 1) / (stages.length - 1)) * 100);
  }

  /**
   * Generate deployment steps based on application analysis
   */
  generateDeploymentSteps(analysisResult) {
    const steps = [];
    const appType = analysisResult.appType || 'web';
    const framework = analysisResult.framework || analysisResult.language || 'generic';
    
    // Step 1: Infrastructure Setup
    steps.push({
      id: 'infrastructure',
      title: 'Setting up AWS Infrastructure',
      description: 'Creating VPC, subnets, security groups, and EC2 instance with Elastic IP',
      status: 'pending',
      details: [
        'Allocating static Elastic IP address',
        'Creating Virtual Private Cloud (VPC)',
        'Setting up public subnet with internet gateway',
        'Configuring security groups for web traffic',
        'Launching EC2 instance (t3.micro)'
      ]
    });

    // Step 2: System Configuration
    steps.push({
      id: 'system',
      title: 'Configuring Server Environment',
      description: 'Installing system dependencies and runtime environment',
      status: 'pending',
      details: this.getSystemConfigDetails(framework)
    });

    // Step 3: Application Deployment
    steps.push({
      id: 'application',
      title: 'Deploying Application',
      description: 'Cloning repository and installing dependencies',
      status: 'pending',
      details: this.getApplicationDeploymentDetails(framework, analysisResult)
    });

    // Step 4: Service Setup
    steps.push({
      id: 'service',
      title: 'Configuring Application Service',
      description: 'Setting up systemd service and starting application',
      status: 'pending',
      details: this.getServiceSetupDetails(framework)
    });

    // Step 5: Verification
    steps.push({
      id: 'verification',
      title: 'Verifying Deployment',
      description: 'Testing application accessibility and health',
      status: 'pending',
      details: [
        'Checking service status',
        'Verifying port accessibility',
        'Testing HTTP response on port 8080',
        'Confirming application is live on Elastic IP'
      ]
    });

    return steps;
  }

  /**
   * Get system configuration details based on framework
   */
  getSystemConfigDetails(framework) {
    switch (framework.toLowerCase()) {
      case 'flask':
      case 'django':
      case 'python':
        return [
          'Updating system packages (yum update)',
          'Installing Python 3 and pip',
          'Installing Git for repository cloning',
          'Creating application directory structure',
          'Setting up Python virtual environment'
        ];
      case 'node':
      case 'express':
      case 'javascript':
      case 'nextjs':
      case 'react':
        return [
          'Updating system packages (yum update)',
          'Installing Node.js 18.x LTS',
          'Installing npm package manager',
          'Installing Git for repository cloning',
          'Creating application directory structure'
        ];
      default:
        return [
          'Updating system packages',
          'Installing runtime dependencies',
          'Installing Git for repository cloning',
          'Creating application directory structure'
        ];
    }
  }

  /**
   * Get application deployment details based on framework
   */
  getApplicationDeploymentDetails(framework, analysisResult) {
    const repositoryUrl = analysisResult.repositoryUrl || 'application repository';
    
    switch (framework.toLowerCase()) {
      case 'flask':
      case 'django':
      case 'python':
        return [
          `Cloning repository: ${repositoryUrl}`,
          'Detecting main Python application file (app.py, main.py, server.py)',
          'Installing Python dependencies from requirements.txt',
          'Configuring Flask app to run on 0.0.0.0:8080',
          'Setting up application directory permissions'
        ];
      case 'node':
      case 'express':
      case 'javascript':
      case 'nextjs':
      case 'react':
        return [
          `Cloning repository: ${repositoryUrl}`,
          'Detecting main Node.js entry point (server.js, app.js, index.js)',
          'Installing npm dependencies (npm install)',
          'Configuring application port to 8080',
          'Setting up application directory permissions'
        ];
      default:
        return [
          `Cloning repository: ${repositoryUrl}`,
          'Detecting application entry point',
          'Installing application dependencies',
          'Configuring application settings',
          'Setting up directory permissions'
        ];
    }
  }

  /**
   * Get service setup details based on framework
   */
  getServiceSetupDetails(framework) {
    switch (framework.toLowerCase()) {
      case 'flask':
      case 'django':
      case 'python':
        return [
          'Creating systemd service file for Flask app',
          'Configuring service to auto-start on boot',
          'Setting correct working directory and permissions',
          'Starting flask-app.service',
          'Enabling automatic restart on failure'
        ];
      case 'node':
      case 'express':
      case 'javascript':
      case 'nextjs':
      case 'react':
        return [
          'Creating systemd service file for Node.js app',
          'Configuring service to auto-start on boot',
          'Setting correct working directory and permissions',
          'Starting node-app.service',
          'Enabling automatic restart on failure'
        ];
      default:
        return [
          'Creating systemd service file',
          'Configuring service to auto-start on boot',
          'Setting correct working directory and permissions',
          'Starting application service',
          'Enabling automatic restart on failure'
        ];
    }
  }

  /**
   * Generate human-readable deployment instructions for manual replication
   */
  generateDeploymentInstructions(analysisResult, terraformOutputs) {
    const instructions = [];
    instructions.push("1. Clone the repository:");
    if (analysisResult.repositoryUrl) {
      instructions.push(`   git clone ${analysisResult.repositoryUrl}`);
    } else {
      instructions.push("   # (Upload your codebase manually)");
    }
    instructions.push("");
    instructions.push("2. Analyze the codebase and determine dependencies:");
    instructions.push("   # Inspect requirements.txt, package.json, or other manifest files");
    instructions.push("");
    instructions.push("3. Generate and apply Terraform configuration:");
    instructions.push("   # (Assumes AWS credentials are configured)");
    instructions.push("   terraform init");
    instructions.push("   terraform apply -auto-approve");
    instructions.push("");
    instructions.push("4. Wait for resources to be provisioned (EC2, VPC, Security Groups, EIP, etc.)");
    instructions.push("");
    instructions.push("5. SSH into the EC2 instance:");
    if (terraformOutputs && terraformOutputs.instance_public_ip) {
      instructions.push(`   ssh -i <your-key.pem> ec2-user@${terraformOutputs.instance_public_ip.value}`);
    } else {
      instructions.push("   ssh -i <your-key.pem> ec2-user@<EC2_PUBLIC_IP>");
    }
    instructions.push("");
    if (analysisResult.appType === 'flask' || analysisResult.framework === 'flask') {
      instructions.push("6. Set up Python environment and deploy Flask app:");
      instructions.push("   sudo yum install -y python3 python3-pip git");
      instructions.push("   python3 -m venv venv && source venv/bin/activate");
      instructions.push("   pip install -r requirements.txt");
      instructions.push("   python app.py");
    } else if (analysisResult.framework === 'express' || analysisResult.language === 'javascript') {
      instructions.push("6. Set up Node.js environment and deploy Node app:");
      instructions.push("   sudo yum install -y nodejs npm git");
      instructions.push("   npm install");
      instructions.push("   npm start");
    } else {
      instructions.push("6. Set up application environment and run your app:");
      instructions.push("   # Install required runtime and dependencies");
      instructions.push("   # Start your application manually");
    }
    instructions.push("");
    instructions.push("7. (Optional) Set up systemd service for auto-start on boot");
    instructions.push("   # Create a systemd service file and enable it");
    instructions.push("");
    instructions.push("8. Access your application in the browser:");
    if (terraformOutputs && terraformOutputs.application_url) {
      instructions.push(`   Open: ${terraformOutputs.application_url.value}`);
    } else {
      instructions.push("   Open: http://<EC2_PUBLIC_IP>:<PORT>");
    }
    return instructions;
  }
}

module.exports = DeploymentService;
