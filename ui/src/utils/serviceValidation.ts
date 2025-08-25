/**
 * Service Configuration Validation Utilities
 * 
 * Validation functions for service configurations, port assignments,
 * and resource allocations in the HotM service management system.
 */

import { 
  ServiceConfiguration, 
  PortValidationResult, 
  ResourceRecommendation,
  DeploymentConfiguration,
  LogLevel 
} from '../types/serviceTypes';

// Port ranges for different services
const WELL_KNOWN_PORTS = new Set(Array.from({ length: 1024 }, (_, i) => i));
const HOTM_PORT_RANGES = {
  postgresql: { min: 54320, max: 54330 },
  ollama: { min: 11430, max: 11440 },
  hotmServer: { min: 53210, max: 53220 }
};

const DEFAULT_PORTS = {
  postgresql: 54321,
  ollama: 11434,
  hotmServer: 53211
};

/**
 * Validates a port number for availability and appropriateness
 */
export function validatePort(
  port: number, 
  service: string, 
  excludePorts: number[] = []
): PortValidationResult {
  // Check basic port range
  if (port < 1 || port > 65535) {
    return {
      port,
      available: false,
      recommendation: getRecommendedPort(service),
    };
  }

  // Check if port is in well-known range (avoid unless necessary)
  if (WELL_KNOWN_PORTS.has(port)) {
    return {
      port,
      available: false,
      conflictingService: 'System Reserved',
      recommendation: getRecommendedPort(service),
    };
  }

  // Check if port is already in use by another service
  if (excludePorts.includes(port)) {
    return {
      port,
      available: false,
      conflictingService: 'Another HotM Service',
      recommendation: getRecommendedPort(service, excludePorts),
    };
  }

  return {
    port,
    available: true,
  };
}

/**
 * Gets the recommended port for a service
 */
function getRecommendedPort(service: string, excludePorts: number[] = []): number {
  const serviceKey = service.toLowerCase().replace('hotm-', '').replace('-', '');
  const range = HOTM_PORT_RANGES[serviceKey as keyof typeof HOTM_PORT_RANGES];
  const defaultPort = DEFAULT_PORTS[serviceKey as keyof typeof DEFAULT_PORTS];

  if (defaultPort && !excludePorts.includes(defaultPort)) {
    return defaultPort;
  }

  if (range) {
    for (let port = range.min; port <= range.max; port++) {
      if (!excludePorts.includes(port)) {
        return port;
      }
    }
  }

  // Fallback to finding any available port in safe range
  for (let port = 49152; port <= 65535; port++) {
    if (!excludePorts.includes(port)) {
      return port;
    }
  }

  return defaultPort || 53211;
}

/**
 * Validates service configuration
 */
export function validateServiceConfiguration(
  config: ServiceConfiguration,
  existingConfigs: ServiceConfiguration[] = []
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate service name
  if (!config.name || config.name.trim().length === 0) {
    errors.push('Service name is required');
  } else if (!/^[a-zA-Z0-9-_]+$/.test(config.name)) {
    errors.push('Service name can only contain letters, numbers, hyphens, and underscores');
  }

  // Validate port
  const usedPorts = existingConfigs
    .filter(c => c.name !== config.name)
    .map(c => c.port);
  
  const portValidation = validatePort(config.port, config.name, usedPorts);
  if (!portValidation.available) {
    if (portValidation.conflictingService) {
      errors.push(`Port ${config.port} is already in use by ${portValidation.conflictingService}`);
    } else {
      errors.push(`Port ${config.port} is not available`);
    }
  }

  // Validate memory allocation
  if (config.maxMemoryMB <= 0) {
    errors.push('Memory allocation must be greater than 0');
  } else if (config.maxMemoryMB < 128) {
    warnings.push('Memory allocation is very low (< 128 MB) and may cause performance issues');
  } else if (config.maxMemoryMB > 8192) {
    warnings.push('Memory allocation is very high (> 8 GB) and may not be necessary');
  }

  // Validate CPU allocation
  if (config.maxCpuPercent <= 0 || config.maxCpuPercent > 100) {
    errors.push('CPU percentage must be between 1 and 100');
  } else if (config.maxCpuPercent < 10) {
    warnings.push('CPU allocation is very low (< 10%) and may cause performance issues');
  }

  // Validate log level
  const validLogLevels: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
  if (!validLogLevels.includes(config.logLevel)) {
    errors.push('Invalid log level. Must be one of: ERROR, WARN, INFO, DEBUG, TRACE');
  }

  // Validate log retention
  if (config.logRetentionDays < 1 || config.logRetentionDays > 365) {
    errors.push('Log retention must be between 1 and 365 days');
  }

  // Validate health check interval
  if (config.healthCheckInterval < 10 || config.healthCheckInterval > 300) {
    errors.push('Health check interval must be between 10 and 300 seconds');
  }

  // Validate working directory
  if (config.workingDirectory && config.workingDirectory.trim().length === 0) {
    warnings.push('Working directory is empty');
  }

  // Validate environment variables
  for (const [key, value] of Object.entries(config.environmentVariables)) {
    if (!key || key.trim().length === 0) {
      errors.push('Environment variable names cannot be empty');
    }
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      warnings.push(`Environment variable "${key}" should follow standard naming convention (UPPERCASE_WITH_UNDERSCORES)`);
    }
  }

  // Service-specific validations
  if (config.name.toLowerCase().includes('postgresql')) {
    if (config.maxMemoryMB < 256) {
      warnings.push('PostgreSQL typically requires at least 256 MB of memory');
    }
  } else if (config.name.toLowerCase().includes('ollama')) {
    if (config.maxMemoryMB < 1024) {
      warnings.push('Ollama typically requires at least 1 GB of memory for AI models');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generates resource recommendations based on service type and current usage
 */
export function generateResourceRecommendations(
  serviceName: string,
  currentMetrics: { cpuUsage?: number; memoryUsage?: number },
  currentConfig: ServiceConfiguration
): ResourceRecommendation[] {
  const recommendations: ResourceRecommendation[] = [];
  const serviceType = serviceName.toLowerCase().replace('hotm-', '');

  // Memory recommendations
  if (currentMetrics.memoryUsage !== undefined) {
    const memoryUtilization = (currentMetrics.memoryUsage / currentConfig.maxMemoryMB) * 100;
    
    if (memoryUtilization > 85) {
      const recommendedMemory = Math.ceil(currentConfig.maxMemoryMB * 1.5);
      recommendations.push({
        service: serviceName,
        currentMemoryMB: currentConfig.maxMemoryMB,
        recommendedMemoryMB: recommendedMemory,
        currentCpuPercent: currentConfig.maxCpuPercent,
        recommendedCpuPercent: currentConfig.maxCpuPercent,
        reason: `High memory utilization (${memoryUtilization.toFixed(1)}%). Increase memory allocation.`,
        priority: 'high'
      });
    } else if (memoryUtilization < 30 && currentConfig.maxMemoryMB > getMinMemoryForService(serviceType)) {
      const recommendedMemory = Math.max(
        Math.ceil(currentConfig.maxMemoryMB * 0.8),
        getMinMemoryForService(serviceType)
      );
      recommendations.push({
        service: serviceName,
        currentMemoryMB: currentConfig.maxMemoryMB,
        recommendedMemoryMB: recommendedMemory,
        currentCpuPercent: currentConfig.maxCpuPercent,
        recommendedCpuPercent: currentConfig.maxCpuPercent,
        reason: `Low memory utilization (${memoryUtilization.toFixed(1)}%). Consider reducing allocation.`,
        priority: 'low'
      });
    }
  }

  // CPU recommendations
  if (currentMetrics.cpuUsage !== undefined) {
    if (currentMetrics.cpuUsage > 80) {
      const recommendedCpu = Math.min(currentConfig.maxCpuPercent + 20, 100);
      recommendations.push({
        service: serviceName,
        currentMemoryMB: currentConfig.maxMemoryMB,
        recommendedMemoryMB: currentConfig.maxMemoryMB,
        currentCpuPercent: currentConfig.maxCpuPercent,
        recommendedCpuPercent: recommendedCpu,
        reason: `High CPU utilization (${currentMetrics.cpuUsage.toFixed(1)}%). Increase CPU allocation.`,
        priority: 'medium'
      });
    }
  }

  return recommendations;
}

/**
 * Gets minimum recommended memory for a service type
 */
function getMinMemoryForService(serviceType: string): number {
  switch (serviceType) {
    case 'postgresql': return 256;
    case 'ollama': return 1024;
    case 'server': return 128;
    default: return 128;
  }
}

/**
 * Validates deployment configuration
 */
export function validateDeploymentConfiguration(
  config: DeploymentConfiguration
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate mode-specific requirements
  switch (config.mode) {
    case 'Desktop':
      // Desktop mode should have all services enabled locally
      if (!config.services.postgresql.enabled || 
          !config.services.ollama.enabled || 
          !config.services.hotmServer.enabled) {
        warnings.push('Desktop mode typically requires all services to be enabled locally');
      }
      break;

    case 'Server':
      // Server mode should have server-side services enabled
      if (!config.services.hotmServer.enabled) {
        errors.push('Server mode requires HotM Server to be enabled');
      }
      if (config.serverHost && !isValidHostname(config.serverHost)) {
        errors.push('Invalid server hostname format');
      }
      if (config.serverPort && (config.serverPort < 1 || config.serverPort > 65535)) {
        errors.push('Invalid server port number');
      }
      break;

    case 'Hybrid':
      // Hybrid mode should have at least one service enabled
      if (!config.services.postgresql.enabled && 
          !config.services.ollama.enabled && 
          !config.services.hotmServer.enabled) {
        errors.push('Hybrid mode requires at least one service to be enabled');
      }
      break;
  }

  // Validate service configurations
  if (config.services.postgresql.enabled && config.services.postgresql.standalone) {
    if (config.services.postgresql.host && !isValidHostname(config.services.postgresql.host)) {
      errors.push('Invalid PostgreSQL hostname format');
    }
    if (config.services.postgresql.port && 
        (config.services.postgresql.port < 1 || config.services.postgresql.port > 65535)) {
      errors.push('Invalid PostgreSQL port number');
    }
  }

  if (config.services.ollama.enabled && config.services.ollama.standalone) {
    if (config.services.ollama.host && !isValidHostname(config.services.ollama.host)) {
      errors.push('Invalid Ollama hostname format');
    }
    if (config.services.ollama.port && 
        (config.services.ollama.port < 1 || config.services.ollama.port > 65535)) {
      errors.push('Invalid Ollama port number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates hostname format
 */
function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length === 0) return false;
  
  // Check for localhost variations
  if (['localhost', '127.0.0.1', '::1'].includes(hostname.toLowerCase())) {
    return true;
  }

  // Check IP address format
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipRegex.test(hostname)) {
    return true;
  }

  // Check hostname format
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(hostname) && hostname.length <= 253;
}

/**
 * Sanitizes configuration input to prevent injection attacks
 */
export function sanitizeConfiguration(config: ServiceConfiguration): ServiceConfiguration {
  return {
    ...config,
    name: config.name.trim().replace(/[^a-zA-Z0-9-_]/g, ''),
    workingDirectory: config.workingDirectory.trim(),
    commandLineArgs: config.commandLineArgs.map(arg => arg.trim()),
    environmentVariables: Object.fromEntries(
      Object.entries(config.environmentVariables).map(([key, value]) => [
        key.trim().replace(/[^A-Z0-9_]/g, ''),
        value.trim()
      ])
    ),
    healthCheckUrl: config.healthCheckUrl?.trim()
  };
}

/**
 * Checks if configuration changes require service restart
 */
export function requiresRestart(
  oldConfig: ServiceConfiguration, 
  newConfig: ServiceConfiguration
): boolean {
  const restartRequired = [
    'port',
    'maxMemoryMB',
    'maxCpuPercent',
    'workingDirectory',
    'environmentVariables',
    'commandLineArgs'
  ];

  return restartRequired.some(field => {
    if (field === 'environmentVariables') {
      return JSON.stringify(oldConfig[field]) !== JSON.stringify(newConfig[field]);
    }
    if (field === 'commandLineArgs') {
      return JSON.stringify(oldConfig[field]) !== JSON.stringify(newConfig[field]);
    }
    return oldConfig[field as keyof ServiceConfiguration] !== newConfig[field as keyof ServiceConfiguration];
  });
}