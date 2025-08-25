/**
 * Progress Indicator Components
 * 
 * Reusable progress indicators for service operations, loading states,
 * and long-running tasks in the service management interface
 */

import React from 'react';
import { Progress } from '../ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  X,
  Play,
  Pause,
  Square
} from 'lucide-react';

export type ProgressStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface ProgressIndicatorProps {
  value?: number; // 0-100 percentage, undefined for indeterminate
  status?: ProgressStatus;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
  label?: string;
}

interface OperationProgressProps {
  operation: string;
  service?: string;
  status: ProgressStatus;
  progress?: number;
  message?: string;
  details?: string;
  startTime?: Date;
  estimatedDuration?: number;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

interface MultiStepProgressProps {
  steps: {
    id: string;
    label: string;
    status: ProgressStatus;
    progress?: number;
    error?: string;
  }[];
  currentStep?: string;
  overallProgress?: number;
  onStepClick?: (stepId: string) => void;
  className?: string;
}

/**
 * Basic progress indicator component
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  value,
  status = 'pending',
  size = 'md',
  showPercentage = false,
  className = '',
  label
}) => {
  const getStatusColor = (status: ProgressStatus) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-300';
    }
  };

  const getProgressHeight = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm': return 'h-1';
      case 'lg': return 'h-3';
      default: return 'h-2';
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{label}</span>
          {showPercentage && value !== undefined && (
            <span className="text-muted-foreground">{Math.round(value)}%</span>
          )}
        </div>
      )}
      <Progress 
        value={value} 
        className={`${getProgressHeight(size)} ${getStatusColor(status)}`}
      />
    </div>
  );
};

/**
 * Operation progress component with status and controls
 */
export const OperationProgress: React.FC<OperationProgressProps> = ({
  operation,
  service,
  status,
  progress,
  message,
  details,
  startTime,
  estimatedDuration,
  onCancel,
  onRetry,
  className = ''
}) => {
  const getStatusIcon = (status: ProgressStatus) => {
    switch (status) {
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'cancelled': return <X className="h-4 w-4 text-gray-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: ProgressStatus) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'running': return 'In Progress';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
    }
  };

  const getStatusColor = (status: ProgressStatus) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (start: Date, estimated?: number) => {
    const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    let result = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (estimated && status === 'running') {
      const remaining = Math.max(0, estimated - elapsed);
      const remainingMinutes = Math.floor(remaining / 60);
      const remainingSeconds = remaining % 60;
      result += ` (${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')} remaining)`;
    }
    
    return result;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getStatusIcon(status)}
            {operation}
            {service && <span className="text-muted-foreground">• {service}</span>}
          </CardTitle>
          <Badge variant="outline" className={getStatusColor(status)}>
            {getStatusText(status)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {progress !== undefined && status === 'running' && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{Math.round(progress)}% complete</span>
              {startTime && (
                <span>{formatDuration(startTime, estimatedDuration)}</span>
              )}
            </div>
          </div>
        )}

        {/* Status Message */}
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}

        {/* Details */}
        {details && (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-mono">{details}</p>
          </div>
        )}

        {/* Action Buttons */}
        {(onCancel || onRetry) && (
          <div className="flex items-center gap-2 pt-2">
            {onCancel && status === 'running' && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                <Square className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            )}
            {onRetry && status === 'failed' && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <Play className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Multi-step progress component for complex operations
 */
export const MultiStepProgress: React.FC<MultiStepProgressProps> = ({
  steps,
  currentStep,
  overallProgress,
  onStepClick,
  className = ''
}) => {
  const getStepIcon = (step: typeof steps[0]) => {
    switch (step.status) {
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'cancelled': return <X className="h-4 w-4 text-gray-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const isStepClickable = (step: typeof steps[0]) => {
    return onStepClick && (step.status === 'completed' || step.status === 'failed');
  };

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        {/* Overall Progress */}
        {overallProgress !== undefined && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(overallProgress)}%
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        )}

        {/* Step List */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="relative">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="absolute left-6 top-8 w-0.5 h-8 bg-gray-200" />
              )}
              
              <div 
                className={`
                  flex items-start gap-3 p-3 rounded-md transition-colors
                  ${isStepClickable(step) ? 'cursor-pointer hover:bg-muted' : ''}
                  ${currentStep === step.id ? 'bg-blue-50 border border-blue-200' : ''}
                `}
                onClick={() => isStepClickable(step) && onStepClick!(step.id)}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step)}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{step.label}</span>
                    {step.progress !== undefined && step.status === 'running' && (
                      <span className="text-sm text-muted-foreground">
                        {Math.round(step.progress)}%
                      </span>
                    )}
                  </div>
                  
                  {step.progress !== undefined && step.status === 'running' && (
                    <Progress value={step.progress} className="h-1" />
                  )}
                  
                  {step.error && step.status === 'failed' && (
                    <p className="text-sm text-red-600">{step.error}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Simple loading spinner with message
 */
export const LoadingSpinner: React.FC<{
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ message, size = 'md', className = '' }) => {
  const getSpinnerSize = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm': return 'h-4 w-4';
      case 'lg': return 'h-8 w-8';
      default: return 'h-6 w-6';
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Loader2 className={`animate-spin text-blue-600 ${getSpinnerSize(size)}`} />
      {message && (
        <span className="text-sm text-muted-foreground">{message}</span>
      )}
    </div>
  );
};