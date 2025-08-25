/**
 * Service Management Type Definitions
 * 
 * Comprehensive TypeScript types for HotM service management interface
 */

// Service status and health enums
export type ServiceStatus = 'NotInstalled' | 'Stopped' | 'Starting' | 'Running' | 'Stopping' | 'Error';
export type ServiceHealth = 'Healthy' | 'Unhealthy' | 'Unknown';
export type DeploymentMode = 'Desktop' | 'Server' | 'Hybrid';
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

// Core service information
export interface ServiceInfo {
  name: string;
  displayName: string;
  description: string;
  status: ServiceStatus;
  health: ServiceHealth;
  uptime?: string;
  port?: number;
  dependencies: string[];
  isRequired: boolean;
  canRestart: boolean;
  canStop: boolean;
}

// Performance metrics
export interface PerformanceMetrics {
  cpuUsage?: number;        // CPU percentage
  memoryUsage?: number;     // Memory in MB
  diskUsage?: number;       // Disk usage in MB
  responseTime?: number;    // Response time in ms
  errorCount?: number;      // Error count in last period
  requestCount?: number;    // Request count in last period
  lastUpdated: string;      // ISO timestamp
}

// Service configuration
export interface ServiceConfiguration {
  name: string;
  port: number;
  maxMemoryMB: number;
  maxCpuPercent: number;
  autoStart: boolean;
  restartOnFailure: boolean;
  environmentVariables: Record<string, string>;
  commandLineArgs: string[];
  workingDirectory: string;
  logLevel: LogLevel;
  logRetentionDays: number;
  healthCheckUrl?: string;
  healthCheckInterval: number;
}

// Log entry structure
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  category?: string;
  details?: Record<string, any>;
}

// Log filter options
export interface LogFilter {
  services?: string[];
  levels?: LogLevel[];
  startTime?: string;
  endTime?: string;
  searchText?: string;
  category?: string;
}

// System health check
export interface SystemCheck {
  check: string;
  healthy: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
  recommendedAction?: string;
}

// Overall system health
export interface SystemHealth {
  overallHealthy: boolean;
  serviceResults: ServiceInfo[];
  systemChecks: SystemCheck[];
  checkTime: string;
  recommendations: string[];
  resourceUsage: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    availableMemoryMB: number;
    availableDiskMB: number;
  };
}

// Service operation result
export interface ServiceOperationResult {
  success: boolean;
  message: string;
  details?: string;
  timestamp: string;
}

// Deployment configuration
export interface DeploymentConfiguration {
  mode: DeploymentMode;
  serverHost?: string;
  serverPort?: number;
  useHttps?: boolean;
  authToken?: string;
  services: {
    postgresql: {
      enabled: boolean;
      standalone: boolean;
      host?: string;
      port?: number;
      database?: string;
    };
    ollama: {
      enabled: boolean;
      standalone: boolean;
      host?: string;
      port?: number;
      models: string[];
    };
    hotmServer: {
      enabled: boolean;
      host?: string;
      port?: number;
    };
  };
}

// Diagnostic information
export interface DiagnosticInfo {
  timestamp: string;
  systemInfo: {
    os: string;
    arch: string;
    totalMemoryMB: number;
    availableMemoryMB: number;
    cpuCores: number;
    diskSpaceGB: number;
  };
  services: ServiceInfo[];
  configuration: DeploymentConfiguration;
  recentErrors: LogEntry[];
  performanceHistory: PerformanceMetrics[];
}

// Service control operations
export type ServiceOperation = 'start' | 'stop' | 'restart' | 'install' | 'uninstall' | 'configure';

// Service control request
export interface ServiceControlRequest {
  service: string;
  operation: ServiceOperation;
  parameters?: Record<string, any>;
  forceOperation?: boolean;
}

// Port validation result
export interface PortValidationResult {
  port: number;
  available: boolean;
  conflictingService?: string;
  recommendation?: number;
}

// Resource recommendation
export interface ResourceRecommendation {
  service: string;
  currentMemoryMB: number;
  recommendedMemoryMB: number;
  currentCpuPercent: number;
  recommendedCpuPercent: number;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

// Installation status
export interface InstallationStatus {
  service: string;
  installed: boolean;
  version?: string;
  path?: string;
  configurationValid: boolean;
  issues: string[];
  canUpgrade: boolean;
  availableVersion?: string;
}

// Backup configuration
export interface BackupConfiguration {
  enabled: boolean;
  schedule: string; // cron expression
  location: string;
  retentionDays: number;
  includeConfigurations: boolean;
  includeLogs: boolean;
  includeDatabase: boolean;
  compression: boolean;
}

// Service event for real-time updates
export interface ServiceEvent {
  type: 'status_changed' | 'health_changed' | 'performance_updated' | 'error_occurred' | 'log_entry';
  service: string;
  timestamp: string;
  data: any;
}

// Component props interfaces
export interface ServiceManagerProps {
  className?: string;
  initialMode?: 'simple' | 'advanced';
  onServiceOperation?: (service: string, operation: ServiceOperation) => void;
  onError?: (error: string) => void;
}

export interface ServiceConfigurationProps {
  service: string;
  configuration: ServiceConfiguration;
  onSave: (config: ServiceConfiguration) => Promise<ServiceOperationResult>;
  onCancel: () => void;
  readonly?: boolean;
}

export interface ServiceLogsProps {
  className?: string;
  services?: string[];
  defaultFilter?: LogFilter;
  maxEntries?: number;
  enableExport?: boolean;
}

export interface DeploymentModeManagerProps {
  currentConfiguration: DeploymentConfiguration;
  onConfigurationChange: (config: DeploymentConfiguration) => Promise<ServiceOperationResult>;
  onModeSwitch: (mode: DeploymentMode) => Promise<ServiceOperationResult>;
}

export interface AdminPanelProps {
  className?: string;
  userRole: 'user' | 'admin' | 'developer';
  onBackup: () => Promise<ServiceOperationResult>;
  onRestore: (backupPath: string) => Promise<ServiceOperationResult>;
}

// Hook return types
export interface UseServiceStatusReturn {
  services: ServiceInfo[];
  systemHealth: SystemHealth | null;
  loading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
  controlService: (service: string, operation: ServiceOperation) => Promise<ServiceOperationResult>;
  subscribeToEvents: (callback: (event: ServiceEvent) => void) => () => void;
}

export interface UseServiceConfigurationReturn {
  configuration: ServiceConfiguration | null;
  loading: boolean;
  error: string | null;
  updateConfiguration: (config: ServiceConfiguration) => Promise<ServiceOperationResult>;
  validateConfiguration: (config: ServiceConfiguration) => Promise<{ valid: boolean; errors: string[] }>;
  resetConfiguration: () => Promise<ServiceOperationResult>;
}

export interface UseServiceLogsReturn {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  filter: LogFilter;
  totalCount: number;
  hasMore: boolean;
  setFilter: (filter: LogFilter) => void;
  loadMore: () => Promise<void>;
  exportLogs: (format: 'json' | 'csv' | 'txt') => Promise<Blob>;
  clearLogs: (service?: string) => Promise<ServiceOperationResult>;
}