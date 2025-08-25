/**
 * Error Display Components
 * 
 * Reusable error display components for showing service errors,
 * validation messages, and recovery suggestions
 */

import React from 'react';
import { Alert, AlertDescription } from '../ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { 
  AlertCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink
} from 'lucide-react';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

interface ErrorDisplayProps {
  title: string;
  message: string;
  severity?: ErrorSeverity;
  details?: string;
  timestamp?: Date;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  onCopyError?: () => void;
  onReportError?: () => void;
  className?: string;
  compact?: boolean;
}

interface ValidationErrorProps {
  errors: string[];
  warnings?: string[];
  fieldName?: string;
  onClear?: () => void;
  className?: string;
}

interface ServiceErrorProps {
  serviceName: string;
  error: {
    code?: string;
    message: string;
    details?: string;
    timestamp: Date;
    severity: ErrorSeverity;
  };
  onRetry?: () => void | Promise<void>;
  onViewLogs?: () => void;
  onReportIssue?: () => void;
  className?: string;
}

/**
 * General error display component
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title,
  message,
  severity = 'error',
  details,
  timestamp,
  onRetry,
  onDismiss,
  onCopyError,
  onReportError,
  className = '',
  compact = false
}) => {
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'info': return <Info className="h-5 w-5 text-blue-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-700" />;
    }
  };

  const getSeverityColors = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'info': return 'border-blue-200 bg-blue-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'error': return 'border-red-200 bg-red-50';
      case 'critical': return 'border-red-300 bg-red-100';
    }
  };

  const getSeverityBadge = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'info': return 'bg-blue-100 text-blue-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'critical': return 'bg-red-200 text-red-900';
    }
  };

  const copyErrorToClipboard = () => {
    const errorText = [
      `Title: ${title}`,
      `Severity: ${severity}`,
      `Message: ${message}`,
      details && `Details: ${details}`,
      timestamp && `Timestamp: ${timestamp.toISOString()}`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(errorText).then(() => {
      // Could show a toast notification here
      console.log('Error copied to clipboard');
    });

    if (onCopyError) {
      onCopyError();
    }
  };

  if (compact) {
    return (
      <Alert className={`${getSeverityColors(severity)} ${className}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            {getSeverityIcon(severity)}
            <div>
              <div className="font-medium">{title}</div>
              <AlertDescription className="mt-1">{message}</AlertDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                <XCircle className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <Card className={`${getSeverityColors(severity)} ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {getSeverityIcon(severity)}
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {title}
                <Badge variant="secondary" className={getSeverityBadge(severity)}>
                  {severity.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription className="text-left mt-1">
                {message}
              </CardDescription>
              {timestamp && (
                <CardDescription className="text-xs mt-1">
                  {timestamp.toLocaleString()}
                </CardDescription>
              )}
            </div>
          </div>
          
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Details */}
        {details && (
          <Collapsible>
            <CollapsibleTrigger
              className="flex items-center gap-2 text-sm font-medium hover:text-primary"
              onClick={() => setDetailsExpanded(!detailsExpanded)}
            >
              {detailsExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Show Details
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="p-3 bg-muted rounded-md">
                <pre className="text-sm whitespace-pre-wrap font-mono">{details}</pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
          
          {(details || message) && (
            <Button variant="outline" size="sm" onClick={copyErrorToClipboard}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Error
            </Button>
          )}
          
          {onReportError && (
            <Button variant="outline" size="sm" onClick={onReportError}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Report Issue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Validation error component
 */
export const ValidationError: React.FC<ValidationErrorProps> = ({
  errors,
  warnings = [],
  fieldName,
  onClear,
  className = ''
}) => {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Errors */}
      {errors.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <div className="space-y-1">
              {fieldName && <div className="font-medium">{fieldName}:</div>}
              {errors.map((error, index) => (
                <div key={index} className="text-red-700">• {error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <div className="space-y-1">
              {warnings.map((warning, index) => (
                <div key={index} className="text-yellow-700">• {warning}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Clear Button */}
      {onClear && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Service-specific error component
 */
export const ServiceError: React.FC<ServiceErrorProps> = ({
  serviceName,
  error,
  onRetry,
  onViewLogs,
  onReportIssue,
  className = ''
}) => {
  return (
    <Card className={`border-red-200 bg-red-50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <CardTitle className="text-lg text-red-900">
                {serviceName} Error
              </CardTitle>
              <CardDescription className="text-red-700">
                {error.message}
              </CardDescription>
              <div className="flex items-center gap-2 mt-2">
                {error.code && (
                  <Badge variant="secondary" className="bg-red-200 text-red-800">
                    {error.code}
                  </Badge>
                )}
                <Badge variant="secondary" className="bg-red-200 text-red-800">
                  {error.severity.toUpperCase()}
                </Badge>
                <span className="text-xs text-red-600">
                  {error.timestamp.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Details */}
        {error.details && (
          <div className="p-3 bg-red-100 border border-red-200 rounded-md">
            <pre className="text-sm whitespace-pre-wrap text-red-800 font-mono">
              {error.details}
            </pre>
          </div>
        )}

        {/* Recovery Suggestions */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="font-medium text-blue-900 mb-2">Suggested Actions:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Check service configuration and dependencies</li>
            <li>• Verify network connectivity and port availability</li>
            <li>• Review service logs for additional details</li>
            <li>• Try restarting the service</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Operation
            </Button>
          )}
          
          {onViewLogs && (
            <Button variant="outline" size="sm" onClick={onViewLogs}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Logs
            </Button>
          )}
          
          {onReportIssue && (
            <Button variant="outline" size="sm" onClick={onReportIssue}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Report Issue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};