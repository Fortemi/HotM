import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RefreshCw, Search, Trash2 } from 'lucide-react';
import { realtimeEventBus, type RealtimeEvent } from '@/services/realtimeEventBus';
import { describeRealtimeActivity } from '@/services/realtimeActivity';
import { useWebSocket } from '@/services/websocket';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface InspectorEvent extends RealtimeEvent {
  timestamp: string;
}

const MAX_EVENTS = 200;

export function RealtimeEventInspector() {
  const {
    connected,
    connectionState,
    transportMode,
    replayCursor,
    subscribedEventTypes,
  } = useWebSocket();
  const [events, setEvents] = useState<InspectorEvent[]>([]);
  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) {
      return;
    }
    const unsubscribe = realtimeEventBus.subscribe((event) => {
      const normalized: InspectorEvent = {
        ...event,
        timestamp: new Date().toISOString(),
      };

      setEvents((prev) => [normalized, ...prev].slice(0, MAX_EVENTS));
    });
    return () => unsubscribe();
  }, [paused]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return events;
    }
    const search = query.toLowerCase();
    return events.filter((event) => {
      const activity = describeRealtimeActivity(event);
      const haystack = [
        event.raw_event_type,
        event.type,
        activity.category,
        activity.title,
        activity.entity,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [events, query]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Realtime Activity</CardTitle>
          <CardDescription>
            Sanitized view of connection, job, sync, MCP, and admin activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant={connected ? 'secondary' : 'destructive'}>
              state: {connectionState ?? (connected ? 'connected' : 'disconnected')}
            </Badge>
            <Badge variant="outline">transport: {transportMode ?? 'none'}</Badge>
            <Badge variant="outline">replay cursor: {replayCursor ?? 'n/a'}</Badge>
            <Badge variant="outline">buffer: {events.length}/{MAX_EVENTS}</Badge>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Subscribed event types</div>
            <div className="flex flex-wrap gap-1">
              {(subscribedEventTypes ?? []).map((eventType) => (
                <Badge key={eventType} variant="secondary" className="text-[11px]">
                  {eventType}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by category, event type, or activity"
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaused((prev) => !prev)}
            >
              {paused ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuery('')}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Reset Filter
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEvents([])}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[480px] pr-3">
            <div className="space-y-2">
              {filtered.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No activity matches current filter.
                </div>
              )}
              {filtered.map((event, index) => {
                const activity = describeRealtimeActivity(event);
                return (
                  <div key={`${event.timestamp}-${index}`} className="border rounded-md p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="secondary">{activity.category}</Badge>
                      <Badge variant={activity.severity === 'error' ? 'destructive' : 'outline'}>
                        {activity.severity}
                      </Badge>
                      <Badge variant="outline">{activity.entity}</Badge>
                      <Badge variant="outline">{event.raw_event_type ?? event.type}</Badge>
                    </div>
                    <div className="font-medium text-sm">{activity.title}</div>
                    <div className="mt-1 text-muted-foreground">{activity.summary}</div>
                    <div className="mt-2 text-muted-foreground">
                      time: {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
