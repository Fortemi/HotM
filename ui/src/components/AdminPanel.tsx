/**
 * Administrative Panel Component
 * 
 * Advanced administrative interface for HotM service management including:
 * - Service installation and management
 * - System monitoring and performance analytics
 * - Backup and restore operations
 * - Security configuration and audit
 * - Update management and maintenance
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert-dialog';
import { 
  Shield, 
  Database, 
  Download, 
  Upload,
  Settings,
  Monitor,
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  Cpu,
  Network,
  Users,
  Key,
  FileText,
  TrendingUp,
  Calendar,
  Archive,
  RefreshCw,
  Play,
  Square,
  Trash2,
  Plus,
  Eye,
  BarChart3
} from 'lucide-react';

import {
  AdminPanelProps,
  ServiceOperationResult,
  InstallationStatus,
  BackupConfiguration,
  DiagnosticInfo
} from '../types/serviceTypes';
import { useServiceStatus } from '../hooks/useServiceStatus';
import { StatusIndicator } from './common/StatusIndicator';
import { ConfirmationDialog } from './common/ConfirmationDialog';
import { LoadingSpinner, OperationProgress, MultiStepProgress } from './common/ProgressIndicator';
import { ErrorDisplay } from './common/ErrorDisplay';

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkTraffic: {
    inbound: number;
    outbound: number;
  };
  uptime: number;
  timestamp: Date;
}

interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  lastRun?: Date;
  nextRun?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  frequency: 'daily' | 'weekly' | 'monthly';
}

/**
 * Administrative Panel Component
 */
export const AdminPanel: React.FC<AdminPanelProps> = ({
  className = '',
  userRole,
  onBackup,
  onRestore
}) => {
  const { services, systemHealth, loading, refreshStatus } = useServiceStatus();
  
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [installationStatuses, setInstallationStatuses] = useState<InstallationStatus[]>([]);
  const [backupConfig, setBackupConfig] = useState<BackupConfiguration | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    operation: string;
    target?: string;
  }>({ open: false, operation: '' });

  // Mock data initialization
  useEffect(() => {
    // Initialize system metrics
    const metrics: SystemMetrics = {
      cpuUsage: 25 + Math.random() * 30,
      memoryUsage: 45 + Math.random() * 25,
      diskUsage: 60 + Math.random() * 20,
      networkTraffic: {
        inbound: Math.random() * 100,
        outbound: Math.random() * 100
      },
      uptime: Math.floor(Math.random() * 7 * 24 * 3600), // Random uptime in seconds
      timestamp: new Date()
    };
    setSystemMetrics(metrics);

    // Initialize installation statuses
    const installations: InstallationStatus[] = [
      {
        service: 'HotM-PostgreSQL',
        installed: true,
        version: '15.4',
        path: 'C:\\Program Files\\HotM\\PostgreSQL',
        configurationValid: true,
        issues: [],
        canUpgrade: false
      },
      {
        service: 'HotM-Ollama',
        installed: true,
        version: '0.1.26',
        path: 'C:\\Program Files\\HotM\\Ollama',
        configurationValid: true,
        issues: [],
        canUpgrade: true,
        availableVersion: '0.1.32'
      },
      {
        service: 'HotM-Server',
        installed: true,
        version: '0.1.0',
        path: 'C:\\Program Files\\HotM\\Server',
        configurationValid: true,
        issues: [],
        canUpgrade: false
      }
    ];
    setInstallationStatuses(installations);

    // Initialize backup configuration
    const backup: BackupConfiguration = {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      location: 'C:\\HotM\\Backups',
      retentionDays: 30,
      includeConfigurations: true,
      includeLogs: false,
      includeDatabase: true,
      compression: true
    };
    setBackupConfig(backup);

    // Initialize maintenance tasks
    const tasks: MaintenanceTask[] = [
      {
        id: 'cleanup-logs',
        name: 'Log Cleanup',
        description: 'Remove old log files based on retention policy',
        lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000),
        nextRun: new Date(Date.now() + 23 * 60 * 60 * 1000),
        status: 'completed',
        frequency: 'daily'
      },
      {
        id: 'database-vacuum',
        name: 'Database Maintenance',
        description: 'PostgreSQL VACUUM and ANALYZE operations',
        lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        nextRun: new Date(Date.now() + 12 * 60 * 60 * 1000),
        status: 'pending',
        frequency: 'weekly'
      },
      {
        id: 'system-health-check',
        name: 'System Health Check',
        description: 'Comprehensive system health and performance check',
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
        nextRun: new Date(Date.now() + 22 * 60 * 60 * 1000),
        status: 'completed',
        frequency: 'daily'
      }
    ];
    setMaintenanceTasks(tasks);
  }, []);

  /**
   * Handle administrative operation
   */
  const handleOperation = (operation: string, target?: string) => {
    setConfirmDialog({
      open: true,
      operation,
      target
    });
  };

  /**
   * Execute administrative operation
   */
  const executeOperation = async () => {
    const { operation, target } = confirmDialog;
    
    try {
      switch (operation) {
        case 'backup':
          return await onBackup();
        case 'restore':
          if (target) {
            return await onRestore(target);
          }
          break;
        case 'install':
          return await mockInstallService(target || '');
        case 'uninstall':
          return await mockUninstallService(target || '');
        case 'upgrade':
          return await mockUpgradeService(target || '');
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Operation failed',
        timestamp: new Date().toISOString()
      };
    } finally {
      setConfirmDialog({ open: false, operation: '' });
    }
  };

  // Mock service operations
  const mockInstallService = async (serviceName: string): Promise<ServiceOperationResult> => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, message: `Service ${serviceName} installed successfully`, timestamp: new Date().toISOString() };
  };

  const mockUninstallService = async (serviceName: string): Promise<ServiceOperationResult> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { success: true, message: `Service ${serviceName} uninstalled successfully`, timestamp: new Date().toISOString() };
  };

  const mockUpgradeService = async (serviceName: string): Promise<ServiceOperationResult> => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    return { success: true, message: `Service ${serviceName} upgraded successfully`, timestamp: new Date().toISOString() };
  };

  /**
   * Format uptime display
   */
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  /**
   * Get task status color
   */
  const getTaskStatusColor = (status: MaintenanceTask['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (userRole === 'user') {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Administrative Access Required</h3>
            <p className="text-muted-foreground">
              This panel requires administrative privileges to access advanced system management features.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Administrative Panel</h2>
          <p className="text-muted-foreground">
            Advanced system management and maintenance tools
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Users className="h-3 w-3 mr-1" />
            {userRole}
          </Badge>
          <Button variant="outline" size="sm" onClick={refreshStatus}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <StatusIndicator 
                status={systemHealth?.overallHealthy ? 'Running' : 'Error'} 
                showText={false} 
              />
              <span className="text-2xl font-bold">
                {systemHealth?.overallHealthy ? 'Healthy' : 'Issues'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {services.filter(s => s.status === 'Running').length} of {services.length} services running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemMetrics?.cpuUsage.toFixed(1)}%
            </div>
            <Progress value={systemMetrics?.cpuUsage} className="h-1 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemMetrics?.memoryUsage.toFixed(1)}%
            </div>
            <Progress value={systemMetrics?.memoryUsage} className="h-1 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              System Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemMetrics ? formatUptime(systemMetrics.uptime) : '--'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Since last restart
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Admin Tabs */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="services">
            <Settings className="h-4 w-4 mr-2" />
            Services
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            <BarChart3 className="h-4 w-4 mr-2" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Archive className="h-4 w-4 mr-2" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Calendar className="h-4 w-4 mr-2" />
            Maintenance
          </TabsTrigger>
        </TabsList>

        {/* Service Management Tab */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Installation Management</CardTitle>
              <CardDescription>Install, upgrade, and manage HotM services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {installationStatuses.map((installation) => (
                  <div key={installation.service} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <StatusIndicator 
                        status={installation.installed ? 'Running' : 'NotInstalled'} 
                        showText={false} 
                      />
                      <div>
                        <div className="font-medium">{installation.service}</div>
                        <div className="text-sm text-muted-foreground">
                          {installation.installed ? (
                            <>
                              Version {installation.version}
                              {installation.availableVersion && (
                                <span className="ml-2 text-blue-600">
                                  • Update available: {installation.availableVersion}
                                </span>
                              )}
                            </>
                          ) : (
                            'Not installed'
                          )}
                        </div>
                        {installation.path && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {installation.path}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {installation.canUpgrade && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOperation('upgrade', installation.service)}
                        >
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Upgrade
                        </Button>
                      )}
                      
                      {installation.installed ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOperation('uninstall', installation.service)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Uninstall
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOperation('install', installation.service)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Install
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Metrics</CardTitle>
                <CardDescription>Real-time system performance data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>CPU Usage</span>
                      <span>{systemMetrics?.cpuUsage.toFixed(1)}%</span>
                    </div>
                    <Progress value={systemMetrics?.cpuUsage} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory Usage</span>
                      <span>{systemMetrics?.memoryUsage.toFixed(1)}%</span>
                    </div>
                    <Progress value={systemMetrics?.memoryUsage} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Disk Usage</span>
                      <span>{systemMetrics?.diskUsage.toFixed(1)}%</span>
                    </div>
                    <Progress value={systemMetrics?.diskUsage} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Network Activity</CardTitle>
                <CardDescription>Network traffic and connectivity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {systemMetrics?.networkTraffic.inbound.toFixed(1)}
                    </div>
                    <div className="text-sm text-muted-foreground">MB/s Inbound</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {systemMetrics?.networkTraffic.outbound.toFixed(1)}
                    </div>
                    <div className="text-sm text-muted-foreground">MB/s Outbound</div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Active Connections</span>
                    <Badge variant="secondary">12</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Port 53211 (HotM)</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Open
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Backup Configuration</CardTitle>
                <CardDescription>Automated backup settings and schedule</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {backupConfig && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label>Automatic Backups</Label>
                      <Badge variant={backupConfig.enabled ? "secondary" : "outline"}>
                        {backupConfig.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>Schedule</span>
                        <span className="font-mono">{backupConfig.schedule}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Location</span>
                        <span className="font-mono text-xs">{backupConfig.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Retention</span>
                        <span>{backupConfig.retentionDays} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Compression</span>
                        <span>{backupConfig.compression ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Includes:</Label>
                      <div className="space-y-1 text-sm">
                        {backupConfig.includeDatabase && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            Database
                          </div>
                        )}
                        {backupConfig.includeConfigurations && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            Configurations
                          </div>
                        )}
                        {backupConfig.includeLogs && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            Logs
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Backup Operations</CardTitle>
                <CardDescription>Manual backup and restore operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Button 
                    className="w-full" 
                    onClick={() => handleOperation('backup')}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Create Backup Now
                  </Button>
                  
                  <div className="space-y-2">
                    <Label htmlFor="restore-file">Restore from Backup</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="restore-file"
                        placeholder="Select backup file..."
                        readOnly
                      />
                      <Button 
                        variant="outline"
                        onClick={() => handleOperation('restore', 'selected-file.backup')}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label className="text-sm">Recent Backups</Label>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span>2024-01-20 02:00</span>
                      <Button variant="ghost" size="sm">
                        <Download className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span>2024-01-19 02:00</span>
                      <Button variant="ghost" size="sm">
                        <Download className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Status</CardTitle>
              <CardDescription>System security configuration and audit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Security Status:</strong> All security checks passed. System is secure.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Security Checks</Label>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Firewall Status</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>SSL/TLS Certificates</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Valid
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Authentication</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Configured
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Access Controls</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Quick Actions</Label>
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Key className="h-4 w-4 mr-2" />
                        Regenerate API Keys
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Eye className="h-4 w-4 mr-2" />
                        View Security Logs
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Shield className="h-4 w-4 mr-2" />
                        Security Audit
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Maintenance Tasks</CardTitle>
              <CardDescription>Automated maintenance and optimization tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {maintenanceTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="font-medium">{task.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {task.description}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {task.lastRun && (
                            <span>Last run: {task.lastRun.toLocaleString()}</span>
                          )}
                          {task.nextRun && (
                            <span className="ml-4">Next: {task.nextRun.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={getTaskStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                      <Badge variant="secondary">
                        {task.frequency}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Play className="h-4 w-4 mr-1" />
                        Run Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={`Confirm ${confirmDialog.operation}`}
        description={`Are you sure you want to ${confirmDialog.operation}${confirmDialog.target ? ` ${confirmDialog.target}` : ''}?`}
        confirmText={confirmDialog.operation.charAt(0).toUpperCase() + confirmDialog.operation.slice(1)}
        severity={confirmDialog.operation === 'uninstall' ? 'error' : 'info'}
        destructive={confirmDialog.operation === 'uninstall'}
        onConfirm={executeOperation}
      />
    </div>
  );
};

export default AdminPanel;