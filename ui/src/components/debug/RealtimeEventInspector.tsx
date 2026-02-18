import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RefreshCw, Search, Trash2 } from 'lucide-react';
import { realtimeEventBus, type RealtimeEvent } from '@/services/realtimeEventBus';
import { useWebSocket } from '@/services/websocket';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface InspectorEvent extends RealtimeEvent {
  timestamp: string;
  entity_id?: string;
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
      const entityId = event.note_id ?? event.job_id;
      const normalized: InspectorEvent = {
        ...event,
        entity_id: entityId,
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
      const haystack = [
        event.raw_event_type,
        event.type,
        event.entity_id,
        event.memory,
        event.correlation_id,
        event.event_id,
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
          <CardTitle>Realtime Inspector</CardTitle>
          <CardDescription>
            Debug view for subscribed realtime events and recent event stream.
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
                placeholder="Filter by event type, entity, memory, correlation id"
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
          <CardTitle className="text-base">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[480px] pr-3">
            <div className="space-y-2">
              {filtered.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No events match current filter.
                </div>
              )}
              {filtered.map((event, index) => (
                <div key={`${event.event_id ?? event.timestamp}-${index}`} className="border rounded-md p-2 text-xs">
                  <div className="flex flex-wrap gap-2 mb-1">
                    <Badge variant="secondary">{event.raw_event_type ?? event.type}</Badge>
                    <Badge variant="outline">{event.type}</Badge>
                    {event.entity_id && <Badge variant="outline">entity: {event.entity_id}</Badge>}
                  </div>
                  <div className="text-muted-foreground">
                    time: {new Date(event.timestamp).toLocaleTimeString()} | memory: {event.memory ?? 'n/a'} | correlation: {event.correlation_id ?? 'n/a'} | event_id: {event.event_id ?? 'n/a'}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

