/**
 * Service Configuration Component
 * 
 * Comprehensive interface for configuring HotM services including:
 * - Port management and validation
 * - Resource allocation (CPU, memory)
 * - Security settings and environment variables
 * - Startup configuration and dependencies
 * - Advanced configuration options
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Save, 
  X, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  Settings,
  Shield,
  Zap,
  Network,
  HardDrive,
  Cpu,
  Eye,
  EyeOff,
  Plus,
  Trash2
} from 'lucide-react';

import type { 
  ServiceConfiguration as ServiceConfigurationType, 
} from '../types/serviceTypes';
import { 
  ServiceOperationResult,
  LogLevel,
  PortValidationResult 
} from '../types/serviceTypes';
import { 
  validateServiceConfiguration, 
  validatePort, 
  sanitizeConfiguration, 
  requiresRestart 
} from '../utils/serviceValidation';
import { ValidationError } from './common/ErrorDisplay';
import { ConfigurationChangeDialog } from './common/ConfirmationDialog';
import { LoadingSpinner } from './common/ProgressIndicator';

interface ServiceConfigurationComponentProps {
  serviceName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ServiceConfigurationType) => Promise<ServiceOperationResult>;
  initialConfiguration?: ServiceConfigurationType;
  existingConfigurations?: ServiceConfigurationType[];
  readonly?: boolean;
  className?: string;
}

/**
 * Service Configuration Component
 */
export const ServiceConfiguration: React.FC<ServiceConfigurationComponentProps> = ({
  serviceName,
  isOpen,
  onClose,
  onSave,
  initialConfiguration,
  existingConfigurations = [],
  readonly = false,
  className = ''
}) => {
  const [configuration, setConfiguration] = useState<ServiceConfigurationType>(() => 
    initialConfiguration || getDefaultConfiguration(serviceName)
  );
  const [originalConfiguration, setOriginalConfiguration] = useState<ServiceConfigurationType | null>(null);
  const [_loading, _setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [portValidation, setPortValidation] = useState<PortValidationResult | null>(null);
  const [showEnvironmentValues, setShowEnvironmentValues] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);

  // Initialize original configuration for change tracking
  useEffect(() => {
    if (initialConfiguration && !originalConfiguration) {
      setOriginalConfiguration({ ...initialConfiguration });
    }
  }, [initialConfiguration, originalConfiguration]);

  // Validate configuration whenever it changes
  useEffect(() => {
    const result = validateServiceConfiguration(configuration, existingConfigurations);
    setValidationResult(result);

    // Validate port separately for better UX
    const portResult = validatePort(
      configuration.port, 
      configuration.name,
      existingConfigurations.filter(c => c.name !== configuration.name).map(c => c.port)
    );
    setPortValidation(portResult);
  }, [configuration, existingConfigurations]);

  /**
   * Handle input changes with validation
   */
  const handleInputChange = (field: keyof ServiceConfigurationType, value: any) => {
    setConfiguration(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /**
   * Handle environment variable changes
   */
  const handleEnvironmentVariableChange = (key: string, value: string, oldKey?: string) => {
    setConfiguration(prev => {
      const newEnvVars = { ...prev.environmentVariables };
      
      if (oldKey && oldKey !== key) {
        delete newEnvVars[oldKey];
      }
      
      if (key.trim()) {
        newEnvVars[key] = value;
      }
      
      return {
        ...prev,
        environmentVariables: newEnvVars
      };
    });
  };

  /**
   * Add new environment variable
   */
  const addEnvironmentVariable = () => {
    const newKey = `NEW_VAR_${Object.keys(configuration.environmentVariables).length + 1}`;
    handleEnvironmentVariableChange(newKey, '');
  };

  /**
   * Remove environment variable
   */
  const removeEnvironmentVariable = (key: string) => {
    setConfiguration(prev => {
      const newEnvVars = { ...prev.environmentVariables };
      delete newEnvVars[key];
      return {
        ...prev,
        environmentVariables: newEnvVars
      };
    });
  };

  /**
   * Handle command line argument changes
   */
  const handleCommandLineArgChange = (index: number, value: string) => {
    setConfiguration(prev => ({
      ...prev,
      commandLineArgs: prev.commandLineArgs.map((arg, i) => i === index ? value : arg)
    }));
  };

  /**
   * Add new command line argument
   */
  const addCommandLineArg = () => {
    setConfiguration(prev => ({
      ...prev,
      commandLineArgs: [...prev.commandLineArgs, '']
    }));
  };

  /**
   * Remove command line argument
   */
  const removeCommandLineArg = (index: number) => {
    setConfiguration(prev => ({
      ...prev,
      commandLineArgs: prev.commandLineArgs.filter((_, i) => i !== index)
    }));
  };

  /**
   * Reset configuration to defaults
   */
  const resetConfiguration = () => {
    const defaultConfig = getDefaultConfiguration(serviceName);
    setConfiguration(defaultConfig);
  };

  /**
   * Check if configuration has changes
   */
  const hasChanges = (): boolean => {
    if (!originalConfiguration) return false;
    return JSON.stringify(configuration) !== JSON.stringify(originalConfiguration);
  };

  /**
   * Get list of changes for confirmation dialog
   */
  const getChanges = () => {
    if (!originalConfiguration) return [];
    
    const changes: { field: string; oldValue: string; newValue: string }[] = [];
    
    Object.keys(configuration).forEach(key => {
      const field = key as keyof ServiceConfigurationType;
      const oldVal = originalConfiguration[field];
      const newVal = configuration[field];
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: key,
          oldValue: typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal),
          newValue: typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)
        });
      }
    });
    
    return changes;
  };

  /**
   * Handle save configuration
   */
  const handleSave = async () => {
    if (!validationResult?.valid) {
      return;
    }

    if (hasChanges()) {
      setConfirmDialog(true);
    } else {
      await saveConfiguration();
    }
  };

  /**
   * Save configuration to backend
   */
  const saveConfiguration = async () => {
    setSaving(true);
    
    try {
      const sanitizedConfig = sanitizeConfiguration(configuration);
      const result = await onSave(sanitizedConfig);
      
      if (result.success) {
        setOriginalConfiguration({ ...sanitizedConfig });
        onClose();
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
    } finally {
      setSaving(false);
      setConfirmDialog(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 ${className}`}>
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configure {serviceName}
              </CardTitle>
              <CardDescription>
                Manage service configuration, resources, and security settings
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {hasChanges() && !readonly && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Unsaved Changes
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="overflow-y-auto max-h-[70vh]">
          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">
                <Settings className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger value="resources">
                <Zap className="h-4 w-4 mr-2" />
                Resources
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="h-4 w-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <Settings className="h-4 w-4 mr-2" />
                Advanced
              </TabsTrigger>
            </TabsList>

            {/* General Configuration */}
            <TabsContent value="general" className="space-y-6">
              {/* Basic Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Settings</CardTitle>
                  <CardDescription>Service identification and network configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="serviceName">Service Name</Label>
                      <Input
                        id="serviceName"
                        value={configuration.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        disabled={readonly}
                        placeholder="Service identifier"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="port" className="flex items-center gap-2">
                        <Network className="h-4 w-4" />
                        Port Number
                        {portValidation && !portValidation.available && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </Label>
                      <Input
                        id="port"
                        type="number"
                        min="1"
                        max="65535"
                        value={configuration.port}
                        onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 0)}
                        disabled={readonly}
                        placeholder="Port number"
                        className={portValidation && !portValidation.available ? 'border-red-300' : ''}
                      />
                      {portValidation && !portValidation.available && (
                        <div className="text-sm text-red-600">
                          Port unavailable: {portValidation.conflictingService}
                          {portValidation.recommendation && (
                            <span className="block">Suggested: {portValidation.recommendation}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workingDirectory">Working Directory</Label>
                    <Input
                      id="workingDirectory"
                      value={configuration.workingDirectory}
                      onChange={(e) => handleInputChange('workingDirectory', e.target.value)}
                      disabled={readonly}
                      placeholder="Service working directory"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Startup Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Startup Configuration</CardTitle>
                  <CardDescription>Service startup behavior and dependencies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Auto Start</Label>
                        <p className="text-sm text-muted-foreground">
                          Start service automatically on system boot
                        </p>
                      </div>
                      <Switch
                        checked={configuration.autoStart}
                        onCheckedChange={(checked) => handleInputChange('autoStart', checked)}
                        disabled={readonly}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Restart on Failure</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically restart if service crashes
                        </p>
                      </div>
                      <Switch
                        checked={configuration.restartOnFailure}
                        onCheckedChange={(checked) => handleInputChange('restartOnFailure', checked)}
                        disabled={readonly}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="healthCheckUrl">Health Check URL</Label>
                    <Input
                      id="healthCheckUrl"
                      value={configuration.healthCheckUrl || ''}
                      onChange={(e) => handleInputChange('healthCheckUrl', e.target.value)}
                      disabled={readonly}
                      placeholder="HTTP endpoint for health checks (optional)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="healthCheckInterval">Health Check Interval (seconds)</Label>
                    <Input
                      id="healthCheckInterval"
                      type="number"
                      min="10"
                      max="300"
                      value={configuration.healthCheckInterval}
                      onChange={(e) => handleInputChange('healthCheckInterval', parseInt(e.target.value) || 30)}
                      disabled={readonly}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Resource Configuration */}
            <TabsContent value="resources" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resource Limits</CardTitle>
                  <CardDescription>CPU and memory allocation limits</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        Maximum CPU Usage ({configuration.maxCpuPercent}%)
                      </Label>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={configuration.maxCpuPercent}
                        onChange={(e) => handleInputChange('maxCpuPercent', parseInt(e.target.value))}
                        disabled={readonly}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>1%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        Maximum Memory ({configuration.maxMemoryMB} MB)
                      </Label>
                      <input
                        type="range"
                        min="128"
                        max="8192"
                        step="128"
                        value={configuration.maxMemoryMB}
                        onChange={(e) => handleInputChange('maxMemoryMB', parseInt(e.target.value))}
                        disabled={readonly}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>128 MB</span>
                        <span>2 GB</span>
                        <span>8 GB</span>
                      </div>
                    </div>
                  </div>

                  {/* Resource recommendations based on service type */}
                  <Alert className="bg-blue-50 border-blue-200">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>Recommended settings for {serviceName}:</strong><br />
                      {getResourceRecommendation(serviceName)}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Configuration */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Environment Variables</CardTitle>
                  <CardDescription>Service environment configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Environment Variables</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEnvironmentValues(!showEnvironmentValues)}
                      >
                        {showEnvironmentValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showEnvironmentValues ? 'Hide' : 'Show'} Values
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addEnvironmentVariable}
                        disabled={readonly}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Variable
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {Object.entries(configuration.environmentVariables).map(([key, value], index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={key}
                          onChange={(e) => handleEnvironmentVariableChange(e.target.value, value, key)}
                          disabled={readonly}
                          placeholder="VARIABLE_NAME"
                          className="flex-1"
                        />
                        <span className="text-muted-foreground">=</span>
                        <Input
                          type={showEnvironmentValues ? 'text' : 'password'}
                          value={value}
                          onChange={(e) => handleEnvironmentVariableChange(key, e.target.value)}
                          disabled={readonly}
                          placeholder="value"
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEnvironmentVariable(key)}
                          disabled={readonly}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Advanced Configuration */}
            <TabsContent value="advanced" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Logging Configuration</CardTitle>
                  <CardDescription>Log level and retention settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="logLevel">Log Level</Label>
                      <Select
                        value={configuration.logLevel}
                        onValueChange={(value: LogLevel) => handleInputChange('logLevel', value)}
                        disabled={readonly}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ERROR">ERROR</SelectItem>
                          <SelectItem value="WARN">WARN</SelectItem>
                          <SelectItem value="INFO">INFO</SelectItem>
                          <SelectItem value="DEBUG">DEBUG</SelectItem>
                          <SelectItem value="TRACE">TRACE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="logRetention">Log Retention (days)</Label>
                      <Input
                        id="logRetention"
                        type="number"
                        min="1"
                        max="365"
                        value={configuration.logRetentionDays}
                        onChange={(e) => handleInputChange('logRetentionDays', parseInt(e.target.value) || 30)}
                        disabled={readonly}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Command Line Arguments</CardTitle>
                  <CardDescription>Additional command line parameters for the service</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Arguments</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addCommandLineArg}
                      disabled={readonly}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Argument
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {configuration.commandLineArgs.map((arg, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={arg}
                          onChange={(e) => handleCommandLineArgChange(index, e.target.value)}
                          disabled={readonly}
                          placeholder="--argument=value"
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCommandLineArg(index)}
                          disabled={readonly}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Validation Errors */}
          {validationResult && (
            <ValidationError
              errors={validationResult.errors}
              warnings={validationResult.warnings}
              className="mt-4"
            />
          )}
        </CardContent>

        {/* Footer Actions */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {_loading && <LoadingSpinner size="sm" />}
              {hasChanges() && originalConfiguration && requiresRestart(originalConfiguration, configuration) && (
                <Alert className="bg-yellow-50 border-yellow-200 p-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    Service restart required for changes to take effect
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {!readonly && (
                <Button
                  variant="outline"
                  onClick={resetConfiguration}
                  disabled={_loading || saving}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
              
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              
              {!readonly && (
                <Button
                  onClick={handleSave}
                  disabled={_loading || saving || !validationResult?.valid || !hasChanges()}
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
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Configuration Change Confirmation Dialog */}
      {confirmDialog && originalConfiguration && (
        <ConfigurationChangeDialog
          open={confirmDialog}
          onOpenChange={setConfirmDialog}
          serviceName={serviceName}
          changes={getChanges()}
          requiresRestart={requiresRestart(originalConfiguration, configuration)}
          onConfirm={saveConfiguration}
          loading={saving}
        />
      )}
    </div>
  );
};

/**
 * Get default configuration for a service
 */
function getDefaultConfiguration(serviceName: string): ServiceConfigurationType {
  const baseConfig: ServiceConfigurationType = {
    name: serviceName,
    port: 53211,
    maxMemoryMB: 512,
    maxCpuPercent: 25,
    autoStart: true,
    restartOnFailure: true,
    environmentVariables: {},
    commandLineArgs: [],
    workingDirectory: '',
    logLevel: 'INFO',
    logRetentionDays: 30,
    healthCheckInterval: 30
  };

  // Service-specific defaults
  switch (serviceName.toLowerCase()) {
    case 'hotm-postgresql':
      return {
        ...baseConfig,
        port: 54321,
        maxMemoryMB: 1024,
        maxCpuPercent: 15,
        environmentVariables: {
          'POSTGRES_DB': 'hotm',
          'POSTGRES_USER': 'hotm',
        }
      };

    case 'hotm-ollama':
      return {
        ...baseConfig,
        port: 11434,
        maxMemoryMB: 2048,
        maxCpuPercent: 50,
        environmentVariables: {
          'OLLAMA_HOST': '0.0.0.0:11434',
          'OLLAMA_MODELS': '/app/models'
        }
      };

    case 'hotm-server':
      return {
        ...baseConfig,
        port: 53211,
        maxMemoryMB: 512,
        maxCpuPercent: 25,
        environmentVariables: {
          'RUST_LOG': 'hotm_server=info,axum=info',
          'DATABASE_URL': 'postgres://hotm:password@localhost:54321/hotm',
          'OLLAMA_URL': 'http://localhost:11434'
        }
      };

    default:
      return baseConfig;
  }
}

/**
 * Get resource recommendation text for a service
 */
function getResourceRecommendation(serviceName: string): string {
  switch (serviceName.toLowerCase()) {
    case 'hotm-postgresql':
      return 'CPU: 10-20%, Memory: 512MB-1GB for typical workloads';
    case 'hotm-ollama':
      return 'CPU: 25-75%, Memory: 2GB-8GB depending on model size';
    case 'hotm-server':
      return 'CPU: 10-25%, Memory: 256MB-512MB for API server';
    default:
      return 'Adjust based on service requirements and system capacity';
  }
}

export default ServiceConfiguration;