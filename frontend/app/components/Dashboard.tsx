"use client";

import {
  BarChart3,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Server,
  Globe,
} from "lucide-react";

interface DashboardProps {
  deployments: any[];
  systemHealth: any;
  onTabChange: (tab: string) => void;
}

export default function Dashboard({
  deployments,
  systemHealth,
  onTabChange,
}: DashboardProps) {
  const getDeploymentStats = () => {
    const total = deployments.length;
    const deployed = deployments.filter((d) => 
      d.status === "deployed" || d.status === "completed"
    ).length;
    const failed = deployments.filter((d) => d.status === "failed").length;
    const inProgress = deployments.filter((d) =>
      ["deploying", "analyzing"].includes(d.status)
    ).length;

    return { total, deployed, failed, inProgress };
  };

  const stats = getDeploymentStats();

  const recentDeployments = deployments.slice(0, 5);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "deployed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "deploying":
      case "analyzing":
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const quickActions = [
    {
      title: "Deploy New App",
      description: "Start a new deployment with natural language",
      icon: Zap,
      color: "blue",
      action: () => onTabChange("deploy"),
    },
    {
      title: "View Deployments",
      description: "Monitor all your active deployments",
      icon: BarChart3,
      color: "green",
      action: () => onTabChange("deployments"),
    },
    {
      title: "System Settings",
      description: "Configure API keys and system settings",
      icon: Server,
      color: "purple",
      action: () => onTabChange("settings"),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome to Auto-Deployment System
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Your AI-powered deployment automation platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Deployments
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.total}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Successful
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.deployed}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                In Progress
              </p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.inProgress}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Failed
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.failed}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={action.action}
                className={`p-4 rounded-lg border-2 border-dashed border-${action.color}-300 hover:border-${action.color}-500 hover:bg-${action.color}-50 dark:hover:bg-${action.color}-900/20 transition-colors text-left group`}
              >
                <div
                  className={`inline-flex items-center justify-center w-10 h-10 bg-${action.color}-100 dark:bg-${action.color}-900 rounded-lg mb-3 group-hover:bg-${action.color}-200 dark:group-hover:bg-${action.color}-800 transition-colors`}
                >
                  <Icon
                    className={`w-5 h-5 text-${action.color}-600 dark:text-${action.color}-400`}
                  />
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {action.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* System Health */}
      {systemHealth && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            System Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {systemHealth.services &&
              Object.entries(systemHealth.services).map(
                ([service, status]: [string, any]) => (
                  <div
                    key={service}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          status === "configured"
                            ? "bg-green-500"
                            : "bg-yellow-500"
                        }`}
                      ></div>
                      <span className="font-medium text-gray-900 dark:text-white capitalize">
                        {service}
                      </span>
                    </div>
                    <span
                      className={`text-sm px-2 py-1 rounded-full ${
                        status === "configured"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                )
              )}
          </div>

          {systemHealth.system && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-gray-600 dark:text-gray-400">Uptime</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {Math.floor(systemHealth.system.uptime / 60)}m{" "}
                  {Math.floor(systemHealth.system.uptime % 60)}s
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-600 dark:text-gray-400">Platform</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {systemHealth.system.platform}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-600 dark:text-gray-400">
                  Node Version
                </div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {systemHealth.system.nodeVersion}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-600 dark:text-gray-400">Memory</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {Math.round(
                    systemHealth.system.memory.heapUsed / 1024 / 1024
                  )}
                  MB
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Deployments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Recent Deployments
          </h2>
          <button
            onClick={() => onTabChange("deployments")}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
          >
            View all
          </button>
        </div>

        {recentDeployments.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No deployments yet
            </p>
            <button
              onClick={() => onTabChange("deploy")}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Zap className="w-4 h-4 mr-2" />
              Create your first deployment
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentDeployments.map((deployment) => (
              <div
                key={deployment.deploymentId}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(deployment.status)}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {deployment.deploymentId.slice(0, 8)}...
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(deployment.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-medium ${
                      deployment.status === "deployed"
                        ? "text-green-600 dark:text-green-400"
                        : deployment.status === "failed"
                        ? "text-red-600 dark:text-red-400"
                        : "text-yellow-600 dark:text-yellow-400"
                    }`}
                  >
                    {deployment.status}
                  </div>
                  {deployment.publicUrl && (
                    <a
                      href={deployment.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View app
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
