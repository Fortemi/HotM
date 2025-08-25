/**
 * Service Logs Component
 * 
 * Comprehensive log viewer with real-time streaming, filtering,
 * search capabilities, and export functionality for HotM services
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  RefreshCw, 
  Play, 
  Pause,
  Trash2,
  Info,
  AlertTriangle,
  XCircle,
  Clock,
  Eye,
  Settings,
  Maximize2,
  Minimize2
} from 'lucide-react';

import { 
  LogEntry, 
  LogFilter, 
  LogLevel, 
  ServiceLogsProps 
} from '../types/serviceTypes';
import { useServiceLogs } from '../hooks/useServiceStatus';
import { LoadingSpinner } from './common/ProgressIndicator';
import { ErrorDisplay } from './common/ErrorDisplay';

interface ServiceLogsState {
  isStreaming: boolean;
  autoScroll: boolean;
  isFullScreen: boolean;
  selectedEntry: LogEntry | null;
}

/**
 * Service Logs Viewer Component
 */
export const ServiceLogs: React.FC<ServiceLogsProps> = ({
  className = '',
  services = [],
  defaultFilter: _defaultFilter,
  maxEntries = 1000,
  enableExport = true
}) => {
  const [state, setState] = useState<ServiceLogsState>({
    isStreaming: false,
    autoScroll: true,
    isFullScreen: false,
    selectedEntry: null
  });
  
  const [searchText, setSearchText] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>(services);
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>(['ERROR', 'WARN', 'INFO']);
  const [showFilters, setShowFilters] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // Use the service logs hook
  const {
    logs: _logs,
    loading,
    error,
    filter: _filter,
    totalCount,
    hasMore,
    setFilter,
    loadMore,
    exportLogs,
    clearLogs
  } = useServiceLogs();

  // Mock data for development
  const [mockLogs, setMockLogs] = useState<LogEntry[]>([]);

  // Generate mock log data
  useEffect(() => {
    const generateMockLogs = () => {
      const levels: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
      const serviceNames = ['HotM-Server', 'HotM-PostgreSQL', 'HotM-Ollama'];
      const categories = ['auth', 'database', 'api', 'nlp', 'websocket'];
      
      const messages = {
        ERROR: [
          'Failed to connect to database',
          'Authentication failed for user',
          'Timeout waiting for response',
          'Memory allocation failed',
          'Invalid configuration parameter'
        ],
        WARN: [
          'High CPU usage detected',
          'Slow query detected',
          'Connection pool nearly full',
          'Deprecated API endpoint used',
          'Cache miss rate high'
        ],
        INFO: [
          'Service started successfully',
          'User authenticated',
          'Request processed successfully',
          'Configuration loaded',
          'Health check passed'
        ],
        DEBUG: [
          'Processing request payload',
          'Database query executed',
          'Cache hit for key',
          'Validating input parameters',
          'Establishing connection'
        ],
        TRACE: [
          'Entering function processRequest',
          'Variable value: userId=123',
          'Method execution time: 45ms',
          'Memory usage: 256MB',
          'Thread pool size: 10'
        ]
      };

      const newLogs: LogEntry[] = [];
      
      for (let i = 0; i < 50; i++) {
        const level = levels[Math.floor(Math.random() * levels.length)];
        const service = serviceNames[Math.floor(Math.random() * serviceNames.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const levelMessages = messages[level];
        const message = levelMessages[Math.floor(Math.random() * levelMessages.length)];
        
        newLogs.push({
          id: `log-${Date.now()}-${i}`,
          timestamp: new Date(Date.now() - (i * 1000 * Math.random() * 3600)).toISOString(),
          level,
          service,
          message,
          category,
          details: Math.random() > 0.7 ? {
            requestId: `req-${Math.floor(Math.random() * 10000)}`,
            userId: Math.floor(Math.random() * 1000),
            duration: Math.floor(Math.random() * 1000),
            endpoint: `/api/v1/${category}`
          } : undefined
        });
      }
      
      return newLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    };

    setMockLogs(generateMockLogs());
  }, []);

  // Update filter when selections change
  useEffect(() => {
    const newFilter: LogFilter = {
      services: selectedServices.length > 0 ? selectedServices : undefined,
      levels: selectedLevels.length > 0 ? selectedLevels : undefined,
      searchText: searchText.trim() || undefined
    };
    
    setFilter(newFilter);
  }, [selectedServices, selectedLevels, searchText, setFilter]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (state.autoScroll && scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [mockLogs, state.autoScroll]);

  // Filtered logs based on current filter
  const filteredLogs = useMemo(() => {
    return mockLogs.filter(log => {
      // Filter by services
      if (selectedServices.length > 0 && !selectedServices.includes(log.service)) {
        return false;
      }
      
      // Filter by levels
      if (selectedLevels.length > 0 && !selectedLevels.includes(log.level)) {
        return false;
      }
      
      // Filter by search text
      if (searchText.trim()) {
        const searchLower = searchText.toLowerCase();
        return log.message.toLowerCase().includes(searchLower) ||
               log.service.toLowerCase().includes(searchLower) ||
               (log.category && log.category.toLowerCase().includes(searchLower));
      }
      
      return true;
    }).slice(0, maxEntries);
  }, [mockLogs, selectedServices, selectedLevels, searchText, maxEntries]);

  /**
   * Get log level styling
   */
  const getLogLevelStyle = (level: LogLevel) => {
    switch (level) {
      case 'ERROR': return 'text-red-600 bg-red-50 border-red-200';
      case 'WARN': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'INFO': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'DEBUG': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'TRACE': return 'text-purple-600 bg-purple-50 border-purple-200';
    }
  };

  /**
   * Get log level icon
   */
  const getLogLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'ERROR': return <XCircle className="h-4 w-4" />;
      case 'WARN': return <AlertTriangle className="h-4 w-4" />;
      case 'INFO': return <Info className="h-4 w-4" />;
      case 'DEBUG': return <Settings className="h-4 w-4" />;
      case 'TRACE': return <Eye className="h-4 w-4" />;
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  /**
   * Toggle streaming
   */
  const toggleStreaming = () => {
    setState(prev => ({ ...prev, isStreaming: !prev.isStreaming }));
  };

  /**
   * Toggle auto-scroll
   */
  const toggleAutoScroll = () => {
    setState(prev => ({ ...prev, autoScroll: !prev.autoScroll }));
  };

  /**
   * Toggle full screen
   */
  const toggleFullScreen = () => {
    setState(prev => ({ ...prev, isFullScreen: !prev.isFullScreen }));
  };

  /**
   * Handle export logs
   */
  const handleExport = async (format: 'json' | 'csv' | 'txt') => {
    try {
      // In real implementation, this would call the actual export function
      const blob = await exportLogs(format);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hotm-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  /**
   * Handle clear logs
   */
  const handleClearLogs = async () => {
    try {
      const result = await clearLogs();
      if (result.success) {
        setMockLogs([]);
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const containerClass = state.isFullScreen 
    ? 'fixed inset-0 z-50 bg-background' 
    : className;

  return (
    <Card className={containerClass}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Service Logs
            </CardTitle>
            <CardDescription>
              Real-time log monitoring and analysis
              {filteredLogs.length > 0 && (
                <span className="ml-2">
                  ({filteredLogs.length} of {mockLogs.length} entries)
                </span>
              )}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Streaming Controls */}
            <Button
              variant={state.isStreaming ? "default" : "outline"}
              size="sm"
              onClick={toggleStreaming}
            >
              {state.isStreaming ? (
                <Pause className="h-4 w-4 mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {state.isStreaming ? 'Pause' : 'Stream'}
            </Button>

            {/* Auto-scroll Toggle */}
            <Button
              variant={state.autoScroll ? "default" : "outline"}
              size="sm"
              onClick={toggleAutoScroll}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${state.autoScroll ? 'animate-spin' : ''}`} />
              Auto-scroll
            </Button>

            {/* Filter Toggle */}
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>

            {/* Full Screen Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullScreen}
            >
              {state.isFullScreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="space-y-4 mt-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search logs..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Service Filter */}
              <div className="space-y-2">
                <Label>Services</Label>
                <Select
                  value={selectedServices[0] || 'all'}
                  onValueChange={(value) => 
                    setSelectedServices(value === 'all' ? [] : [value])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="HotM-Server">HotM Server</SelectItem>
                    <SelectItem value="HotM-PostgreSQL">PostgreSQL</SelectItem>
                    <SelectItem value="HotM-Ollama">Ollama</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Level Filter */}
              <div className="space-y-2">
                <Label>Minimum Level</Label>
                <Select
                  value={selectedLevels[0] || 'INFO'}
                  onValueChange={(value: LogLevel) => {
                    const levels: LogLevel[] = [];
                    const levelOrder: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
                    const startIndex = levelOrder.indexOf(value);
                    for (let i = 0; i <= startIndex; i++) {
                      levels.push(levelOrder[i]);
                    }
                    setSelectedLevels(levels);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ERROR">ERROR+</SelectItem>
                    <SelectItem value="WARN">WARN+</SelectItem>
                    <SelectItem value="INFO">INFO+</SelectItem>
                    <SelectItem value="DEBUG">DEBUG+</SelectItem>
                    <SelectItem value="TRACE">TRACE+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* Error Display */}
        {error && (
          <div className="p-4">
            <ErrorDisplay
              title="Log Loading Error"
              message={error}
              severity="error"
              compact
            />
          </div>
        )}

        {/* Log Entries */}
        <div className="h-96 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="space-y-1 p-4" ref={logContainerRef}>
              {loading && filteredLogs.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner message="Loading logs..." />
                </div>
              )}

              {filteredLogs.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No log entries found</p>
                  <p className="text-sm mt-2">
                    {searchText || selectedServices.length > 0 || selectedLevels.length < 5
                      ? 'Try adjusting your filters'
                      : 'Logs will appear here when services are active'
                    }
                  </p>
                </div>
              )}

              {filteredLogs.map((entry) => (
                <div
                  key={entry.id}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg border cursor-pointer
                    hover:bg-muted/50 transition-colors
                    ${getLogLevelStyle(entry.level)}
                    ${state.selectedEntry?.id === entry.id ? 'ring-2 ring-primary' : ''}
                  `}
                  onClick={() => setState(prev => ({ 
                    ...prev, 
                    selectedEntry: prev.selectedEntry?.id === entry.id ? null : entry 
                  }))}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getLogLevelIcon(entry.level)}
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs">
                        {entry.level}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {entry.service}
                      </Badge>
                      {entry.category && (
                        <Badge variant="outline" className="text-xs">
                          {entry.category}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 text-muted-foreground ml-auto">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs font-mono">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm break-words">
                      {entry.message}
                    </p>
                    
                    {state.selectedEntry?.id === entry.id && entry.details && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                        <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {hasMore && (
                <div className="flex justify-center py-4">
                  <Button variant="outline" onClick={loadMore} disabled={loading}>
                    {loading ? <LoadingSpinner size="sm" /> : 'Load More'}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {filteredLogs.length} entries
              {totalCount > filteredLogs.length && ` of ${totalCount}`}
            </span>
            {state.isStreaming && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Live
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {enableExport && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('txt')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  TXT
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('json')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('csv')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceLogs;