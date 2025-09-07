"use client";

import { Activity, Settings, Zap, List, Home } from "lucide-react";

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  systemHealth: any;
}

export default function Navigation({
  activeTab,
  setActiveTab,
  systemHealth,
}: NavigationProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "deploy", label: "Deploy", icon: Zap },
    { id: "deployments", label: "Deployments", icon: List },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const getHealthIndicator = () => {
    if (!systemHealth) return "🔄";

    const allConfigured =
      systemHealth.services &&
      Object.values(systemHealth.services).every(
        (status: any) => status === "configured"
      );

    return allConfigured ? "🟢" : "🟡";
  };

  return (
    <nav className="bg-gray-800 shadow-lg border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                Auto-Deployment System
              </h1>
              <p className="text-xs text-gray-400">AI-Powered Infrastructure</p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === item.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Health Indicator */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-400">Status:</span>
              <span className="text-lg">{getHealthIndicator()}</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
