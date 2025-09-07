"use client";

import { useState } from "react";
import {
  Save,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Key,
  Server,
  Database,
} from "lucide-react";

interface SettingsProps {
  systemHealth: any;
  onHealthRefresh: () => void;
}

export default function Settings({
  systemHealth,
  onHealthRefresh,
}: SettingsProps) {
  const [settings, setSettings] = useState({
    geminiApiKey: "",
    awsAccessKey: "",
    awsSecretKey: "",
    awsRegion: "us-east-1",
    terraformPath: "/usr/local/bin/terraform",
    githubToken: "",
  });
  const [saved, setSaved] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSave = async () => {
    // In a real implementation, you'd save these to your backend
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onHealthRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getServiceStatus = (service: string) => {
    if (!systemHealth?.services) return "unknown";
    return systemHealth.services[service] || "unknown";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "configured":
        return "text-green-600 dark:text-green-400";
      case "not configured":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-yellow-600 dark:text-yellow-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "configured":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "not configured":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure your API keys and system settings
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
          Refresh Status
        </button>
      </div>

      {/* System Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          System Status
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              {getStatusIcon(getServiceStatus("gemini"))}
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  Gemini AI
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  NLP Processing
                </div>
              </div>
            </div>
            <span
              className={`text-sm font-medium ${getStatusColor(
                getServiceStatus("gemini")
              )}`}
            >
              {getServiceStatus("gemini")}
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              {getStatusIcon(getServiceStatus("aws"))}
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  AWS
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Cloud Provider
                </div>
              </div>
            </div>
            <span
              className={`text-sm font-medium ${getStatusColor(
                getServiceStatus("aws")
              )}`}
            >
              {getServiceStatus("aws")}
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              {getStatusIcon(getServiceStatus("terraform"))}
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  Terraform
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Infrastructure
                </div>
              </div>
            </div>
            <span
              className={`text-sm font-medium ${getStatusColor(
                getServiceStatus("terraform")
              )}`}
            >
              {getServiceStatus("terraform")}
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Configuration
        </h2>

        <div className="space-y-6">
          {/* Gemini AI Section */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Key className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Gemini AI Configuration
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.geminiApiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, geminiApiKey: e.target.value })
                  }
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Required for natural language processing. Get your key from
                  Google AI Studio.
                </p>
              </div>
            </div>
          </div>

          {/* AWS Section */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Server className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                AWS Configuration
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Access Key ID
                </label>
                <input
                  type="password"
                  value={settings.awsAccessKey}
                  onChange={(e) =>
                    setSettings({ ...settings, awsAccessKey: e.target.value })
                  }
                  placeholder="AKIA..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Secret Access Key
                </label>
                <input
                  type="password"
                  value={settings.awsSecretKey}
                  onChange={(e) =>
                    setSettings({ ...settings, awsSecretKey: e.target.value })
                  }
                  placeholder="Enter secret key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Region
                </label>
                <select
                  value={settings.awsRegion}
                  onChange={(e) =>
                    setSettings({ ...settings, awsRegion: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="us-east-1">US East (N. Virginia)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-west-1">Europe (Ireland)</option>
                  <option value="ap-southeast-1">
                    Asia Pacific (Singapore)
                  </option>
                </select>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Required for deploying infrastructure to AWS. Get these from your
              AWS IAM console.
            </p>
          </div>

          {/* System Tools Section */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Database className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                System Tools
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Terraform Path
                </label>
                <input
                  type="text"
                  value={settings.terraformPath}
                  onChange={(e) =>
                    setSettings({ ...settings, terraformPath: e.target.value })
                  }
                  placeholder="/usr/local/bin/terraform"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  GitHub Token (Optional)
                </label>
                <input
                  type="password"
                  value={settings.githubToken}
                  onChange={(e) =>
                    setSettings({ ...settings, githubToken: e.target.value })
                  }
                  placeholder="ghp_..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              GitHub token is optional but recommended for private repositories
              and higher rate limits.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Changes are automatically applied to your .env file
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center px-6 py-2 rounded-lg font-medium transition-colors ${
              saved
                ? "bg-green-600 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {saved ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Documentation Links */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Documentation & Resources
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Getting Started
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Learn how to configure and use the Arvo deployment system
            </p>
            <a
              href="/docs/getting-started"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
            >
              Read Documentation →
            </a>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              API Reference
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Complete API documentation for developers
            </p>
            <a
              href="/docs/api"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
            >
              View API Docs →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
