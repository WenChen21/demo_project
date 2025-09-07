const { GoogleGenerativeAI } = require("@google/generative-ai");
const natural = require("natural");
const logger = require("../utils/logger");

class NLPProcessor {
  constructor() {
    this.genAI = process.env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      : null;
    this.model = this.genAI
      ? this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      : null;

    this.stemmer = natural.PorterStemmer;
    this.tokenizer = new natural.WordTokenizer();

    // Keywords for deployment requirements
    this.cloudProviders = [
      "aws",
      "azure",
      "gcp",
      "google cloud",
      "amazon",
      "microsoft",
    ];
    this.deploymentTypes = [
      "serverless",
      "container",
      "vm",
      "kubernetes",
      "docker",
      "lambda",
      "ec2",
      "ecs",
      "fargate",
    ];
    this.environments = [
      "production",
      "staging",
      "development",
      "test",
      "demo",
    ];
    this.frameworks = [
      "flask",
      "django",
      "express",
      "react",
      "vue",
      "angular",
      "spring",
      "laravel",
    ];
  }

  /**
   * Process natural language deployment description
   */
  async processDeploymentDescription(description) {
    try {
      logger.info("Processing deployment description with NLP");

      const analysis = {
        originalText: description,
        intent: "deploy",
        cloudProvider: null,
        deploymentType: null,
        environment: "production",
        framework: null,
        requirements: [],
        confidence: 0,
        entities: {},
      };

      // Basic keyword extraction
      await this.extractKeywords(description, analysis);

      // Advanced analysis with Gemini if available
      if (this.model) {
        await this.analyzeWithGemini(description, analysis);
      } else {
        await this.analyzeWithRules(description, analysis);
      }

      logger.info("NLP analysis completed", {
        cloudProvider: analysis.cloudProvider,
        deploymentType: analysis.deploymentType,
        confidence: analysis.confidence,
      });

      return analysis;
    } catch (error) {
      logger.error("NLP processing failed:", error);
      throw new Error(`NLP processing failed: ${error.message}`);
    }
  }

  /**
   * Extract keywords from description
   */
  async extractKeywords(description, analysis) {
    const tokens = this.tokenizer.tokenize(description.toLowerCase());
    const stemmedTokens = tokens.map((token) => this.stemmer.stem(token));

    // Find cloud provider
    for (const provider of this.cloudProviders) {
      if (description.toLowerCase().includes(provider)) {
        analysis.cloudProvider = this.normalizeCloudProvider(provider);
        break;
      }
    }

    // Find deployment type
    for (const type of this.deploymentTypes) {
      if (description.toLowerCase().includes(type)) {
        analysis.deploymentType = this.normalizeDeploymentType(type);
        break;
      }
    }

    // Find environment
    for (const env of this.environments) {
      if (description.toLowerCase().includes(env)) {
        analysis.environment = env;
        break;
      }
    }

    // Find framework
    for (const framework of this.frameworks) {
      if (description.toLowerCase().includes(framework)) {
        analysis.framework = framework;
        break;
      }
    }

    // Extract requirements
    analysis.requirements = this.extractRequirements(description);
  }

  /**
   * Analyze with Google Gemini
   */
  async analyzeWithGemini(description, analysis) {
    try {
      const prompt = `
Analyze the following deployment request and extract structured information:

"${description}"

Please provide a JSON response with the following fields:
- cloudProvider: aws|azure|gcp|null
- deploymentType: vm|container|serverless|kubernetes|static|null
- environment: production|staging|development|test
- scalingRequirements: low|medium|high|auto
- databaseNeeded: boolean
- storageNeeded: boolean
- customDomain: boolean
- https: boolean
- monitoring: boolean
- backups: boolean
- estimatedTraffic: low|medium|high
- budget: low|medium|high|unlimited
- urgency: low|medium|high
- specificRequirements: array of strings

Respond only with valid JSON.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiAnalysis = JSON.parse(jsonMatch[0]);

        // Merge AI analysis with basic analysis
        Object.assign(analysis, aiAnalysis);
        analysis.confidence = 0.9;
      } else {
        throw new Error("No valid JSON found in Gemini response");
      }
    } catch (error) {
      logger.warn(
        "Gemini analysis failed, falling back to rule-based analysis:",
        error.message
      );
      await this.analyzeWithRules(description, analysis);
    }
  }

  /**
   * Rule-based analysis fallback
   */
  async analyzeWithRules(description, analysis) {
    const lowerDesc = description.toLowerCase();

    // Default cloud provider to AWS if not specified
    if (!analysis.cloudProvider) {
      analysis.cloudProvider = "aws";
    }

    // Determine deployment type based on keywords
    if (!analysis.deploymentType) {
      if (lowerDesc.includes("serverless") || lowerDesc.includes("lambda")) {
        analysis.deploymentType = "serverless";
      } else if (
        lowerDesc.includes("container") ||
        lowerDesc.includes("docker") ||
        lowerDesc.includes("kubernetes")
      ) {
        analysis.deploymentType = "container";
      } else if (
        lowerDesc.includes("static") ||
        lowerDesc.includes("website")
      ) {
        analysis.deploymentType = "static";
      } else {
        analysis.deploymentType = "vm";
      }
    }

    // Analyze additional requirements
    analysis.databaseNeeded = /database|db|sql|mongo|redis/i.test(description);
    analysis.storageNeeded = /storage|files|uploads|assets/i.test(description);
    analysis.customDomain = /domain|dns|custom url/i.test(description);
    analysis.https = /https|ssl|secure/i.test(description);
    analysis.monitoring = /monitor|logging|alerts/i.test(description);
    analysis.backups = /backup|snapshot|recovery/i.test(description);

    // Estimate traffic and budget
    if (/high.*(traffic|load|scale)/i.test(description)) {
      analysis.estimatedTraffic = "high";
      analysis.scalingRequirements = "high";
    } else if (/medium.*(traffic|load)/i.test(description)) {
      analysis.estimatedTraffic = "medium";
      analysis.scalingRequirements = "medium";
    } else {
      analysis.estimatedTraffic = "low";
      analysis.scalingRequirements = "low";
    }

    analysis.confidence = 0.7;
  }

  /**
   * Extract specific requirements from text
   */
  extractRequirements(description) {
    const requirements = [];

    // Security requirements
    if (/secure|security|auth|login/i.test(description)) {
      requirements.push("security");
    }

    // Performance requirements
    if (/fast|performance|speed|optimize/i.test(description)) {
      requirements.push("performance");
    }

    // Scalability requirements
    if (/scale|scalable|auto.?scale/i.test(description)) {
      requirements.push("auto-scaling");
    }

    // High availability
    if (/availability|uptime|reliable/i.test(description)) {
      requirements.push("high-availability");
    }

    // Cost optimization
    if (/cheap|cost|budget|affordable/i.test(description)) {
      requirements.push("cost-optimization");
    }

    return requirements;
  }

  /**
   * Generate chat response for deployment
   */
  async generateChatResponse({ message, analysisResult, deploymentResult }) {
    try {
      if (this.model) {
        return await this.generateGeminiResponse({
          message,
          analysisResult,
          deploymentResult,
        });
      } else {
        return this.generateRuleBasedResponse({
          message,
          analysisResult,
          deploymentResult,
        });
      }
    } catch (error) {
      logger.error("Failed to generate chat response:", error);
      return this.generateFallbackResponse(deploymentResult);
    }
  }

  /**
   * Generate Gemini-powered response
   */
  async generateGeminiResponse({ message, analysisResult, deploymentResult }) {
    const prompt = `
User requested: "${message}"

Application Analysis:
- Type: ${analysisResult.codeAnalysis?.appType}
- Framework: ${analysisResult.codeAnalysis?.framework}
- Language: ${analysisResult.codeAnalysis?.language}

Deployment Result:
- Status: ${deploymentResult.status}
- Public URL: ${deploymentResult.publicUrl || "Not available"}
- Infrastructure: ${deploymentResult.infrastructure?.type || "Unknown"}

Generate a friendly, informative response to the user about their deployment. Include:
1. What was deployed
2. Where it's accessible
3. Any important notes or next steps
4. Keep it concise and helpful

Response:
`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  /**
   * Generate rule-based response
   */
  generateRuleBasedResponse({ message, analysisResult, deploymentResult }) {
    const appType = analysisResult.codeAnalysis.appType;
    const framework = analysisResult.codeAnalysis.framework;
    const publicUrl = deploymentResult.publicUrl;

    if (deploymentResult.status === "deployed" && publicUrl) {
      return `✅ Great! I've successfully deployed your ${framework} application. 

🚀 **Your app is now live at:** ${publicUrl}

📋 **Deployment Summary:**
- Application Type: ${appType}
- Framework: ${framework}
- Infrastructure: ${deploymentResult.infrastructure?.type || "AWS EC2"}
- Status: ${deploymentResult.status}

🔗 You can now access your application using the URL above. The deployment includes automatic security groups and monitoring setup.

💡 **Next Steps:**
- Test your application functionality
- Set up custom domain if needed
- Configure monitoring and alerts
- Set up automated backups

Need any modifications or have questions about your deployment?`;
    } else {
      return `❌ Deployment encountered an issue. Please check the logs for more details. You can retry the deployment or contact support if the problem persists.`;
    }
  }

  /**
   * Generate fallback response
   */
  generateFallbackResponse(deploymentResult) {
    if (deploymentResult.status === "deployed") {
      return `Deployment completed successfully! Your application is now available at: ${
        deploymentResult.publicUrl || "the provided URL"
      }`;
    } else {
      return `Deployment status: ${deploymentResult.status}. Please check logs for more information.`;
    }
  }

  /**
   * Helper methods
   */
  normalizeCloudProvider(provider) {
    const mapping = {
      aws: "aws",
      amazon: "aws",
      azure: "azure",
      microsoft: "azure",
      gcp: "gcp",
      "google cloud": "gcp",
    };

    return mapping[provider.toLowerCase()] || "aws";
  }

  normalizeDeploymentType(type) {
    const mapping = {
      serverless: "serverless",
      lambda: "serverless",
      container: "container",
      docker: "container",
      kubernetes: "kubernetes",
      vm: "vm",
      ec2: "vm",
      static: "static",
    };

    return mapping[type.toLowerCase()] || "vm";
  }
}

module.exports = NLPProcessor;
