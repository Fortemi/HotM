/**
 * Deployment Mode Manager Component
 * 
 * Interface for managing HotM deployment configurations:
 * - Desktop Mode: All services running locally
 * - Server Mode: Client connecting to remote server
 * - Hybrid Mode: Mix of local and remote services
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert-dialog';
import { Separator } from './ui/separator';
import { 
  Monitor, 
  Server, 
  Layers,
  Network,
  Settings,
  CheckCircle,
  AlertTriangle,
  Info,
  Save,
  RefreshCw,
  Zap,
  Shield,
  Database,
  Brain,
  HardDrive
} from 'lucide-react';

import {
  DeploymentConfiguration,
  DeploymentMode,
  DeploymentModeManagerProps,
  ServiceOperationResult
} from '../types/serviceTypes';
import {
  validateDeploymentConfiguration
} from '../utils/serviceValidation';
import { ValidationError } from './common/ErrorDisplay';
import { ConfirmationDialog } from './common/ConfirmationDialog';
import { LoadingSpinner } from './common/ProgressIndicator';

/**
 * Deployment Mode Manager Component
 */
export const DeploymentModeManager: React.FC<DeploymentModeManagerProps> = ({
  currentConfiguration,
  onConfigurationChange,
  onModeSwitch
}) => {
  const [configuration, setConfiguration] = useState<DeploymentConfiguration>(currentConfiguration);
  const [originalConfiguration, setOriginalConfiguration] = useState<DeploymentConfiguration>(currentConfiguration);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    mode?: DeploymentMode;
    action: 'switch' | 'save';
  }>({ open: false, action: 'save' });

  // Update configuration when props change
  useEffect(() => {
    setConfiguration(currentConfiguration);
    setOriginalConfiguration(currentConfiguration);
  }, [currentConfiguration]);

  // Validate configuration whenever it changes
  useEffect(() => {
    const result = validateDeploymentConfiguration(configuration);
    setValidationResult(result);
  }, [configuration]);

  /**
   * Handle configuration field changes
   */
  const handleConfigurationChange = (field: keyof DeploymentConfiguration, value: any) => {
    setConfiguration(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /**
   * Handle service configuration changes
   */
  const handleServiceChange = (
    service: 'postgresql' | 'ollama' | 'hotmServer',
    field: string,
    value: any
  ) => {
    setConfiguration(prev => ({
      ...prev,
      services: {
        ...prev.services,
        [service]: {
          ...prev.services[service],
          [field]: value
        }
      }
    }));
  };

  /**
   * Handle deployment mode change
   */
  const handleModeChange = (newMode: DeploymentMode) => {
    if (newMode === configuration.mode) return;

    // Apply mode-specific defaults
    const updatedConfig = applyModeDefaults(configuration, newMode);
    setConfiguration(updatedConfig);
    
    // Show confirmation dialog
    setConfirmDialog({
      open: true,
      mode: newMode,
      action: 'switch'
    });
  };

  /**
   * Apply default configuration for a deployment mode
   */
  const applyModeDefaults = (config: DeploymentConfiguration, mode: DeploymentMode): DeploymentConfiguration => {
    const newConfig = { ...config, mode };

    switch (mode) {
      case 'Desktop':
        return {
          ...newConfig,
          services: {
            postgresql: {
              enabled: true,
              standalone: false,
              host: 'localhost',
              port: 54321,
              database: 'hotm'
            },
            ollama: {
              enabled: true,
              standalone: false,
              host: 'localhost',
              port: 11434,
              models: ['gpt-oss:20b', 'nomic-embed-text']
            },
            hotmServer: {
              enabled: true,
              host: 'localhost',
              port: 53211
            }
          }
        };

      case 'Server':
        return {
          ...newConfig,
          serverHost: config.serverHost || 'localhost',
          serverPort: config.serverPort || 53211,
          useHttps: false,
          services: {
            postgresql: {
              enabled: false,
              standalone: true,
              host: config.serverHost || 'localhost',
              port: 54321,
              database: 'hotm'
            },
            ollama: {
              enabled: false,
              standalone: true,
              host: config.serverHost || 'localhost',
              port: 11434,
              models: ['gpt-oss:20b', 'nomic-embed-text']
            },
            hotmServer: {
              enabled: false,
              host: config.serverHost || 'localhost',
              port: 53211
            }
          }
        };

      case 'Hybrid':
        return {
          ...newConfig,
          services: {
            postgresql: {
              enabled: true,
              standalone: false,
              host: 'localhost',
              port: 54321,
              database: 'hotm'
            },
            ollama: {
              enabled: false,
              standalone: true,
              host: config.serverHost || 'localhost',
              port: 11434,
              models: ['gpt-oss:20b', 'nomic-embed-text']
            },
            hotmServer: {
              enabled: true,
              host: 'localhost',
              port: 53211
            }
          }
        };

      default:
        return newConfig;
    }
  };

  /**
   * Check if configuration has changes
   */
  const hasChanges = (): boolean => {
    return JSON.stringify(configuration) !== JSON.stringify(originalConfiguration);
  };

  /**
   * Handle save configuration
   */
  const handleSave = async () => {
    if (!validationResult?.valid) return;

    setConfirmDialog({
      open: true,
      action: 'save'
    });
  };

  /**
   * Execute configuration save
   */
  const executeSave = async () => {
    setSaving(true);
    
    try {
      const result = await onConfigurationChange(configuration);
      if (result.success) {
        setOriginalConfiguration({ ...configuration });
      }
      return result;
    } catch (error) {
      console.error('Failed to save configuration:', error);
      return {
        success: false,
        message: 'Failed to save configuration',
        timestamp: new Date().toISOString()
      };
    } finally {
      setSaving(false);
      setConfirmDialog({ open: false, action: 'save' });
    }
  };

  /**
   * Execute mode switch
   */
  const executeModeSwitch = async () => {
    if (!confirmDialog.mode) return;

    setSaving(true);
    
    try {
      const result = await onModeSwitch(confirmDialog.mode);
      if (result.success) {
        await onConfigurationChange(configuration);
        setOriginalConfiguration({ ...configuration });
      }
      return result;
    } catch (error) {
      console.error('Failed to switch mode:', error);
      return {
        success: false,
        message: 'Failed to switch deployment mode',
        timestamp: new Date().toISOString()
      };
    } finally {
      setSaving(false);
      setConfirmDialog({ open: false, action: 'save' });
    }
  };

  /**
   * Get mode icon
   */
  const getModeIcon = (mode: DeploymentMode) => {
    switch (mode) {
      case 'Desktop': return <Monitor className="h-5 w-5" />;
      case 'Server': return <Server className="h-5 w-5" />;
      case 'Hybrid': return <Layers className="h-5 w-5" />;
    }
  };

  /**
   * Get mode description
   */
  const getModeDescription = (mode: DeploymentMode) => {
    switch (mode) {
      case 'Desktop': 
        return 'All services run locally on this machine. Best for development and single-user setups.';
      case 'Server': 
        return 'Connect to a remote HotM server. Ideal for centralized deployments and team collaboration.';
      case 'Hybrid': 
        return 'Mix of local and remote services. Customize which services run where for optimal performance.';
    }
  };

  /**
   * Get mode color
   */
  const getModeColor = (mode: DeploymentMode) => {
    switch (mode) {
      case 'Desktop': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Server': return 'bg-green-100 text-green-800 border-green-200';
      case 'Hybrid': return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Deployment Mode</h2>
          <p className="text-muted-foreground">
            Configure how HotM services are deployed and connected
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={getModeColor(configuration.mode)}>
            {getModeIcon(configuration.mode)}
            {configuration.mode} Mode
          </Badge>
        </div>
      </div>

      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Mode Selection</CardTitle>
          <CardDescription>Choose how you want to deploy and access HotM services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['Desktop', 'Server', 'Hybrid'] as DeploymentMode[]).map((mode) => (
              <Card
                key={mode}
                className={`cursor-pointer border-2 transition-colors hover:border-primary/50 ${
                  configuration.mode === mode 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted'
                }`}
                onClick={() => handleModeChange(mode)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    {getModeIcon(mode)}
                    <div>
                      <CardTitle className="text-lg">{mode}</CardTitle>
                      {configuration.mode === mode && (
                        <Badge variant="secondary" className="mt-1">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Current
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {getModeDescription(mode)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Tabs */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">
            <Settings className="h-4 w-4 mr-2" />
            Services
          </TabsTrigger>
          <TabsTrigger value="network">
            <Network className="h-4 w-4 mr-2" />
            Network
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Services Configuration */}
        <TabsContent value="services" className="space-y-4">
          {/* PostgreSQL Service */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle>PostgreSQL Database</CardTitle>
                  <CardDescription>Document storage and vector search</CardDescription>
                </div>
                <Switch
                  checked={configuration.services.postgresql.enabled}
                  onCheckedChange={(enabled) => 
                    handleServiceChange('postgresql', 'enabled', enabled)
                  }
                />
              </div>
            </CardHeader>
            
            {configuration.services.postgresql.enabled && (
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Run as standalone service</Label>
                  <Switch
                    checked={configuration.services.postgresql.standalone}
                    onCheckedChange={(standalone) => 
                      handleServiceChange('postgresql', 'standalone', standalone)
                    }
                  />
                </div>
                
                {configuration.services.postgresql.standalone && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pg-host">Host</Label>
                      <Input
                        id="pg-host"
                        value={configuration.services.postgresql.host || ''}
                        onChange={(e) => 
                          handleServiceChange('postgresql', 'host', e.target.value)
                        }
                        placeholder="localhost"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pg-port">Port</Label>
                      <Input
                        id="pg-port"
                        type="number"
                        value={configuration.services.postgresql.port || 54321}
                        onChange={(e) => 
                          handleServiceChange('postgresql', 'port', parseInt(e.target.value) || 54321)
                        }
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="pg-database">Database Name</Label>
                  <Input
                    id="pg-database"
                    value={configuration.services.postgresql.database || ''}
                    onChange={(e) => 
                      handleServiceChange('postgresql', 'database', e.target.value)
                    }
                    placeholder="hotm"
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Ollama Service */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-purple-600" />
                <div>
                  <CardTitle>Ollama AI Service</CardTitle>
                  <CardDescription>Local AI inference and embeddings</CardDescription>
                </div>
                <Switch
                  checked={configuration.services.ollama.enabled}
                  onCheckedChange={(enabled) => 
                    handleServiceChange('ollama', 'enabled', enabled)
                  }
                />
              </div>
            </CardHeader>
            
            {configuration.services.ollama.enabled && (
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Run as standalone service</Label>
                  <Switch
                    checked={configuration.services.ollama.standalone}
                    onCheckedChange={(standalone) => 
                      handleServiceChange('ollama', 'standalone', standalone)
                    }
                  />
                </div>
                
                {configuration.services.ollama.standalone && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ollama-host">Host</Label>
                      <Input
                        id="ollama-host"
                        value={configuration.services.ollama.host || ''}
                        onChange={(e) => 
                          handleServiceChange('ollama', 'host', e.target.value)
                        }
                        placeholder="localhost"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ollama-port">Port</Label>
                      <Input
                        id="ollama-port"
                        type="number"
                        value={configuration.services.ollama.port || 11434}
                        onChange={(e) => 
                          handleServiceChange('ollama', 'port', parseInt(e.target.value) || 11434)
                        }
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>Required Models</Label>
                  <div className="flex flex-wrap gap-2">
                    {configuration.services.ollama.models?.map((model, index) => (
                      <Badge key={index} variant="secondary">
                        {model}
                      </Badge>
                    )) || (
                      <span className="text-sm text-muted-foreground">No models specified</span>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* HotM Server */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-green-600" />
                <div>
                  <CardTitle>HotM Server</CardTitle>
                  <CardDescription>Main API server and MCP integration</CardDescription>
                </div>
                <Switch
                  checked={configuration.services.hotmServer.enabled}
                  onCheckedChange={(enabled) => 
                    handleServiceChange('hotmServer', 'enabled', enabled)
                  }
                />
              </div>
            </CardHeader>
            
            {configuration.services.hotmServer.enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="server-host">Host</Label>
                    <Input
                      id="server-host"
                      value={configuration.services.hotmServer.host || ''}
                      onChange={(e) => 
                        handleServiceChange('hotmServer', 'host', e.target.value)
                      }
                      placeholder="localhost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="server-port">Port</Label>
                    <Input
                      id="server-port"
                      type="number"
                      value={configuration.services.hotmServer.port || 53211}
                      onChange={(e) => 
                        handleServiceChange('hotmServer', 'port', parseInt(e.target.value) || 53211)
                      }
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* Network Configuration */}
        <TabsContent value="network" className="space-y-4">
          {(configuration.mode === 'Server' || configuration.mode === 'Hybrid') && (
            <Card>
              <CardHeader>
                <CardTitle>Remote Server Configuration</CardTitle>
                <CardDescription>Connection settings for remote HotM server</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="server-host-main">Server Host</Label>
                    <Input
                      id="server-host-main"
                      value={configuration.serverHost || ''}
                      onChange={(e) => handleConfigurationChange('serverHost', e.target.value)}
                      placeholder="server.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="server-port-main">Server Port</Label>
                    <Input
                      id="server-port-main"
                      type="number"
                      value={configuration.serverPort || 53211}
                      onChange={(e) => 
                        handleConfigurationChange('serverPort', parseInt(e.target.value) || 53211)
                      }
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Use HTTPS</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable secure connections to the remote server
                    </p>
                  </div>
                  <Switch
                    checked={configuration.useHttps || false}
                    onCheckedChange={(useHttps) => 
                      handleConfigurationChange('useHttps', useHttps)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Network Status</CardTitle>
              <CardDescription>Current network connectivity and health</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Local Services</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Healthy
                  </Badge>
                </div>
                
                {configuration.serverHost && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Remote Server ({configuration.serverHost})</span>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Not Tested
                    </Badge>
                  </div>
                )}
                
                <Separator />
                
                <Button variant="outline" size="sm" className="w-full">
                  <Network className="h-4 w-4 mr-2" />
                  Test Connectivity
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Configuration */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>Security settings for remote connections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auth-token">Authentication Token</Label>
                <Input
                  id="auth-token"
                  type="password"
                  value={configuration.authToken || ''}
                  onChange={(e) => handleConfigurationChange('authToken', e.target.value)}
                  placeholder="Enter authentication token (optional)"
                />
                <p className="text-sm text-muted-foreground">
                  Required for secure connections to remote servers
                </p>
              </div>
            </CardContent>
          </Card>

          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Security Note:</strong> Authentication tokens are stored securely and encrypted.
              For production deployments, always use HTTPS connections.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {/* Validation Errors */}
      {validationResult && (
        <ValidationError
          errors={validationResult.errors}
          warnings={validationResult.warnings}
          fieldName="Deployment Configuration"
        />
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-4 border-t bg-muted/20 rounded-lg">
        <div className="flex items-center gap-2">
          {loading && <LoadingSpinner size="sm" />}
          {hasChanges() && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              Unsaved Changes
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setConfiguration(originalConfiguration)}
            disabled={loading || saving || !hasChanges()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={loading || saving || !validationResult?.valid || !hasChanges()}
          >
            {saving ? (
              <LoadingSpinner size="sm" message="Saving..." />
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={
          confirmDialog.action === 'switch' 
            ? `Switch to ${confirmDialog.mode} Mode`
            : 'Save Configuration'
        }
        description={
          confirmDialog.action === 'switch'
            ? `This will reconfigure services for ${confirmDialog.mode} mode. Some services may need to be restarted.`
            : 'Save the current deployment configuration and apply changes?'
        }
        confirmText={confirmDialog.action === 'switch' ? 'Switch Mode' : 'Save'}
        severity="info"
        onConfirm={confirmDialog.action === 'switch' ? executeModeSwitch : executeSave}
        loading={saving}
      />
    </div>
  );
};

export default DeploymentModeManager;