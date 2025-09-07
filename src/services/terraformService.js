const fs = require("fs-extra");
const path = require("path");
const { execSync, spawn } = require("child_process");
const logger = require("../utils/logger");

class TerraformService {
  constructor() {
    this.terraformPath = process.env.TERRAFORM_PATH || "terraform";
  }

  /**
   * Generate Terraform configuration files
   */
  async generateTerraformConfig(deploymentConfig) {
    try {
      logger.info(
        `Generating Terraform configuration for ${deploymentConfig.deploymentId}`
      );

      const configs = {
        main: this.generateMainTerraform(deploymentConfig),
        variables: this.generateVariablesTerraform(deploymentConfig),
        outputs: this.generateOutputsTerraform(deploymentConfig),
        providers: this.generateProvidersTerraform(deploymentConfig),
      };

      return configs;
    } catch (error) {
      logger.error("Error generating Terraform configuration", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  generateMainTerraform(config) {
    const userDataScript = this.generateUserDataScript(config);

    return `
# EC2 Instance for application deployment
resource "aws_instance" "app_instance" {
  ami           = var.ami_id
  instance_type = var.instance_type
  
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  subnet_id              = aws_subnet.app_subnet.id
  
  user_data = base64encode(<<-EOF
${userDataScript}
EOF
  )
  
  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }
  
  tags = {
    Name        = "\${var.app_name}-instance"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# VPC Configuration
resource "aws_vpc" "app_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name        = "\${var.app_name}-vpc"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "app_igw" {
  vpc_id = aws_vpc.app_vpc.id
  
  tags = {
    Name        = "\${var.app_name}-igw"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Public Subnet
resource "aws_subnet" "app_subnet" {
  vpc_id                  = aws_vpc.app_vpc.id
  cidr_block              = var.subnet_cidr
  availability_zone       = var.availability_zone
  map_public_ip_on_launch = true
  
  tags = {
    Name        = "\${var.app_name}-subnet"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Route Table
resource "aws_route_table" "app_rt" {
  vpc_id = aws_vpc.app_vpc.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.app_igw.id
  }
  
  tags = {
    Name        = "\${var.app_name}-rt"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Route Table Association
resource "aws_route_table_association" "app_rta" {
  subnet_id      = aws_subnet.app_subnet.id
  route_table_id = aws_route_table.app_rt.id
}

# Security Group
resource "aws_security_group" "app_sg" {
  name_prefix = "\${var.app_name}-sg-"
  description = "Security group for \${var.app_name}"
  vpc_id      = aws_vpc.app_vpc.id
  
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "Application Port"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name        = "\${var.app_name}-sg"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Elastic IP for static public IP
resource "aws_eip" "app_eip" {
  instance = aws_instance.app_instance.id
  domain   = "vpc"
  
  tags = {
    Name        = "\${var.app_name}-eip"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
  
  depends_on = [aws_internet_gateway.app_igw]
}
`;
  }

  generateUserDataScript(config) {
    const repositoryUrl = config.repositoryUrl || "https://github.com/Arvo-AI/hello_world";
    const appPort = config.appPort || 8080;
    const appName = config.appName || 'application';
    const framework = config.framework || '';
    const language = config.language || '';
    const appType = config.appType || '';
    
    return `#!/bin/bash
set -e  # Exit on any error
exec > >(tee /var/log/user-data.log) 2>&1  # Log all output

echo "Starting deployment of ${appName} at $(date)"

# Update system
yum update -y

# Install git for cloning repository
yum install -y git

# Install application-specific packages
if [ "${framework}" = "flask" ] || [ "${framework}" = "django" ] || [ "${language}" = "python" ] || [ "${appType}" = "python" ]; then
    echo "Installing Python environment..."
    yum install -y python3 python3-pip python3-venv
    
    # Create app directory and clone repository
    mkdir -p /app
    cd /app
    
    echo "Cloning repository ${repositoryUrl}..."
    git clone ${repositoryUrl} ./app-source
    
    # Find the application directory (look for main Python file)
    MAIN_PY_FILE=""
    if [ -f "./app-source/app/app.py" ]; then
        APP_DIR="/app/app-source/app"
        MAIN_PY_FILE="app.py"
    elif [ -f "./app-source/app.py" ]; then
        APP_DIR="/app/app-source"
        MAIN_PY_FILE="app.py"
    elif [ -f "./app-source/main.py" ]; then
        APP_DIR="/app/app-source"
        MAIN_PY_FILE="main.py"
    elif [ -f "./app-source/server.py" ]; then
        APP_DIR="/app/app-source"
        MAIN_PY_FILE="server.py"
    else
        echo "Could not find main Python file, defaulting to app.py..."
        APP_DIR="/app/app-source"
        MAIN_PY_FILE="app.py"
    fi
    
    echo "Application directory: $APP_DIR"
    echo "Main Python file: $MAIN_PY_FILE"
    cd "$APP_DIR"
    
    # Create virtual environment
    python3 -m venv /app/venv
    source /app/venv/bin/activate
    
    # Install requirements if they exist
    if [ -f "requirements.txt" ]; then
        echo "Installing requirements from requirements.txt..."
        pip install -r requirements.txt
    else
        echo "No requirements.txt found, installing basic Flask..."
        pip install flask flask-cors gunicorn
    fi
    
    # Instead of modifying the original file, create a wrapper script
    echo "Creating wrapper script for Flask app..."
    cat > "$APP_DIR/run_app.py" << 'WRAPPER_EOF'
#!/usr/bin/env python3
import sys
import os

# Add the app directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the original app
if os.path.exists('app.py'):
    from app import app
elif os.path.exists('main.py'):
    from main import app
elif os.path.exists('server.py'):
    from server import app
else:
    print("No Flask app file found!")
    sys.exit(1)

if __name__ == "__main__":
    print("Starting Flask app on 0.0.0.0:${appPort}...")
    app.run(host="0.0.0.0", port=${appPort}, debug=False)
WRAPPER_EOF

    chmod +x "$APP_DIR/run_app.py"
    echo "Wrapper script created successfully"
    
    # Create systemd service for the Flask app
    cat > /etc/systemd/system/flask-app.service << 'EOL'
[Unit]
Description=Flask Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=$APP_DIR
Environment=PATH=/app/venv/bin
ExecStart=/app/venv/bin/python $APP_DIR/run_app.py
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOL
    
    # Replace placeholders with actual paths
    sed -i "s|\$APP_DIR|$APP_DIR|g" /etc/systemd/system/flask-app.service
    
    # Set proper permissions
    chown -R ec2-user:ec2-user /app
    
    # Enable and start the service
    systemctl daemon-reload
    systemctl enable flask-app
    systemctl start flask-app
    
    # Check service status and log it
    sleep 5
    systemctl status flask-app || true
    journalctl -u flask-app --no-pager -n 20 || true
    
    echo "Flask application deployment completed at $(date)"
    echo "Application should be accessible on port ${appPort}"
    echo "Service status logged above"
    
    # Wait a bit and test the application
    sleep 10
    echo "Testing application accessibility..."
    curl -f http://localhost:${appPort}/ && echo "✅ Application is responding locally" || echo "❌ Application not responding locally"
    
    echo "Deployment script finished successfully at $(date)"
    
elif [ "${framework}" = "express" ] || [ "${framework}" = "node" ] || [ "${appType}" = "node" ]; then
    echo "Installing Node.js environment..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    yum install -y nodejs npm
    
    # Create app directory and clone repository
    mkdir -p /app
    cd /app
    
    echo "Cloning repository ${repositoryUrl}..."
    git clone ${repositoryUrl} ./app-source
    cd /app/app-source
    
    # Find the main Node.js file
    MAIN_JS_FILE=""
    if [ -f "server.js" ]; then
        MAIN_JS_FILE="server.js"
    elif [ -f "app.js" ]; then
        MAIN_JS_FILE="app.js"
    elif [ -f "index.js" ]; then
        MAIN_JS_FILE="index.js"
    elif [ -f "src/server.js" ]; then
        MAIN_JS_FILE="src/server.js"
    elif [ -f "src/app.js" ]; then
        MAIN_JS_FILE="src/app.js"
    elif [ -f "src/index.js" ]; then
        MAIN_JS_FILE="src/index.js"
    else
        # Check package.json for main entry
        if [ -f "package.json" ] && command -v node >/dev/null; then
            MAIN_JS_FILE=$(node -e "try { console.log(require('./package.json').main || 'index.js'); } catch(e) { console.log('index.js'); }")
        else
            MAIN_JS_FILE="server.js"
        fi
    fi
    
    echo "Main Node.js file: $MAIN_JS_FILE"
    
    # Install npm dependencies
    if [ -f "package.json" ]; then
        echo "Installing npm dependencies..."
        npm install
    fi
    
    # Create systemd service for Node.js app
    cat > /etc/systemd/system/node-app.service << EOL
[Unit]
Description=Node.js Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/app/app-source
ExecStart=/usr/bin/node $MAIN_JS_FILE
Restart=always
RestartSec=3
Environment=PORT=${appPort}

[Install]
WantedBy=multi-user.target
EOL
    
    # Set proper permissions
    chown -R ec2-user:ec2-user /app
    
    # Enable and start the service
    systemctl daemon-reload
    systemctl enable node-app
    systemctl start node-app
    
    echo "Node.js application started successfully"
    
else
    echo "Installing Docker for containerized applications..."
    yum install -y docker
    systemctl start docker
    systemctl enable docker
    usermod -a -G docker ec2-user
    
    # Create app directory and clone repository
    mkdir -p /app
    cd /app
    
    echo "Cloning repository ${repositoryUrl}..."
    git clone ${repositoryUrl} ./app-source
    cd /app/app-source
    
    if [ -f "Dockerfile" ]; then
        echo "Building Docker image..."
        docker build -t myapp .
        
        echo "Running Docker container..."
        docker run -d -p ${appPort}:80 --name myapp-container myapp
    else
        echo "No Dockerfile found, creating simple web server..."
        echo "<h1>Hello World!</h1><p>Deployed at $(date)</p>" > index.html
        python3 -m http.server ${appPort} &
    fi
fi

echo "Deployment completed successfully at $(date)"
`;
  }

  generateVariablesTerraform(config) {
    const appName = config.appName || 'hello_world';
    const environment = config.environment || 'development';
    
    return `
variable "ami_id" {
  description = "AMI ID to use for the instance"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "app_name" {
  description = "Name of the application"
  type        = string
  default     = "${appName}"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "${environment}"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR block for subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "availability_zone" {
  description = "Availability zone for the subnet"
  type        = string
  default     = "us-east-1a"
}
`;
  }

  generateOutputsTerraform(config) {
    const appPort = config.appPort || 8080;
    
    return `
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.app_instance.id
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_eip.app_eip.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.app_instance.public_dns
}

output "application_url" {
  description = "URL to access the deployed application"
  value       = "http://\${aws_eip.app_eip.public_ip}:${appPort}"
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.app_vpc.id
}

output "subnet_id" {
  description = "ID of the subnet"
  value       = aws_subnet.app_subnet.id
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.app_sg.id
}
`;
  }

  generateProvidersTerraform(config) {
    return `
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.31.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = var.app_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}
`;
  }

  /**
   * Apply Terraform infrastructure
   */
  async applyInfrastructure(deploymentConfig) {
    try {
      const deploymentDir = path.join(
        process.cwd(),
        "temp",
        deploymentConfig.deploymentId,
        "hello_world",
        "terraform"
      );

      // Ensure deployment directory exists
      await fs.ensureDir(deploymentDir);

      // Generate and write Terraform configuration files
      const configs = await this.generateTerraformConfig(deploymentConfig);

      await Promise.all([
        fs.writeFile(path.join(deploymentDir, "main.tf"), configs.main),
        fs.writeFile(path.join(deploymentDir, "variables.tf"), configs.variables),
        fs.writeFile(path.join(deploymentDir, "outputs.tf"), configs.outputs),
        fs.writeFile(path.join(deploymentDir, "providers.tf"), configs.providers),
      ]);

      logger.info(`Terraform configuration written to ${deploymentDir}`);

      // Get the latest AMI ID
      const amiId = await this.getLatestAMI();
      logger.info(`Using AMI ID: ${amiId}`);

      // Prepare Terraform environment variables
      const terraformEnv = {
        ...process.env,
        TF_VAR_ami_id: amiId,
        TF_VAR_app_name: deploymentConfig.appName || deploymentConfig.deploymentId,
        TF_VAR_environment: deploymentConfig.environment || "development",
        TF_PLUGIN_CACHE_DIR: path.join(process.cwd(), ".terraform-cache"),
        TF_LOG: "ERROR"
      };

      // Ensure plugin cache directory exists
      await fs.ensureDir(terraformEnv.TF_PLUGIN_CACHE_DIR);

      // Initialize Terraform
      logger.info("Initializing Terraform...");
      await this.runTerraformCommand(["init"], deploymentDir, terraformEnv);

      // Plan Terraform
      logger.info("Planning Terraform deployment...");
      await this.runTerraformCommand(["plan"], deploymentDir, terraformEnv);

      // Apply Terraform
      logger.info("Applying Terraform configuration...");
      const applyResult = await this.runTerraformCommand(
        ["apply", "-auto-approve"],
        deploymentDir,
        terraformEnv
      );

      // Get outputs
      logger.info("Getting Terraform outputs...");
      const outputResult = await this.runTerraformCommand(
        ["output", "-json"],
        deploymentDir,
        terraformEnv
      );

      const outputs = JSON.parse(outputResult);
      const publicUrl = outputs.application_url?.value;

      logger.info("Infrastructure deployment completed successfully", {
        deploymentId: deploymentConfig.deploymentId,
        publicUrl: publicUrl,
        outputs: outputs,
      });

      return {
        success: true,
        outputs: outputs,
        publicUrl: publicUrl,
        message: "Infrastructure deployed successfully",
      };
    } catch (error) {
      logger.error("Error applying Terraform infrastructure", {
        error: error.message,
        stack: error.stack,
        deploymentId: deploymentConfig.deploymentId,
      });
      throw error;
    }
  }

  /**
   * Get the latest Amazon Linux 2 AMI ID
   */
  async getLatestAMI() {
    try {
      const command = `aws ec2 describe-images --owners amazon --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=state,Values=available" --query "Images | sort_by(@, &CreationDate) | [-1].ImageId" --output text`;
      
      const amiId = execSync(command, {
        encoding: "utf-8",
        timeout: 30000,
      }).trim();

      if (!amiId || amiId === "None") {
        throw new Error("Failed to retrieve AMI ID");
      }

      return amiId;
    } catch (error) {
      logger.error("Error getting latest AMI", { error: error.message });
      // Fallback to a known working AMI ID
      return "ami-0e95a5e2743ec9ec9"; // Amazon Linux 2 AMI as fallback
    }
  }

  /**
   * Run Terraform command
   */
  async runTerraformCommand(args, workingDir, env = {}) {
    return new Promise((resolve, reject) => {
      logger.info(`Running terraform command: ${args.join(" ")}`, {
        workingDir,
        args,
      });

      const childProcess = spawn(this.terraformPath, args, {
        cwd: workingDir,
        env: { ...process.env, ...env },
        stdio: ["inherit", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      childProcess.stdout.on("data", (data) => {
        const output = data.toString();
        stdout += output;
        logger.info("Terraform stdout", { output: output.trim() });
      });

      childProcess.stderr.on("data", (data) => {
        const output = data.toString();
        stderr += output;
        logger.warn("Terraform stderr", { output: output.trim() });
      });

      childProcess.on("close", (code) => {
        logger.info(`Terraform command completed with code ${code}`, {
          args,
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(
            new Error(
              `Terraform command failed with code ${code}: ${stderr || stdout}`
            )
          );
        }
      });

      childProcess.on("error", (error) => {
        logger.error("Terraform process error", { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Destroy Terraform infrastructure
   */
  async destroyInfrastructure(deploymentId) {
    try {
      const deploymentDir = path.join(
        process.cwd(),
        "temp",
        deploymentId,
        "hello_world",
        "terraform"
      );

      // Check if Terraform state exists
      const stateFile = path.join(deploymentDir, "terraform.tfstate");
      if (!(await fs.pathExists(stateFile))) {
        logger.warn(`No Terraform state found for deployment ${deploymentId}`);
        return {
          success: true,
          message: "No infrastructure to destroy",
        };
      }

      // Get AMI ID for destroy operation
      const amiId = await this.getLatestAMI();

      // Prepare Terraform environment variables
      const terraformEnv = {
        ...process.env,
        TF_VAR_ami_id: amiId,
        TF_VAR_app_name: deploymentId,
        TF_VAR_environment: "development",
        TF_PLUGIN_CACHE_DIR: path.join(process.cwd(), ".terraform-cache"),
        TF_LOG: "ERROR"
      };

      logger.info(`Destroying Terraform infrastructure for ${deploymentId}`);
      
      // Run terraform destroy
      await this.runTerraformCommand(
        ["destroy", "-auto-approve"],
        deploymentDir,
        terraformEnv
      );

      logger.info(`Infrastructure destroyed successfully for ${deploymentId}`);

      return {
        success: true,
        message: "Infrastructure destroyed successfully",
      };
    } catch (error) {
      logger.error("Error destroying Terraform infrastructure", {
        error: error.message,
        stack: error.stack,
        deploymentId,
      });
      throw error;
    }
  }
}

module.exports = TerraformService;
