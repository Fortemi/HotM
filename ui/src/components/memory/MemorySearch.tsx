/**
 * MemorySearch Component
 * Spatiotemporal search interface for finding notes by location and time
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  X,
  Navigation,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/api';
import type { MemorySearchResult } from '@/api/types-extended';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function getAttachmentDownloadUrl(attachmentId: string): string {
  return `${apiBaseUrl}/api/v1/attachments/${attachmentId}/download`;
}

interface MemorySearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult?: (result: MemorySearchResult) => void;
}

interface LocationPickerProps {
  value: { lat: number; lon: number } | null;
  onChange: (location: { lat: number; lon: number } | null) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
}

function LocationPicker({ value, onChange, radius, onRadiusChange }: LocationPickerProps) {
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsGettingLocation(false);
        alert('Failed to get current location');
      }
    );
  }, [onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Location</span>
      </div>

      {value ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-muted rounded-lg p-3">
            <div>
              <p className="text-sm font-mono">
                {value.lat.toFixed(6)}, {value.lon.toFixed(6)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Radius Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Search Radius</span>
              <span className="font-medium">
                {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}
              </span>
            </div>
            <Slider
              value={[radius]}
              min={100}
              max={50000}
              step={100}
              onValueChange={([v]) => onRadiusChange(v)}
              aria-label="Search radius"
            />
          </div>

          {/* Map placeholder */}
          <div className="h-32 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
            Map view (requires Leaflet integration)
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={getCurrentLocation}
          disabled={isGettingLocation}
        >
          {isGettingLocation ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4 mr-2" />
          )}
          Use Current Location
        </Button>
      )}
    </div>
  );
}

interface TimeRangePickerProps {
  start: string;
  end: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}

function TimeRangePicker({ start, end, onStartChange, onEndChange }: TimeRangePickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Time Range</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={start}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={end}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Today', days: 0 },
          { label: 'Last 7 days', days: 7 },
          { label: 'Last 30 days', days: 30 },
          { label: 'Last year', days: 365 },
        ].map(({ label, days }) => (
          <Button
            key={label}
            variant="outline"
            size="sm"
            onClick={() => {
              const endDate = new Date();
              const startDate = new Date();
              startDate.setDate(endDate.getDate() - days);
              onStartChange(startDate.toISOString().split('T')[0]);
              onEndChange(endDate.toISOString().split('T')[0]);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface MemoryResultCardProps {
  result: MemorySearchResult;
  onClick: () => void;
}

function MemoryResultCard({ result, onClick }: MemoryResultCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 border rounded-lg hover:border-primary transition-colors"
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        {result.attachment_id && (
          <div className="w-16 h-16 flex-shrink-0 bg-muted rounded overflow-hidden">
            <img
              src={getAttachmentDownloadUrl(result.attachment_id)}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">
            {result.title || `Note ${result.note_id.substring(0, 8)}...`}
          </h4>

          {result.snippet && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {result.snippet}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {result.distance_meters !== undefined && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {result.distance_meters >= 1000
                  ? `${(result.distance_meters / 1000).toFixed(1)} km`
                  : `${Math.round(result.distance_meters)} m`}
              </span>
            )}
            {result.capture_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(result.capture_time).toLocaleDateString()}
              </span>
            )}
            {result.device && (
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                {result.device}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export function MemorySearch({ isOpen, onClose, onSelectResult }: MemorySearchProps) {
  // Search parameters
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState(1000); // meters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Results
  const [results, setResults] = useState<MemorySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize dates
  useEffect(() => {
    if (isOpen && !startDate && !endDate) {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  }, [isOpen, startDate, endDate]);

  const handleSearch = useCallback(async () => {
    if (!location && (!startDate || !endDate)) {
      setError('Please set a location or time range');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      let results: MemorySearchResult[];
      if (location && startDate && endDate) {
        // Combined search
        results = await api.memory.searchCombined({
          lat: location.lat,
          lon: location.lon,
          radius_meters: radius,
          start: new Date(startDate).toISOString(),
          end: new Date(endDate).toISOString(),
        });
      } else if (location) {
        // Location-only search
        results = await api.memory.searchByLocation({
          lat: location.lat,
          lon: location.lon,
          radius_meters: radius,
        });
      } else {
        // Time-only search
        results = await api.memory.searchByTimeRange({
          start: new Date(startDate).toISOString(),
          end: new Date(endDate).toISOString(),
        });
      }
      // Fetch note titles for results that don't have them
      const needsTitles = results.filter((r) => !r.title);
      if (needsTitles.length > 0) {
        const uniqueNoteIds = [...new Set(needsTitles.map((r) => r.note_id))];
        const titleMap = new Map<string, string>();
        await Promise.all(
          uniqueNoteIds.map(async (noteId) => {
            try {
              const note = await api.notes.get(noteId);
              const title = note.note?.title
                || note.revised?.content?.substring(0, 80)
                || note.original?.content?.substring(0, 80)
                || `Note ${noteId.substring(0, 8)}`;
              titleMap.set(noteId, title);
            } catch {
              titleMap.set(noteId, `Note ${noteId.substring(0, 8)}`);
            }
          })
        );
        for (const r of results) {
          if (!r.title && titleMap.has(r.note_id)) {
            r.title = titleMap.get(r.note_id)!;
          }
        }
      }
      setResults(results);
    } catch (err) {
      setError('Search failed');
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, [location, radius, startDate, endDate]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Memory Search
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Search Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Location Picker */}
            <LocationPicker
              value={location}
              onChange={setLocation}
              radius={radius}
              onRadiusChange={setRadius}
            />

            {/* Time Range Picker */}
            <TimeRangePicker
              start={startDate}
              end={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
            />
          </div>

          {/* Search Button */}
          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search Memories
              </>
            )}
          </Button>

          {/* Error */}
          {error && (
            <div className="text-center text-sm text-destructive">{error}</div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Results
                  <Badge variant="secondary" className="ml-2">
                    {results.length}
                  </Badge>
                </h3>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((result) => (
                  <MemoryResultCard
                    key={`${result.note_id}-${result.attachment_id || 'note'}`}
                    result={result}
                    onClick={() => {
                      onSelectResult?.(result);
                      onClose();
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isSearching && results.length === 0 && !error && (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Set location and/or time range to search</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
