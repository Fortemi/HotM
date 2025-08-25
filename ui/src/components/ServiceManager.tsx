/**
 * ServiceManager Component
 * 
 * Enhanced comprehensive service management interface for HotM services
 * including real-time status monitoring, control operations, health checks,
 * and performance metrics with WebSocket integration.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Settings, 
  RefreshCw,
  Clock,
  Cpu,
  HardDrive,
  Network,
  Shield,
  Monitor,
} from 'lucide-react';

// Import new components and hooks
import { useServiceStatus } from '../hooks/useServiceStatus';
import { StatusIndicator, HealthIndicator } from './common/StatusIndicator';
import { ServiceOperationDialog } from './common/ConfirmationDialog';
import { ErrorDisplay } from './common/ErrorDisplay';
import { LoadingSpinner } from './common/ProgressIndicator';
import { ServiceInfo, ServiceOperation, ServiceEvent } from '../types/serviceTypes';

// Legacy interfaces removed - now using types from serviceTypes.ts

interface ServiceManagerProps {
  className?: string;
  initialMode?: 'simple' | 'advanced';
  onServiceOperation?: (service: string, operation: ServiceOperation) => void;
  onError?: (error: string) => void;
}

interface PerformanceData {
  [serviceName: string]: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime?: number;
    errorCount: number;
  };
}

const ServiceManager: React.FC<ServiceManagerProps> = ({ 
  className, 
  initialMode = 'simple',
  onServiceOperation,
  onError
}) => {
  // Use the new service status hook for real-time updates
  const { 
    services, 
    systemHealth, 
    loading, 
    error, 
    refreshStatus, 
    controlService, 
    subscribeToEvents 
  } = useServiceStatus();

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [_selectedService, __setSelectedService] = useState<string | null>(null);
  const [operationDialog, setOperationDialog] = useState<{
    open: boolean;
    service: string;
    operation: ServiceOperation;
  } | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData>({});
  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>(initialMode);

  // Subscribe to real-time service events
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event: ServiceEvent) => {
      switch (event.type) {
        case 'performance_updated':
          setPerformanceData(prev => ({
            ...prev,
            [event.service]: event.data
          }));
          break;
        case 'error_occurred':
          if (onError) {
            onError(`${event.service}: ${event.data.message}`);
          }
          break;
        default:
          // Other events are handled by the hook
          break;
      }
    });

    return unsubscribe;
  }, [subscribeToEvents, onError]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refreshStatus();
      }, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshStatus]);

  // Enhanced refresh status with better error handling
  const handleRefreshStatus = async () => {
    try {
      await refreshStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh status';
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  // Enhanced service control with confirmation dialogs
  const handleServiceOperation = (serviceName: string, operation: ServiceOperation) => {
    setOperationDialog({
      open: true,
      service: serviceName,
      operation
    });
  };

  const executeServiceOperation = async () => {
    if (!operationDialog) return;

    try {
      const result = await controlService(operationDialog.service, operationDialog.operation);
      
      if (onServiceOperation) {
        onServiceOperation(operationDialog.service, operationDialog.operation);
      }

      if (!result.success && onError) {
        onError(result.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${operationDialog.operation} service`;
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setOperationDialog(null);
    }
  };

  // Helper function to get performance data for a service
  const getServicePerformance = (serviceName: string) => {
    return performanceData[serviceName] || {
      cpuUsage: 0,
      memoryUsage: 0,
      responseTime: 0,
      errorCount: 0
    };
  };

  // Helper function to render service metrics
  const renderServiceMetrics = (service: ServiceInfo) => {
    const performance = getServicePerformance(service.name);
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {service.uptime && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Uptime: {service.uptime}</span>
          </div>
        )}
        
        {service.port && (
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <span>Port: {service.port}</span>
          </div>
        )}
        
        {(performance.responseTime ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span>Response: {performance.responseTime?.toFixed(1)}ms</span>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <span>Errors: {performance.errorCount}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Service Management</h2>
          <p className="text-muted-foreground">
            Monitor and control HotM services
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshStatus}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Clock className="h-4 w-4 mr-2" />
            Auto Refresh
          </Button>

          <Button
            variant={viewMode === 'advanced' ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode(viewMode === 'simple' ? 'advanced' : 'simple')}
          >
            <Monitor className="h-4 w-4 mr-2" />
            {viewMode === 'simple' ? 'Advanced' : 'Simple'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <ErrorDisplay
          title="Service Management Error"
          message={error}
          severity="error"
          onRetry={handleRefreshStatus}
          onDismiss={() => {/* Error will be cleared on next successful refresh */}}
          compact
        />
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner message="Updating service status..." />
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid gap-4">
            {services.map((service) => (
              <Card key={service.name} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIndicator 
                        status={service.status} 
                        showText={false} 
                        size="md" 
                        animated
                      />
                      <div>
                        <CardTitle className="text-lg">{service.displayName}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          {service.name}
                          {service.isRequired && (
                            <Badge variant="secondary" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              Required
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <HealthIndicator 
                        health={service.health}
                        size="sm"
                        tooltip={`Service health: ${service.health}`}
                      />
                      
                      <StatusIndicator 
                        status={service.status}
                        size="sm"
                        tooltip={`Service status: ${service.status}`}
                      />
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Service Details */}
                  {renderServiceMetrics(service)}

                  {/* Enhanced Performance Metrics */}
                  {viewMode === 'advanced' && (
                    <div className="space-y-2">
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(() => {
                          const performance = getServicePerformance(service.name);
                          return (
                            <>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="flex items-center gap-2">
                                    <Cpu className="h-4 w-4" />
                                    CPU Usage
                                  </span>
                                  <span>{performance.cpuUsage.toFixed(1)}%</span>
                                </div>
                                <Progress 
                                  value={performance.cpuUsage} 
                                  className={`h-2 ${
                                    performance.cpuUsage > 80 ? 'bg-red-200' : 
                                    performance.cpuUsage > 60 ? 'bg-yellow-200' : 'bg-green-200'
                                  }`} 
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="flex items-center gap-2">
                                    <HardDrive className="h-4 w-4" />
                                    Memory
                                  </span>
                                  <span>{performance.memoryUsage.toFixed(1)} MB</span>
                                </div>
                                <Progress 
                                  value={Math.min((performance.memoryUsage / 1024) * 100, 100)} 
                                  className="h-2" 
                                />
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Dependencies */}
                  {service.dependencies.length > 0 && (
                    <div className="space-y-2">
                      <Separator />
                      <div className="text-sm">
                        <span className="font-medium">Dependencies: </span>
                        <span className="text-muted-foreground">
                          {service.dependencies.join(', ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Control Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleServiceOperation(service.name, 'start')}
                      disabled={loading || service.status === 'Running' || !service.canRestart}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleServiceOperation(service.name, 'stop')}
                      disabled={loading || service.status !== 'Running' || !service.canStop}
                    >
                      <Square className="h-4 w-4 mr-1" />
                      Stop
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleServiceOperation(service.name, 'restart')}
                      disabled={loading || service.status !== 'Running' || !service.canRestart}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restart
                    </Button>

                    {viewMode === 'advanced' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => __setSelectedService(service.name)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Configure
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="health" className="space-y-4">
          {systemHealth && (
            <>
              {/* Overall Health Status */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {systemHealth.overallHealthy ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    )}
                    <div>
                      <CardTitle>
                        System Health: {systemHealth.overallHealthy ? 'Healthy' : 'Issues Detected'}
                      </CardTitle>
                      <CardDescription>
                        Last checked: {new Date(systemHealth.checkTime).toLocaleString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* System Checks */}
              <Card>
                <CardHeader>
                  <CardTitle>System Checks</CardTitle>
                  <CardDescription>Resource and configuration validation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {systemHealth.systemChecks.map((check, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {check.healthy ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">{check.check}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {check.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              {systemHealth.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                    <CardDescription>Suggested actions to improve system health</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {systemHealth.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Service Logs</CardTitle>
              <CardDescription>Recent service events and diagnostics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Log viewing functionality will be implemented in future versions.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Service Settings</CardTitle>
              <CardDescription>Configure service behavior and monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Service configuration interface will be implemented in future versions.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Service Operation Confirmation Dialog */}
      {operationDialog && (
        <ServiceOperationDialog
          open={operationDialog.open}
          onOpenChange={(open) => !open && setOperationDialog(null)}
          serviceName={operationDialog.service}
          operation={operationDialog.operation}
          onConfirm={executeServiceOperation}
          loading={loading}
          dependencies={services.find(s => s.name === operationDialog.service)?.dependencies || []}
        />
      )}
    </div>
  );
};

export default ServiceManager;