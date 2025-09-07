"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Trash2,
  Eye,
} from "lucide-react";

interface Deployment {
  deploymentId: string;
  status: string;
  timestamp: string;
  deploymentCompleted?: string;
  publicUrl?: string;
  error?: string;
  analysis?: any;
}

interface DeploymentStatusProps {
  deployments: Deployment[];
  onRefresh: () => void;
}

export default function DeploymentStatus({
  deployments,
  onRefresh,
}: DeploymentStatusProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(
    null
  );
  const [deploymentDetails, setDeploymentDetails] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [steps, setSteps] = useState<any[]>([]);
  const [instructions, setInstructions] = useState<string[]>([]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "initializing":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1 animate-pulse" />
            Initializing
          </span>
        );
      case "analyzing":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertCircle className="w-3 h-3 mr-1 animate-pulse" />
            Analyzing
          </span>
        );
      case "deploying":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1 animate-spin" />
            Deploying
          </span>
        );
      case "completing":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
            <Clock className="w-3 h-3 mr-1 animate-pulse" />
            Completing
          </span>
        );
      case "completed":
      case "deployed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Deployed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </span>
        );
    }
  };

  const viewDeploymentDetails = async (deploymentId: string) => {
    try {
      const [statusResponse, logsResponse, stepsResponse] = await Promise.all([
        fetch(`/api/deployment/${deploymentId}/status`),
        fetch(`/api/deployment/${deploymentId}/logs`),
        fetch(`/api/deployment/${deploymentId}/steps`),
      ]);

      const statusData = await statusResponse.json();
      const logsData = await logsResponse.json();
      const stepsData = await stepsResponse.json();

      if (statusData.success) {
        setDeploymentDetails(statusData.status || statusData.deployment);
        
        // Get instructions from status response or fetch separately
        if (statusData.status?.instructions) {
          setInstructions(statusData.status.instructions);
        } else {
          // Fallback: fetch instructions separately
          try {
            const instructionsResponse = await fetch(`/api/deployment/${deploymentId}/instructions`);
            const instructionsData = await instructionsResponse.json();
            if (instructionsData.success && instructionsData.instructions) {
              setInstructions(instructionsData.instructions);
            } else {
              setInstructions([]);
            }
          } catch (error) {
            console.error("Failed to fetch instructions:", error);
            setInstructions([]);
          }
        }
      }

      if (stepsData.success && stepsData.steps) {
        setSteps(stepsData.steps);
      } else {
        setSteps([]);
      }

      if (logsData.success && logsData.logs) {
        // Handle the new logs format
        const formattedLogs: string[] = [];
        logsData.logs.forEach((logFile: any) => {
          if (logFile.file) {
            formattedLogs.push(`=== ${logFile.file} ===`);
          }
          if (logFile.content && Array.isArray(logFile.content)) {
            logFile.content.forEach((line: string) => {
              if (line.trim()) {
                formattedLogs.push(line);
              }
            });
          }
          formattedLogs.push(''); // Add empty line between log files
        });
        setLogs(formattedLogs);
      } else {
        setLogs(['No logs available for this deployment']);
      }

      setSelectedDeployment(deploymentId);
    } catch (error) {
      console.error("Failed to fetch deployment details:", error);
      setLogs([`Error fetching logs: ${error}`]);
    }
  };

  const destroyDeployment = async (deploymentId: string) => {
    if (
      !confirm(
        `Are you sure you want to destroy deployment ${deploymentId}? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/deployment/${deploymentId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        alert("Deployment destroyed successfully!");
        onRefresh();
        if (selectedDeployment === deploymentId) {
          setSelectedDeployment(null);
        }
      } else {
        alert(`Failed to destroy deployment: ${data.message}`);
      }
    } catch (error: any) {
      alert(`Error destroying deployment: ${error.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Deployments
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and manage your application deployments
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deployments List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              All Deployments ({deployments.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {deployments.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No deployments found. Start by creating a new deployment!
              </div>
            ) : (
              deployments.map((deployment) => (
                <div
                  key={deployment.deploymentId}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors`}
                  onClick={() => viewDeploymentDetails(deployment.deploymentId)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(deployment.status)}
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                        {deployment.deploymentId.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          viewDeploymentDetails(deployment.deploymentId);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {deployment.publicUrl && (
                        <a
                          href={deployment.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Open application"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          destroyDeployment(deployment.deploymentId);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Destroy deployment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      Started: {new Date(deployment.timestamp).toLocaleString()}
                    </div>
                    {deployment.deploymentCompleted && (
                      <div>
                        Completed:{" "}
                        {new Date(
                          deployment.deploymentCompleted
                        ).toLocaleString()}
                      </div>
                    )}
                    {deployment.publicUrl && (
                      <div className="truncate">
                        URL: {deployment.publicUrl}
                      </div>
                    )}
                    {deployment.error && (
                      <div className="text-red-600 dark:text-red-400">
                        Error: {deployment.error}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Deployment Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {selectedDeployment
                ? `Details: ${selectedDeployment.slice(0, 8)}...`
                : "Deployment Details"}
            </h2>
          </div>

          <div className="p-6">
            {!selectedDeployment ? (
              <div className="text-center text-gray-500 dark:text-gray-400">
                Select a deployment to view details
              </div>
            ) : deploymentDetails ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Status
                  </h3>
                  {getStatusBadge(deploymentDetails.status)}
                </div>

                {deploymentDetails.analysis && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Analysis
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                      <div>
                        App Type:{" "}
                        {deploymentDetails.analysis.codeAnalysis?.appType ||
                          "Unknown"}
                      </div>
                      <div>
                        Framework:{" "}
                        {deploymentDetails.analysis.codeAnalysis?.framework ||
                          "None"}
                      </div>
                      <div>
                        Strategy:{" "}
                        {deploymentDetails.analysis.deploymentStrategy?.type ||
                          "Unknown"}
                      </div>
                    </div>
                  </div>
                )}

                {deploymentDetails.publicUrl && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Public URL
                    </h3>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <a
                          href={deploymentDetails.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 break-all font-mono text-sm"
                        >
                          {deploymentDetails.publicUrl}
                        </a>
                        <a
                          href={deploymentDetails.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 flex-shrink-0 inline-flex items-center px-2.5 py-1.5 border border-blue-300 dark:border-blue-600 text-xs font-medium rounded text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open
                        </a>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Click to access your deployed application
                      </p>
                    </div>
                  </div>
                )}

                {instructions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Manual Deployment Instructions
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        Follow these steps to manually replicate this deployment:
                      </p>
                      <div className="font-mono text-xs bg-gray-900 dark:bg-gray-950 text-green-400 rounded p-3 overflow-x-auto max-h-64 overflow-y-auto">
                        {instructions.map((instruction, index) => (
                          <div key={index} className="whitespace-pre-wrap">
                            {instruction}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        These instructions were automatically generated based on your deployment configuration.
                      </p>
                    </div>
                  </div>
                )}

                {steps.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Deployment Steps
                    </h3>
                    <div className="space-y-2">
                      {steps.map((step, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${
                            step.status === 'completed'
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                              : step.status === 'error'
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              : step.status === 'in-progress'
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                step.status === 'completed'
                                  ? 'bg-green-500'
                                  : step.status === 'error'
                                  ? 'bg-red-500'
                                  : step.status === 'in-progress'
                                  ? 'bg-blue-500 animate-pulse'
                                  : 'bg-gray-400'
                              }`}
                            />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {step.step}
                            </span>
                            {step.duration && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({step.duration})
                              </span>
                            )}
                          </div>
                          {step.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 ml-4 mt-1">
                              {step.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {logs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Logs
                    </h3>
                    <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs max-h-48 overflow-y-auto">
                      {logs.map((log, index) => (
                        <div key={index} className="mb-1">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400">
                Loading deployment details...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
