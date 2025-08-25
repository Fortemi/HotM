/**
 * Status Indicator Component
 * 
 * Reusable component for displaying service status with visual indicators,
 * animations, and contextual information
 */

import React from 'react';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock, 
  Loader2,
  HelpCircle
} from 'lucide-react';
import { ServiceStatus, ServiceHealth } from '../../types/serviceTypes';

interface StatusIndicatorProps {
  status: ServiceStatus;
  health?: ServiceHealth;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showIcon?: boolean;
  className?: string;
  tooltip?: string;
  animated?: boolean;
}

interface HealthIndicatorProps {
  health: ServiceHealth;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  tooltip?: string;
}

interface StatusDotProps {
  status: ServiceStatus;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

/**
 * Main status indicator component
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  health: _health,
  size = 'md',
  showText = true,
  showIcon = true,
  className = '',
  tooltip,
  animated = true
}) => {
  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'Running': return 'bg-green-500 text-green-50';
      case 'Stopped': return 'bg-gray-500 text-gray-50';
      case 'Starting': case 'Stopping': return 'bg-yellow-500 text-yellow-50';
      case 'Error': return 'bg-red-500 text-red-50';
      case 'NotInstalled': return 'bg-gray-400 text-gray-50';
      default: return 'bg-gray-400 text-gray-50';
    }
  };

  const getStatusIcon = (status: ServiceStatus) => {
    const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
    
    switch (status) {
      case 'Running': return <CheckCircle className={iconSize} />;
      case 'Stopped': return <XCircle className={iconSize} />;
      case 'Starting': case 'Stopping': 
        return animated ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : (
          <Clock className={iconSize} />
        );
      case 'Error': return <AlertCircle className={iconSize} />;
      case 'NotInstalled': return <HelpCircle className={iconSize} />;
      default: return <HelpCircle className={iconSize} />;
    }
  };

  const getStatusText = (status: ServiceStatus) => {
    switch (status) {
      case 'NotInstalled': return 'Not Installed';
      default: return status;
    }
  };

  const content = (
    <Badge 
      variant="secondary" 
      className={`${getStatusColor(status)} ${className} flex items-center gap-1`}
    >
      {showIcon && getStatusIcon(status)}
      {showText && (
        <span className={size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs'}>
          {getStatusText(status)}
        </span>
      )}
    </Badge>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
};

/**
 * Health indicator component
 */
export const HealthIndicator: React.FC<HealthIndicatorProps> = ({
  health,
  size = 'md',
  showText = true,
  className = '',
  tooltip
}) => {
  const getHealthColor = (health: ServiceHealth) => {
    switch (health) {
      case 'Healthy': return 'text-green-600 border-green-200 bg-green-50';
      case 'Unhealthy': return 'text-red-600 border-red-200 bg-red-50';
      case 'Unknown': return 'text-gray-500 border-gray-200 bg-gray-50';
      default: return 'text-gray-500 border-gray-200 bg-gray-50';
    }
  };

  const getHealthIcon = (health: ServiceHealth) => {
    const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
    
    switch (health) {
      case 'Healthy': return <CheckCircle className={iconSize} />;
      case 'Unhealthy': return <AlertCircle className={iconSize} />;
      case 'Unknown': return <HelpCircle className={iconSize} />;
      default: return <HelpCircle className={iconSize} />;
    }
  };

  const content = (
    <Badge 
      variant="outline" 
      className={`${getHealthColor(health)} ${className} flex items-center gap-1`}
    >
      {getHealthIcon(health)}
      {showText && (
        <span className={size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs'}>
          {health}
        </span>
      )}
    </Badge>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
};

/**
 * Simple status dot component
 */
export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  size = 'md',
  animated = true,
  className = ''
}) => {
  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'Running': return 'bg-green-500';
      case 'Stopped': return 'bg-gray-500';
      case 'Starting': case 'Stopping': return 'bg-yellow-500';
      case 'Error': return 'bg-red-500';
      case 'NotInstalled': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getDotSize = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm': return 'w-2 h-2';
      case 'lg': return 'w-4 h-4';
      default: return 'w-3 h-3';
    }
  };

  const isPulsing = animated && (status === 'Starting' || status === 'Stopping');

  return (
    <div 
      className={`
        ${getDotSize(size)} 
        ${getStatusColor(status)} 
        rounded-full 
        ${isPulsing ? 'animate-pulse' : ''} 
        ${className}
      `}
    />
  );
};

/**
 * Combined status and health indicator
 */
export const CombinedStatusIndicator: React.FC<{
  status: ServiceStatus;
  health: ServiceHealth;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'horizontal' | 'vertical';
  className?: string;
}> = ({
  status,
  health,
  size = 'md',
  layout = 'horizontal',
  className = ''
}) => {
  const containerClass = layout === 'vertical' 
    ? 'flex flex-col items-center gap-1' 
    : 'flex items-center gap-2';

  return (
    <div className={`${containerClass} ${className}`}>
      <StatusIndicator 
        status={status} 
        size={size} 
        showText={layout === 'horizontal'}
      />
      <HealthIndicator 
        health={health} 
        size={size} 
        showText={layout === 'horizontal'}
      />
    </div>
  );
};