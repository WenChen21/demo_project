"use client";

import { useState, useEffect } from "react";
import Navigation from "./components/Navigation";
import Dashboard from "./components/Dashboard";
import ChatInterface from "./components/ChatInterface";
import DeploymentStatus from "./components/DeploymentStatus";
import Settings from "./components/Settings";

type ActiveTab = "dashboard" | "deploy" | "deployments" | "settings";

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [deployments, setDeployments] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);

  useEffect(() => {
    // Check system health on startup
    checkSystemHealth();
    // Load deployments
    loadDeployments();
  }, []);

  const checkSystemHealth = async () => {
    try {
      const response = await fetch("/api/health/status");
      const data = await response.json();
      setSystemHealth(data);
    } catch (error) {
      console.error("Failed to check system health:", error);
    }
  };

  const loadDeployments = async () => {
    try {
      const response = await fetch("/api/deployment/list");
      const data = await response.json();
      if (data.success) {
        setDeployments(data.deployments || []);
      }
    } catch (error) {
      console.error("Failed to load deployments:", error);
    }
  };

  const handleNewDeployment = (deployment: any) => {
    setDeployments((prev) => [deployment, ...prev]);
    setActiveTab("deployments");
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemHealth={systemHealth}
      />

      <main className="container mx-auto px-4 py-8">
        {activeTab === "dashboard" && (
          <Dashboard
            deployments={deployments}
            systemHealth={systemHealth}
            onTabChange={setActiveTab}
          />
        )}

        {activeTab === "deploy" && (
          <ChatInterface onNewDeployment={handleNewDeployment} />
        )}

        {activeTab === "deployments" && (
          <DeploymentStatus
            deployments={deployments}
            onRefresh={loadDeployments}
          />
        )}

        {activeTab === "settings" && (
          <Settings
            systemHealth={systemHealth}
            onHealthRefresh={checkSystemHealth}
          />
        )}
      </main>
    </div>
  );
}
