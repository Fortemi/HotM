/**
 * Confirmation Dialog Component
 * 
 * Reusable confirmation dialog with different severity levels
 * and customizable actions for service management operations
 */

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';

export type ConfirmationSeverity = 'info' | 'warning' | 'error' | 'success';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  severity?: ConfirmationSeverity;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  destructive?: boolean;
  details?: string;
  showIcon?: boolean;
}

/**
 * Main confirmation dialog component
 */
export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'info',
  onConfirm,
  onCancel,
  loading = false,
  destructive = false,
  details,
  showIcon = true
}) => {
  const getSeverityIcon = (severity: ConfirmationSeverity) => {
    switch (severity) {
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      default: return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getSeverityColors = (severity: ConfirmationSeverity) => {
    switch (severity) {
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'error': return 'border-red-200 bg-red-50';
      case 'success': return 'border-green-200 bg-green-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      // Error handling should be managed by the parent component
      console.error('Confirmation action failed:', error);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3">
            {showIcon && getSeverityIcon(severity)}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {details && (
          <div className={`p-3 rounded-md border ${getSeverityColors(severity)}`}>
            <p className="text-sm text-gray-700">{details}</p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={loading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={destructive ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {loading ? 'Processing...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

/**
 * Pre-configured service operation confirmation dialogs
 */
export interface ServiceConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  operation: 'start' | 'stop' | 'restart' | 'install' | 'uninstall';
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  hasUnsavedChanges?: boolean;
  dependencies?: string[];
}

export const ServiceOperationDialog: React.FC<ServiceConfirmationDialogProps> = ({
  open,
  onOpenChange,
  serviceName,
  operation,
  onConfirm,
  loading = false,
  hasUnsavedChanges = false,
  dependencies = []
}) => {
  const getOperationConfig = () => {
    switch (operation) {
      case 'start':
        return {
          title: `Start ${serviceName}`,
          description: `Are you sure you want to start the ${serviceName} service?`,
          confirmText: 'Start Service',
          severity: 'info' as ConfirmationSeverity,
          destructive: false
        };

      case 'stop':
        return {
          title: `Stop ${serviceName}`,
          description: `Are you sure you want to stop the ${serviceName} service?`,
          confirmText: 'Stop Service',
          severity: 'warning' as ConfirmationSeverity,
          destructive: true,
          details: dependencies.length > 0 
            ? `This may affect dependent services: ${dependencies.join(', ')}`
            : undefined
        };

      case 'restart':
        return {
          title: `Restart ${serviceName}`,
          description: `Are you sure you want to restart the ${serviceName} service?`,
          confirmText: 'Restart Service',
          severity: 'warning' as ConfirmationSeverity,
          destructive: false,
          details: hasUnsavedChanges 
            ? 'Any unsaved configuration changes will be applied.'
            : 'The service will be temporarily unavailable during restart.'
        };

      case 'install':
        return {
          title: `Install ${serviceName}`,
          description: `This will install and configure the ${serviceName} service.`,
          confirmText: 'Install Service',
          severity: 'info' as ConfirmationSeverity,
          destructive: false
        };

      case 'uninstall':
        return {
          title: `Uninstall ${serviceName}`,
          description: `Are you sure you want to uninstall the ${serviceName} service?`,
          confirmText: 'Uninstall Service',
          severity: 'error' as ConfirmationSeverity,
          destructive: true,
          details: 'This will remove all service files and configurations. This action cannot be undone.'
        };

      default:
        return {
          title: `${operation} ${serviceName}`,
          description: `Are you sure you want to ${operation} the ${serviceName} service?`,
          confirmText: 'Confirm',
          severity: 'info' as ConfirmationSeverity,
          destructive: false
        };
    }
  };

  const config = getOperationConfig();

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={config.title}
      description={config.description}
      confirmText={config.confirmText}
      severity={config.severity}
      destructive={config.destructive}
      details={config.details}
      onConfirm={onConfirm}
      loading={loading}
    />
  );
};

/**
 * Configuration change confirmation dialog
 */
export interface ConfigurationChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  changes: { field: string; oldValue: string; newValue: string }[];
  requiresRestart: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export const ConfigurationChangeDialog: React.FC<ConfigurationChangeDialogProps> = ({
  open,
  onOpenChange,
  serviceName,
  changes,
  requiresRestart,
  onConfirm,
  onCancel,
  loading = false
}) => {
  const title = `Save Configuration Changes`;
  const description = `Apply the following changes to ${serviceName}?`;
  
  const details = (
    <div className="space-y-2">
      {changes.map((change, index) => (
        <div key={index} className="text-sm">
          <span className="font-medium">{change.field}:</span>
          <span className="text-red-600 line-through ml-2">{change.oldValue}</span>
          <span className="text-green-600 ml-2">{change.newValue}</span>
        </div>
      ))}
      {requiresRestart && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Service restart required for changes to take effect
          </p>
        </div>
      )}
    </div>
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3">
            <Info className="h-5 w-5 text-blue-600" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          {details}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => {
              if (onCancel) onCancel();
              onOpenChange(false);
            }} 
            disabled={loading}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};