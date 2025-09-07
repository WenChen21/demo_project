"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInterfaceProps {
  onNewDeployment: (deployment: any) => void;
}

interface DeploymentStatus {
  status: string;
  currentStep: number;
  totalSteps: number;
  logs: string[];
  analysis?: {
    framework: string;
    dependencies: string[];
  };
  deploymentStrategy?: {
    infrastructure: string;
    platform: string;
    estimatedCost: string;
  };
}

export default function ChatInterface({ onNewDeployment }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      type: "user" | "assistant";
      content: string;
      timestamp: Date;
      deploymentId?: string;
      isStreaming?: boolean;
    }>
  >([]);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Polling for deployment updates
  const startDeploymentPolling = (deploymentId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/deployment/${deploymentId}/status`);
        const statusData = await response.json();

        if (statusData.success) {
          // Update the streaming message with latest logs
          setMessages((prev) =>
            prev.map((msg) =>
              msg.deploymentId === deploymentId && msg.isStreaming
                ? {
                    ...msg,
                    content: formatDeploymentLogs(statusData.deployment),
                    isStreaming:
                      statusData.deployment.status !== "deployed" &&
                      statusData.deployment.status !== "failed",
                  }
                : msg
            )
          );
        }

        // Stop polling when deployment is complete or failed
        if (
          statusData.deployment?.status === "deployed" ||
          statusData.deployment?.status === "failed"
        ) {
          clearInterval(pollInterval);
          setActiveDeploymentId(null);
        }
      } catch (error) {
        console.error("Error polling deployment status:", error);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds
  };

  const formatDeploymentLogs = (deployment: any) => {
    let content = `🤖 **AI Deployment Assistant**\n\n`;
    content += `📊 **Progress:** ${getStatusLabel(deployment.status)}\n\n`;

    if (deployment.analysis) {
      content += `🔍 **Analysis Complete:**\n`;
      content += `• App Type: ${
        deployment.analysis.codeAnalysis?.appType || "Unknown"
      }\n`;
      content += `• Framework: ${
        deployment.analysis.codeAnalysis?.framework || "None detected"
      }\n`;
      content += `• Strategy: ${
        deployment.analysis.deploymentStrategy?.type || "Unknown"
      }\n\n`;
    }

    if (deployment.status === "deployed") {
      content += "🎉 **Deployment Complete!** Your application is now live.\n";
      if (deployment.publicUrl) {
        content += `🌐 **Live URL:** ${deployment.publicUrl}\n`;
      }
    } else if (deployment.status === "failed") {
      content += "❌ **Deployment Failed.** Check the logs for details.\n";
      if (deployment.error) {
        content += `**Error:** ${deployment.error}\n`;
      }
    } else if (deployment.status === "deploying") {
      content +=
        "🚀 **Deploying Infrastructure...** This may take a few minutes.\n";
    } else if (deployment.status === "analyzing") {
      content +=
        "🔍 **Analyzing Repository...** Detecting frameworks and dependencies.\n";
    } else {
      content += "⏳ **In Progress...** Updates will appear automatically.\n";
    }

    return content;
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      analyzing: "Analyzing Requirements",
      deploying: "Deploying Infrastructure",
      deployed: "Deployment Complete",
      failed: "Deployment Failed",
    };
    return labels[status] || status;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) return;

    // Extract GitHub URL from message if present
    const urlMatch = message.match(/https?:\/\/github\.com\/[^\s]+/);
    const extractedUrl = urlMatch ? urlMatch[0] : githubUrl;

    setIsLoading(true);

    // Add user message
    const userMessage = {
      type: "user" as const,
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("/api/deployment/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
          repositoryUrl: extractedUrl,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add initial assistant response
        const assistantMessage = {
          type: "assistant" as const,
          content: `✅ **Deployment Started**\n\nDeployment ID: \`${data.deploymentId}\`\n\n🔄 **Initializing...** Starting analysis and deployment process.`,
          timestamp: new Date(),
          deploymentId: data.deploymentId,
          isStreaming: true,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setActiveDeploymentId(data.deploymentId);

        // Start polling for deployment updates
        startDeploymentPolling(data.deploymentId);

        // Notify parent component
        onNewDeployment(data);
      } else {
        throw new Error(data.message || "Deployment failed");
      }
    } catch (error) {
      const errorMessage = {
        type: "assistant" as const,
        content: `❌ **Error:** ${
          error instanceof Error ? error.message : "Unknown error occurred"
        }`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setMessage("");
      setGithubUrl("");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const quickPrompts = [
    "Deploy my Next.js e-commerce app on AWS with auto-scaling: https://github.com/user/shop",
    "Set up a scalable Flask API with PostgreSQL on AWS",
    "Deploy React dashboard with auto-scaling and monitoring",
    "Launch Django blog with Redis cache and custom domain",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-gray-900">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-6 px-4">
        {messages.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center">
              <h1 className="text-5xl font-normal text-white mb-4">
                Deploy with AI
              </h1>
              <p className="text-gray-400 text-lg">
                Describe your deployment needs in natural language
              </p>
            </div>
          </div>
        ) : (
          // Messages
          <div className="max-w-4xl mx-auto space-y-6 py-6">
            {messages.map((msg, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    msg.type === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-green-600 text-white"
                  }`}
                >
                  {msg.type === "user" ? "U" : "AI"}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                  {msg.isStreaming && (
                    <div className="flex items-center space-x-2">
                      <div className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-xs text-green-400">
                        Live updates
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-sm font-medium text-white">
                  AI
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                    <span className="text-gray-400">
                      Analyzing repository...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="max-w-4xl mx-auto w-full px-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Input */}
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your app and deployment needs in detail. Include GitHub URL, preferred platform, budget, scaling requirements, and any special features needed..."
              className="w-full px-4 py-4 pr-24 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />

            {/* File Upload Button */}
            <label className="absolute bottom-3 right-12 w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center cursor-pointer transition-colors group">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".zip,.tar.gz"
                className="hidden"
              />
              <svg
                className="w-4 h-4 text-gray-300 group-hover:text-white transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </label>

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className="absolute bottom-3 right-3 w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors duration-200"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h14m-7-7l7 7-7 7"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* File indicator */}
          {file && (
            <div className="flex items-center justify-between bg-gray-800 border border-gray-600 rounded-xl px-4 py-3">
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="text-gray-300 text-sm">{file.name}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
        </form>

        {/* Quick Examples - shown under input when no messages */}
        {messages.length === 0 && (
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-2">
              Try these examples:
            </div>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setMessage(prompt)}
                  className="px-3 py-1.5 text-xs bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-full transition-colors duration-200 text-gray-400 hover:text-gray-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
