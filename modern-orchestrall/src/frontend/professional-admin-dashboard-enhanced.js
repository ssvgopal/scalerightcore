// src/frontend/professional-admin-dashboard-enhanced.js - Enhanced Professional Admin Dashboard
const EntityListPanelEnhanced = require('./EntityListPanelEnhanced');
const WebSocketManager = require('./WebSocketManager');
const AdvancedCRUDOperations = require('./AdvancedCRUDOperations');
const MobileOptimizer = require('./MobileOptimizer');

class ProfessionalAdminDashboardEnhanced {
  constructor() {
    this.entities = [];
    this.currentEntity = null;
    this.wsManager = null;
    this.mobileOptimizer = null;
    this.crudOperations = new Map();
    this.isInitialized = false;
  }

  // Generate enhanced professional admin dashboard HTML
  generateHTML(entities = []) {
    this.entities = entities;
    
    return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
        <title>Orchestrall AI - Professional Admin Dashboard</title>
        
        <!-- Fonts -->
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        
        <!-- Icons -->
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        
        <!-- Tailwind CSS -->
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        
        <!-- Custom Styles -->
        <style>
          ${this.generateCustomCSS()}
        </style>
      </head>
      <body class="bg-gray-50 font-inter">
        <!-- Loading Screen -->
        <div id="loading-screen" class="loading-screen">
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">Initializing Orchestrall AI Dashboard...</div>
          </div>
        </div>

        <!-- Main Layout -->
        <div class="dashboard-layout" id="dashboard-layout">
          <!-- Sidebar -->
          <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
              <div class="logo">
                <i class="fas fa-brain text-blue-600"></i>
                <span class="logo-text">Orchestrall AI</span>
              </div>
              <button class="sidebar-toggle mobile-only" id="sidebar-toggle">
                <i class="fas fa-bars"></i>
              </button>
            </div>
            
            <nav class="sidebar-nav">
              <div class="nav-section">
                <div class="nav-section-title">Overview</div>
                <a href="#" class="nav-link active" data-view="dashboard">
                  <i class="fas fa-tachometer-alt"></i>
                  <span>Dashboard</span>
                </a>
                <a href="#" class="nav-link" data-view="analytics">
                  <i class="fas fa-chart-line"></i>
                  <span>Analytics</span>
                </a>
                <a href="#" class="nav-link" data-view="reports">
                  <i class="fas fa-file-alt"></i>
                  <span>Reports</span>
                </a>
              </div>
              
              <div class="nav-section">
                <div class="nav-section-title">Data Management</div>
                ${this.generateEntityNavLinks()}
              </div>
              
              <div class="nav-section">
                <div class="nav-section-title">System</div>
                <a href="#" class="nav-link" data-view="plugins">
                  <i class="fas fa-puzzle-piece"></i>
                  <span>Plugins</span>
                </a>
                <a href="#" class="nav-link" data-view="users">
                  <i class="fas fa-users"></i>
                  <span>Users</span>
                </a>
                <a href="#" class="nav-link" data-view="settings">
                  <i class="fas fa-cog"></i>
                  <span>Settings</span>
                </a>
              </div>
            </nav>
            
            <div class="sidebar-footer">
              <div class="user-info">
                <div class="user-avatar">
                  <i class="fas fa-user"></i>
                </div>
                <div class="user-details">
                  <div class="user-name">Admin User</div>
                  <div class="user-role">System Administrator</div>
                </div>
              </div>
              <button class="logout-btn" id="logout-btn">
                <i class="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </aside>

          <!-- Main Content -->
          <main class="main-content">
            <!-- Header -->
            <header class="header">
              <div class="header-left">
                <h1 class="page-title" id="page-title">Dashboard Overview</h1>
                <div class="breadcrumb" id="breadcrumb">
                  <span>Home</span>
                </div>
              </div>
              
              <div class="header-right">
                <div class="header-actions">
                  <button class="header-btn" id="refresh-btn" title="Refresh Data">
                    <i class="fas fa-sync-alt"></i>
                  </button>
                  <button class="header-btn" id="notifications-btn" title="Notifications">
                    <i class="fas fa-bell"></i>
                    <span class="notification-badge" id="notification-badge">0</span>
                  </button>
                  <button class="header-btn" id="search-btn" title="Search">
                    <i class="fas fa-search"></i>
                  </button>
                </div>
                
                <div class="connection-status" id="connection-status">
                  <div class="status-indicator" id="status-indicator"></div>
                  <span class="status-text" id="status-text">Connecting...</span>
                </div>
              </div>
            </header>

            <!-- Content Area -->
            <div class="content-area" id="content-area">
              <!-- Dashboard Overview -->
              <div class="view-content active" id="dashboard-view">
                ${this.generateDashboardOverview()}
              </div>

              <!-- Entity Management Views -->
              ${this.generateEntityViews()}

              <!-- Analytics View -->
              <div class="view-content" id="analytics-view">
                ${this.generateAnalyticsView()}
              </div>

              <!-- Reports View -->
              <div class="view-content" id="reports-view">
                ${this.generateReportsView()}
              </div>

              <!-- Plugins View -->
              <div class="view-content" id="plugins-view">
                ${this.generatePluginsView()}
              </div>

              <!-- Users View -->
              <div class="view-content" id="users-view">
                ${this.generateUsersView()}
              </div>

              <!-- Settings View -->
              <div class="view-content" id="settings-view">
                ${this.generateSettingsView()}
              </div>
            </div>
          </main>
        </div>

        <!-- Global Modals -->
        ${this.generateGlobalModals()}

        <!-- Notification Container -->
        <div class="notification-container" id="notification-container"></div>

        <!-- Scripts -->
        <script>
          ${this.generateJavaScript()}
        </script>
      </body>
    </html>
    `;
  }

  // Generate custom CSS for enhanced dashboard
  generateCustomCSS() {
    return `
      /* Enhanced Professional Admin Dashboard Styles */
      
      :root {
        --primary-color: #3182ce;
        --secondary-color: #2d3748;
        --accent-color: #667eea;
        --success-color: #38a169;
        --warning-color: #d69e2e;
        --error-color: #e53e3e;
        --info-color: #3182ce;
        --gray-50: #f8fafc;
        --gray-100: #f1f5f9;
        --gray-200: #e2e8f0;
        --gray-300: #cbd5e0;
        --gray-400: #a0aec0;
        --gray-500: #718096;
        --gray-600: #4a5568;
        --gray-700: #2d3748;
        --gray-800: #1a202c;
        --gray-900: #171923;
      }

      * {
        box-sizing: border-box;
      }

      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background-color: var(--gray-50);
        margin: 0;
        padding: 0;
        overflow-x: hidden;
      }

      /* Loading Screen */
      .loading-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: opacity 0.5s ease;
      }

      .loading-content {
        text-align: center;
        color: white;
      }

      .loading-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top: 4px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }

      .loading-text {
        font-size: 18px;
        font-weight: 500;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Dashboard Layout */
      .dashboard-layout {
        display: flex;
        min-height: 100vh;
        opacity: 0;
        transition: opacity 0.5s ease;
      }

      .dashboard-layout.loaded {
        opacity: 1;
      }

      /* Sidebar */
      .sidebar {
        width: 280px;
        background: linear-gradient(135deg, var(--secondary-color) 0%, var(--gray-800) 100%);
        color: white;
        box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        position: fixed;
        height: 100vh;
        z-index: 1000;
        transition: transform 0.3s ease;
      }

      .sidebar-header {
        padding: 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 20px;
        font-weight: 700;
      }

      .logo i {
        font-size: 24px;
        color: var(--primary-color);
      }

      .logo-text {
        color: white;
      }

      .sidebar-toggle {
        display: none;
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }

      .sidebar-toggle:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }

      .sidebar-nav {
        flex: 1;
        padding: 20px 0;
        overflow-y: auto;
      }

      .nav-section {
        margin-bottom: 32px;
      }

      .nav-section-title {
        padding: 0 24px 12px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.6);
      }

      .nav-link {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 24px;
        color: rgba(255, 255, 255, 0.8);
        text-decoration: none;
        transition: all 0.2s ease;
        border-left: 3px solid transparent;
        font-weight: 500;
      }

      .nav-link:hover {
        background-color: rgba(255, 255, 255, 0.1);
        border-left-color: var(--primary-color);
        color: white;
      }

      .nav-link.active {
        background-color: rgba(255, 255, 255, 0.15);
        border-left-color: var(--primary-color);
        color: white;
      }

      .nav-link i {
        width: 20px;
        text-align: center;
      }

      .sidebar-footer {
        padding: 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .user-avatar {
        width: 40px;
        height: 40px;
        background: var(--primary-color);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }

      .user-details {
        flex: 1;
      }

      .user-name {
        font-weight: 600;
        font-size: 14px;
        color: white;
      }

      .user-role {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }

      .logout-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.8);
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .logout-btn:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: white;
      }

      /* Main Content */
      .main-content {
        flex: 1;
        margin-left: 280px;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      /* Header */
      .header {
        background: white;
        border-bottom: 1px solid var(--gray-200);
        padding: 0 32px;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        position: sticky;
        top: 0;
        z-index: 100;
      }

      .header-left {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .page-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--gray-800);
        margin: 0;
      }

      .breadcrumb {
        font-size: 14px;
        color: var(--gray-500);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .breadcrumb span:not(:last-child)::after {
        content: '>';
        margin-left: 8px;
        color: var(--gray-400);
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 24px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-btn {
        position: relative;
        background: none;
        border: none;
        color: var(--gray-600);
        cursor: pointer;
        padding: 12px;
        border-radius: 8px;
        transition: all 0.2s ease;
        font-size: 16px;
      }

      .header-btn:hover {
        background-color: var(--gray-100);
        color: var(--gray-800);
      }

      .notification-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        background: var(--error-color);
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .connection-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--gray-600);
      }

      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--gray-400);
        animation: pulse 2s infinite;
      }

      .status-indicator.connected {
        background-color: var(--success-color);
      }

      .status-indicator.disconnected {
        background-color: var(--error-color);
      }

      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }

      /* Content Area */
      .content-area {
        flex: 1;
        padding: 32px;
        overflow-y: auto;
      }

      .view-content {
        display: none;
      }

      .view-content.active {
        display: block;
      }

      /* Dashboard Overview */
      .dashboard-overview {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 24px;
        margin-bottom: 32px;
      }

      .stats-card {
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        border: 1px solid var(--gray-200);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .stats-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
      }

      .stats-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .stats-card-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--gray-600);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .stats-card-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: white;
      }

      .stats-card-icon.primary {
        background: linear-gradient(135deg, var(--primary-color) 0%, #2c5282 100%);
      }

      .stats-card-icon.success {
        background: linear-gradient(135deg, var(--success-color) 0%, #2f855a 100%);
      }

      .stats-card-icon.warning {
        background: linear-gradient(135deg, var(--warning-color) 0%, #b7791f 100%);
      }

      .stats-card-icon.error {
        background: linear-gradient(135deg, var(--error-color) 0%, #c53030 100%);
      }

      .stats-card-value {
        font-size: 32px;
        font-weight: 700;
        color: var(--gray-800);
        margin-bottom: 8px;
      }

      .stats-card-change {
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .stats-card-change.positive {
        color: var(--success-color);
      }

      .stats-card-change.negative {
        color: var(--error-color);
      }

      .stats-card-change.neutral {
        color: var(--gray-500);
      }

      /* Entity Views */
      .entity-view {
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        border: 1px solid var(--gray-200);
        overflow: hidden;
      }

      /* Mobile Responsive */
      @media (max-width: 768px) {
        .sidebar {
          transform: translateX(-100%);
        }

        .sidebar.open {
          transform: translateX(0);
        }

        .sidebar-toggle {
          display: block;
        }

        .main-content {
          margin-left: 0;
        }

        .header {
          padding: 0 16px;
        }

        .content-area {
          padding: 16px;
        }

        .dashboard-overview {
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .stats-card {
          padding: 16px;
        }

        .stats-card-value {
          font-size: 24px;
        }
      }

      @media (max-width: 480px) {
        .header {
          height: 60px;
        }

        .page-title {
          font-size: 18px;
        }

        .header-actions {
          gap: 8px;
        }

        .header-btn {
          padding: 8px;
          font-size: 14px;
        }
      }

      /* Touch Device Optimizations */
      .touch-device .header-btn {
        min-width: 44px;
        min-height: 44px;
      }

      .touch-device .nav-link {
        min-height: 44px;
      }

      .touch-device .logout-btn {
        min-width: 44px;
        min-height: 44px;
      }

      /* Notification Styles */
      .notification-container {
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 1000;
        max-width: 400px;
      }

      .notification {
        background: white;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-left: 4px solid var(--primary-color);
        animation: slideIn 0.3s ease;
      }

      .notification.success {
        border-left-color: var(--success-color);
      }

      .notification.error {
        border-left-color: var(--error-color);
      }

      .notification.warning {
        border-left-color: var(--warning-color);
      }

      .notification.info {
        border-left-color: var(--info-color);
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* Modal Styles */
      .modal {
        display: none;
        position: fixed;
        z-index: 2000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }

      .modal-content {
        background-color: white;
        margin: 5% auto;
        padding: 0;
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
        animation: modalSlideIn 0.3s ease;
        max-height: 90vh;
        overflow-y: auto;
      }

      @keyframes modalSlideIn {
        from {
          transform: translateY(-50px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px;
        border-bottom: 1px solid var(--gray-200);
      }

      .modal-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--gray-800);
      }

      .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--gray-500);
        transition: color 0.2s ease;
        padding: 4px;
        border-radius: 4px;
      }

      .modal-close:hover {
        color: var(--gray-800);
        background-color: var(--gray-100);
      }

      .modal-body {
        padding: 24px;
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 24px;
        border-top: 1px solid var(--gray-200);
      }

      /* Mobile Modal Styles */
      .mobile-modal .modal-content {
        width: 100vw;
        height: 100vh;
        margin: 0;
        border-radius: 0;
        max-width: none;
        max-height: none;
      }

      /* Utility Classes */
      .hidden {
        display: none !important;
      }

      .mobile-only {
        display: none;
      }

      @media (max-width: 768px) {
        .mobile-only {
          display: block;
        }
      }

      .text-center {
        text-align: center;
      }

      .text-left {
        text-align: left;
      }

      .text-right {
        text-align: right;
      }

      .font-bold {
        font-weight: 700;
      }

      .font-semibold {
        font-weight: 600;
      }

      .font-medium {
        font-weight: 500;
      }

      .opacity-50 {
        opacity: 0.5;
      }

      .opacity-75 {
        opacity: 0.75;
      }

      .cursor-pointer {
        cursor: pointer;
      }

      .select-none {
        user-select: none;
      }

      .transition-all {
        transition: all 0.2s ease;
      }

      .transition-colors {
        transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
      }

      .transition-transform {
        transition: transform 0.2s ease;
      }

      .hover\\:scale-105:hover {
        transform: scale(1.05);
      }

      .hover\\:scale-110:hover {
        transform: scale(1.1);
      }

      .focus\\:outline-none:focus {
        outline: none;
      }

      .focus\\:ring-2:focus {
        box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.5);
      }

      .focus\\:ring-blue-500:focus {
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
      }
    `;
  }

  // Generate entity navigation links
  generateEntityNavLinks() {
    return this.entities.map(entity => `
      <a href="#" class="nav-link" data-view="entity-${entity}" data-entity="${entity}">
        <i class="fas fa-database"></i>
        <span>${entity.charAt(0).toUpperCase() + entity.slice(1)}</span>
      </a>
    `).join('');
  }

  // Generate dashboard overview
  generateDashboardOverview() {
    return `
      <div class="dashboard-overview">
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-title">Total Users</div>
            <div class="stats-card-icon primary">
              <i class="fas fa-users"></i>
            </div>
          </div>
          <div class="stats-card-value" id="total-users">1,234</div>
          <div class="stats-card-change positive">
            <i class="fas fa-arrow-up"></i>
            <span>+12% from last month</span>
          </div>
        </div>

        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-title">Active Plugins</div>
            <div class="stats-card-icon success">
              <i class="fas fa-puzzle-piece"></i>
            </div>
          </div>
          <div class="stats-card-value" id="active-plugins">7</div>
          <div class="stats-card-change positive">
            <i class="fas fa-arrow-up"></i>
            <span>+2 this week</span>
          </div>
        </div>

        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-title">Pending Approvals</div>
            <div class="stats-card-icon warning">
              <i class="fas fa-clock"></i>
            </div>
          </div>
          <div class="stats-card-value" id="pending-approvals">3</div>
          <div class="stats-card-change neutral">
            <i class="fas fa-minus"></i>
            <span>No change</span>
          </div>
        </div>

        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-title">System Health</div>
            <div class="stats-card-icon success">
              <i class="fas fa-heartbeat"></i>
            </div>
          </div>
          <div class="stats-card-value" id="system-health">99.9%</div>
          <div class="stats-card-change positive">
            <i class="fas fa-arrow-up"></i>
            <span>+0.1% uptime</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-title">Recent Activity</div>
            <div class="stats-card-icon info">
              <i class="fas fa-history"></i>
            </div>
          </div>
          <div class="recent-activity" id="recent-activity">
            <div class="activity-item">
              <div class="activity-icon">
                <i class="fas fa-user-plus text-green-500"></i>
              </div>
              <div class="activity-content">
                <div class="activity-title">New user registered</div>
                <div class="activity-time">2 minutes ago</div>
              </div>
            </div>
            <div class="activity-item">
              <div class="activity-icon">
                <i class="fas fa-plug text-blue-500"></i>
              </div>
              <div class="activity-content">
                <div class="activity-title">Plugin updated</div>
                <div class="activity-time">15 minutes ago</div>
              </div>
            </div>
            <div class="activity-item">
              <div class="activity-icon">
                <i class="fas fa-database text-purple-500"></i>
              </div>
              <div class="activity-content">
                <div class="activity-title">Database backup completed</div>
                <div class="activity-time">1 hour ago</div>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-title">Quick Actions</div>
            <div class="stats-card-icon primary">
              <i class="fas fa-bolt"></i>
            </div>
          </div>
          <div class="quick-actions" id="quick-actions">
            <button class="quick-action-btn" data-action="create-user">
              <i class="fas fa-user-plus"></i>
              <span>Add User</span>
            </button>
            <button class="quick-action-btn" data-action="install-plugin">
              <i class="fas fa-download"></i>
              <span>Install Plugin</span>
            </button>
            <button class="quick-action-btn" data-action="backup-data">
              <i class="fas fa-save"></i>
              <span>Backup Data</span>
            </button>
            <button class="quick-action-btn" data-action="view-logs">
              <i class="fas fa-file-alt"></i>
              <span>View Logs</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Generate entity views
  generateEntityViews() {
    return this.entities.map(entity => `
      <div class="view-content entity-view" id="entity-${entity}-view">
        <div id="entity-${entity}-panel"></div>
      </div>
    `).join('');
  }

  // Generate analytics view
  generateAnalyticsView() {
    return `
      <div class="analytics-view">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="stats-card">
            <div class="stats-card-header">
              <div class="stats-card-title">Performance Metrics</div>
              <div class="stats-card-icon primary">
                <i class="fas fa-chart-line"></i>
              </div>
            </div>
            <div class="chart-container" id="performance-chart">
              <div class="chart-placeholder">
                <i class="fas fa-chart-area text-4xl text-gray-400"></i>
                <p class="text-gray-500 mt-4">Performance chart will be rendered here</p>
              </div>
            </div>
          </div>

          <div class="stats-card">
            <div class="stats-card-header">
              <div class="stats-card-title">Usage Statistics</div>
              <div class="stats-card-icon success">
                <i class="fas fa-chart-pie"></i>
              </div>
            </div>
            <div class="chart-container" id="usage-chart">
              <div class="chart-placeholder">
                <i class="fas fa-chart-pie text-4xl text-gray-400"></i>
                <p class="text-gray-500 mt-4">Usage chart will be rendered here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate reports view
  generateReportsView() {
    return `
      <div class="reports-view">
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-title">System Reports</div>
            <div class="stats-card-icon primary">
              <i class="fas fa-file-alt"></i>
            </div>
          </div>
          <div class="reports-grid">
            <div class="report-item">
              <div class="report-icon">
                <i class="fas fa-users text-blue-500"></i>
              </div>
              <div class="report-content">
                <div class="report-title">User Activity Report</div>
                <div class="report-description">Detailed analysis of user interactions</div>
              </div>
              <button class="report-action-btn">
                <i class="fas fa-download"></i>
              </button>
            </div>
            <div class="report-item">
              <div class="report-icon">
                <i class="fas fa-server text-green-500"></i>
              </div>
              <div class="report-content">
                <div class="report-title">System Performance Report</div>
                <div class="report-description">Server performance and resource usage</div>
              </div>
              <button class="report-action-btn">
                <i class="fas fa-download"></i>
              </button>
            </div>
            <div class="report-item">
              <div class="report-icon">
                <i class="fas fa-shield-alt text-purple-500"></i>
              </div>
              <div class="report-content">
                <div class="report-title">Security Audit Report</div>
                <div class="report-description">Security events and access logs</div>
              </div>
              <button class="report-action-btn">
                <i class="fas fa-download"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate plugins view
  generatePluginsView() {
    return `
      <div class="plugins-view">
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-title">Plugin Management</div>
            <div class="stats-card-icon primary">
              <i class="fas fa-puzzle-piece"></i>
            </div>
          </div>
          <div class="plugins-grid" id="plugins-grid">
            <div class="plugin-item">
              <div class="plugin-icon">
                <i class="fas fa-shopping-cart text-blue-500"></i>
              </div>
              <div class="plugin-content">
                <div class="plugin-title">Shopify Integration</div>
                <div class="plugin-description">E-commerce platform integration</div>
                <div class="plugin-status active">Active</div>
              </div>
              <div class="plugin-actions">
                <button class="plugin-action-btn">
                  <i class="fas fa-cog"></i>
                </button>
                <button class="plugin-action-btn">
                  <i class="fas fa-power-off"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate users view
  generateUsersView() {
    return `
      <div class="users-view">
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-title">User Management</div>
            <div class="stats-card-icon primary">
              <i class="fas fa-users"></i>
            </div>
          </div>
          <div id="users-panel"></div>
        </div>
      </div>
    `;
  }

  // Generate settings view
  generateSettingsView() {
    return `
      <div class="settings-view">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="stats-card">
            <div class="stats-card-header">
              <div class="stats-card-title">System Settings</div>
              <div class="stats-card-icon primary">
                <i class="fas fa-cog"></i>
              </div>
            </div>
            <div class="settings-form">
              <div class="setting-item">
                <label class="setting-label">System Name</label>
                <input type="text" class="setting-input" value="Orchestrall AI Platform">
              </div>
              <div class="setting-item">
                <label class="setting-label">Default Language</label>
                <select class="setting-input">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
              <div class="setting-item">
                <label class="setting-label">Timezone</label>
                <select class="setting-input">
                  <option value="UTC">UTC</option>
                  <option value="EST">Eastern Time</option>
                  <option value="PST">Pacific Time</option>
                </select>
              </div>
            </div>
          </div>

          <div class="stats-card">
            <div class="stats-card-header">
              <div class="stats-card-title">Security Settings</div>
              <div class="stats-card-icon warning">
                <i class="fas fa-shield-alt"></i>
              </div>
            </div>
            <div class="settings-form">
              <div class="setting-item">
                <label class="setting-label">Enable Two-Factor Authentication</label>
                <input type="checkbox" class="setting-checkbox" checked>
              </div>
              <div class="setting-item">
                <label class="setting-label">Session Timeout (minutes)</label>
                <input type="number" class="setting-input" value="30">
              </div>
              <div class="setting-item">
                <label class="setting-label">Password Policy</label>
                <select class="setting-input">
                  <option value="basic">Basic</option>
                  <option value="strong">Strong</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate global modals
  generateGlobalModals() {
    return `
      <!-- Search Modal -->
      <div class="modal" id="search-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Search</h3>
            <button class="modal-close" id="search-modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="search-form">
              <input type="text" id="global-search-input" placeholder="Search across all entities..." class="search-input">
              <button class="search-btn" id="global-search-btn">
                <i class="fas fa-search"></i>
              </button>
            </div>
            <div class="search-results" id="search-results"></div>
          </div>
        </div>
      </div>

      <!-- Notifications Modal -->
      <div class="modal" id="notifications-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Notifications</h3>
            <button class="modal-close" id="notifications-modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="notifications-list" id="notifications-list">
              <div class="notification-item">
                <div class="notification-icon">
                  <i class="fas fa-info-circle text-blue-500"></i>
                </div>
                <div class="notification-content">
                  <div class="notification-title">System Update Available</div>
                  <div class="notification-message">A new version of the platform is available for download.</div>
                  <div class="notification-time">2 hours ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate JavaScript for enhanced dashboard
  generateJavaScript() {
    return `
      (function() {
        // Global variables
        let currentView = 'dashboard';
        let wsManager = null;
        let mobileOptimizer = null;
        let crudOperations = new Map();
        let isInitialized = false;

        // Initialize dashboard
        async function initDashboard() {
          if (isInitialized) return;
          
          try {
            console.log('🚀 Initializing Enhanced Professional Admin Dashboard...');
            
            // Initialize mobile optimizer
            mobileOptimizer = new MobileOptimizer();
            
            // Initialize WebSocket manager
            wsManager = new WebSocketManager();
            wsManager.connect();
            
            // Setup WebSocket event listeners
            setupWebSocketListeners();
            
            // Initialize CRUD operations for each entity
            await initializeCRUDOperations();
            
            // Setup event listeners
            setupEventListeners();
            
            // Initialize entity panels
            await initializeEntityPanels();
            
            // Update connection status
            updateConnectionStatus();
            
            // Hide loading screen
            hideLoadingScreen();
            
            isInitialized = true;
            console.log('✅ Enhanced Professional Admin Dashboard initialized successfully');
            
          } catch (error) {
            console.error('❌ Failed to initialize dashboard:', error);
            showNotification('Failed to initialize dashboard: ' + error.message, 'error');
          }
        }

        // Setup WebSocket event listeners
        function setupWebSocketListeners() {
          if (!wsManager) return;

          wsManager.subscribe('connected', () => {
            updateConnectionStatus(true);
            showNotification('Connected to real-time updates', 'success');
          });

          wsManager.subscribe('disconnected', () => {
            updateConnectionStatus(false);
            showNotification('Disconnected from real-time updates', 'warning');
          });

          wsManager.subscribe('entityCreated', (data) => {
            if (data.entity && crudOperations.has(data.entity)) {
              refreshEntityPanel(data.entity);
            }
            showNotification(\`New \${data.entity} created\`, 'success');
          });

          wsManager.subscribe('entityUpdated', (data) => {
            if (data.entity && crudOperations.has(data.entity)) {
              refreshEntityPanel(data.entity);
            }
            showNotification(\`\${data.entity} updated\`, 'info');
          });

          wsManager.subscribe('entityDeleted', (data) => {
            if (data.entity && crudOperations.has(data.entity)) {
              refreshEntityPanel(data.entity);
            }
            showNotification(\`\${data.entity} deleted\`, 'warning');
          });

          wsManager.subscribe('notification', (data) => {
            showNotification(data.message, data.type);
          });
        }

        // Initialize CRUD operations for each entity
        async function initializeCRUDOperations() {
          const entities = ${JSON.stringify(this.entities)};
          
          for (const entity of entities) {
            try {
              const crudOp = new AdvancedCRUDOperations(entity, apiClient, wsManager);
              crudOperations.set(entity, crudOp);
              console.log(\`✅ CRUD operations initialized for \${entity}\`);
            } catch (error) {
              console.error(\`❌ Failed to initialize CRUD operations for \${entity}:\`, error);
            }
          }
        }

        // Initialize entity panels
        async function initializeEntityPanels() {
          const entities = ${JSON.stringify(this.entities)};
          
          for (const entity of entities) {
            try {
              const panel = new EntityListPanelEnhanced(entity, apiClient);
              const panelElement = document.getElementById(\`entity-\${entity}-panel\`);
              
              if (panelElement) {
                panelElement.innerHTML = panel.generateHTML();
                
                // Inject CSS
                const style = document.createElement('style');
                style.textContent = panel.generateCSS();
                document.head.appendChild(style);
                
                // Inject JavaScript
                const script = document.createElement('script');
                script.textContent = panel.generateJavaScript();
                document.head.appendChild(script);
                
                console.log(\`✅ Entity panel initialized for \${entity}\`);
              }
            } catch (error) {
              console.error(\`❌ Failed to initialize entity panel for \${entity}:\`, error);
            }
          }
        }

        // Setup event listeners
        function setupEventListeners() {
          // Navigation links
          document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
              e.preventDefault();
              const view = e.currentTarget.dataset.view;
              if (view) {
                showView(view);
              }
            });
          });

          // Sidebar toggle for mobile
          const sidebarToggle = document.getElementById('sidebar-toggle');
          if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
              const sidebar = document.getElementById('sidebar');
              sidebar.classList.toggle('open');
            });
          }

          // Header buttons
          const refreshBtn = document.getElementById('refresh-btn');
          if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshCurrentView);
          }

          const notificationsBtn = document.getElementById('notifications-btn');
          if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
              showModal('notifications-modal');
            });
          }

          const searchBtn = document.getElementById('search-btn');
          if (searchBtn) {
            searchBtn.addEventListener('click', () => {
              showModal('search-modal');
            });
          }

          // Logout button
          const logoutBtn = document.getElementById('logout-btn');
          if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
          }

          // Modal close buttons
          document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const modal = e.target.closest('.modal');
              hideModal(modal.id);
            });
          });

          // Close modals when clicking outside
          document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
              if (e.target === modal) {
                hideModal(modal.id);
              }
            });
          });

          // Global search
          const globalSearchBtn = document.getElementById('global-search-btn');
          const globalSearchInput = document.getElementById('global-search-input');
          
          if (globalSearchBtn && globalSearchInput) {
            globalSearchBtn.addEventListener('click', performGlobalSearch);
            globalSearchInput.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                performGlobalSearch();
              }
            });
          }

          // Quick actions
          document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const action = e.currentTarget.dataset.action;
              handleQuickAction(action);
            });
          });
        }

        // Show specific view
        function showView(viewName) {
          // Hide all views
          document.querySelectorAll('.view-content').forEach(view => {
            view.classList.remove('active');
          });

          // Show selected view
          const targetView = document.getElementById(\`\${viewName}-view\`);
          if (targetView) {
            targetView.classList.add('active');
          }

          // Update navigation
          document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
          });

          const activeLink = document.querySelector(\`[data-view="\${viewName}"]\`);
          if (activeLink) {
            activeLink.classList.add('active');
          }

          // Update page title and breadcrumb
          updatePageTitle(viewName);

          // Update current view
          currentView = viewName;

          // Close mobile sidebar
          if (mobileOptimizer && mobileOptimizer.isMobileDevice()) {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.remove('open');
          }
        }

        // Update page title and breadcrumb
        function updatePageTitle(viewName) {
          const pageTitle = document.getElementById('page-title');
          const breadcrumb = document.getElementById('breadcrumb');
          
          if (!pageTitle || !breadcrumb) return;

          const titles = {
            'dashboard': 'Dashboard Overview',
            'analytics': 'Analytics',
            'reports': 'Reports',
            'plugins': 'Plugin Management',
            'users': 'User Management',
            'settings': 'System Settings'
          };

          const breadcrumbs = {
            'dashboard': 'Home',
            'analytics': 'Home > Analytics',
            'reports': 'Home > Reports',
            'plugins': 'Home > System > Plugins',
            'users': 'Home > System > Users',
            'settings': 'Home > System > Settings'
          };

          // Handle entity views
          if (viewName.startsWith('entity-')) {
            const entity = viewName.replace('entity-', '');
            pageTitle.textContent = \`\${entity.charAt(0).toUpperCase() + entity.slice(1)} Management\`;
            breadcrumb.innerHTML = \`Home > Data Management > \${entity.charAt(0).toUpperCase() + entity.slice(1)}\`;
          } else {
            pageTitle.textContent = titles[viewName] || 'Dashboard';
            breadcrumb.innerHTML = breadcrumbs[viewName] || 'Home';
          }
        }

        // Refresh current view
        async function refreshCurrentView() {
          try {
            if (currentView.startsWith('entity-')) {
              const entity = currentView.replace('entity-', '');
              await refreshEntityPanel(entity);
            } else {
              await refreshDashboardData();
            }
            showNotification('Data refreshed successfully', 'success');
          } catch (error) {
            console.error('Error refreshing view:', error);
            showNotification('Failed to refresh data', 'error');
          }
        }

        // Refresh entity panel
        async function refreshEntityPanel(entity) {
          const panelElement = document.getElementById(\`entity-\${entity}-panel\`);
          if (panelElement && crudOperations.has(entity)) {
            // Trigger refresh in the entity panel
            const refreshEvent = new CustomEvent('refresh', { detail: { entity } });
            panelElement.dispatchEvent(refreshEvent);
          }
        }

        // Refresh dashboard data
        async function refreshDashboardData() {
          try {
            // Update stats cards
            await updateStatsCards();
            
            // Update recent activity
            await updateRecentActivity();
            
            // Update quick actions
            await updateQuickActions();
          } catch (error) {
            console.error('Error refreshing dashboard data:', error);
          }
        }

        // Update stats cards
        async function updateStatsCards() {
          try {
            // This would typically fetch real data from the API
            const stats = {
              'total-users': '1,234',
              'active-plugins': '7',
              'pending-approvals': '3',
              'system-health': '99.9%'
            };

            Object.entries(stats).forEach(([id, value]) => {
              const element = document.getElementById(id);
              if (element) {
                element.textContent = value;
              }
            });
          } catch (error) {
            console.error('Error updating stats cards:', error);
          }
        }

        // Update recent activity
        async function updateRecentActivity() {
          try {
            const activityElement = document.getElementById('recent-activity');
            if (activityElement) {
              // This would typically fetch real activity data
              const activities = [
                { icon: 'fas fa-user-plus', title: 'New user registered', time: '2 minutes ago', color: 'text-green-500' },
                { icon: 'fas fa-plug', title: 'Plugin updated', time: '15 minutes ago', color: 'text-blue-500' },
                { icon: 'fas fa-database', title: 'Database backup completed', time: '1 hour ago', color: 'text-purple-500' }
              ];

              activityElement.innerHTML = activities.map(activity => \`
                <div class="activity-item">
                  <div class="activity-icon">
                    <i class="\${activity.icon} \${activity.color}"></i>
                  </div>
                  <div class="activity-content">
                    <div class="activity-title">\${activity.title}</div>
                    <div class="activity-time">\${activity.time}</div>
                  </div>
                </div>
              \`).join('');
            }
          } catch (error) {
            console.error('Error updating recent activity:', error);
          }
        }

        // Update quick actions
        async function updateQuickActions() {
          try {
            const quickActionsElement = document.getElementById('quick-actions');
            if (quickActionsElement) {
              // Quick actions are static for now
              console.log('Quick actions updated');
            }
          } catch (error) {
            console.error('Error updating quick actions:', error);
          }
        }

        // Update connection status
        function updateConnectionStatus(connected = null) {
          const statusIndicator = document.getElementById('status-indicator');
          const statusText = document.getElementById('status-text');
          
          if (!statusIndicator || !statusText) return;

          if (connected === null) {
            // Check WebSocket status
            connected = wsManager ? wsManager.isConnected : false;
          }

          if (connected) {
            statusIndicator.className = 'status-indicator connected';
            statusText.textContent = 'Connected';
          } else {
            statusIndicator.className = 'status-indicator disconnected';
            statusText.textContent = 'Disconnected';
          }
        }

        // Show modal
        function showModal(modalId) {
          const modal = document.getElementById(modalId);
          if (modal) {
            modal.style.display = 'block';
          }
        }

        // Hide modal
        function hideModal(modalId) {
          const modal = document.getElementById(modalId);
          if (modal) {
            modal.style.display = 'none';
          }
        }

        // Perform global search
        async function performGlobalSearch() {
          const searchInput = document.getElementById('global-search-input');
          const searchResults = document.getElementById('search-results');
          
          if (!searchInput || !searchResults) return;

          const query = searchInput.value.trim();
          if (!query) return;

          try {
            searchResults.innerHTML = '<div class="text-center text-gray-500">Searching...</div>';
            
            // This would typically perform a real search across all entities
            const results = [
              { entity: 'user', title: 'John Doe', description: 'User account' },
              { entity: 'organization', title: 'Acme Corp', description: 'Organization' },
              { entity: 'product', title: 'Widget Pro', description: 'Product' }
            ];

            if (results.length === 0) {
              searchResults.innerHTML = '<div class="text-center text-gray-500">No results found</div>';
            } else {
              searchResults.innerHTML = results.map(result => \`
                <div class="search-result-item" onclick="showView('entity-\${result.entity}')">
                  <div class="search-result-title">\${result.title}</div>
                  <div class="search-result-description">\${result.description}</div>
                  <div class="search-result-entity">\${result.entity}</div>
                </div>
              \`).join('');
            }
          } catch (error) {
            console.error('Error performing global search:', error);
            searchResults.innerHTML = '<div class="text-center text-red-500">Search failed</div>';
          }
        }

        // Handle quick actions
        function handleQuickAction(action) {
          switch (action) {
            case 'create-user':
              showView('users');
              break;
            case 'install-plugin':
              showView('plugins');
              break;
            case 'backup-data':
              showNotification('Backup initiated', 'info');
              break;
            case 'view-logs':
              showNotification('Logs view not implemented yet', 'warning');
              break;
            default:
              console.log('Unknown quick action:', action);
          }
        }

        // Show notification
        function showNotification(message, type = 'info') {
          const container = document.getElementById('notification-container');
          if (!container) return;

          const notification = document.createElement('div');
          notification.className = \`notification \${type}\`;
          notification.innerHTML = \`
            <div class="notification-content">
              <div class="notification-message">\${message}</div>
              <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
              </button>
            </div>
          \`;

          container.appendChild(notification);

          // Auto-remove after 5 seconds
          setTimeout(() => {
            if (notification.parentElement) {
              notification.remove();
            }
          }, 5000);
        }

        // Logout function
        function logout() {
          if (confirm('Are you sure you want to logout?')) {
            // Disconnect WebSocket
            if (wsManager) {
              wsManager.disconnect();
            }
            
            // Clear local storage
            localStorage.removeItem('token');
            
            // Redirect to login
            window.location.href = '/';
          }
        }

        // Hide loading screen
        function hideLoadingScreen() {
          const loadingScreen = document.getElementById('loading-screen');
          const dashboardLayout = document.getElementById('dashboard-layout');
          
          if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
              loadingScreen.style.display = 'none';
            }, 500);
          }
          
          if (dashboardLayout) {
            dashboardLayout.classList.add('loaded');
          }
        }

        // Global API client (mock for now)
        window.apiClient = {
          get: async (url) => {
            console.log('GET', url);
            return { success: true, data: [] };
          },
          post: async (url, data) => {
            console.log('POST', url, data);
            return { success: true, data: {} };
          },
          put: async (url, data) => {
            console.log('PUT', url, data);
            return { success: true, data: {} };
          },
          delete: async (url) => {
            console.log('DELETE', url);
            return { success: true };
          }
        };

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initDashboard);
        } else {
          initDashboard();
        }

        // Expose global functions
        window.showView = showView;
        window.showNotification = showNotification;
        window.refreshData = refreshCurrentView;
      })();
    `;
  }
}

// Export the enhanced dashboard
const getProfessionalAdminDashboardEnhancedHtml = (entities) => {
  const dashboard = new ProfessionalAdminDashboardEnhanced();
  return dashboard.generateHTML(entities);
};

module.exports = { ProfessionalAdminDashboardEnhanced, getProfessionalAdminDashboardEnhancedHtml };
