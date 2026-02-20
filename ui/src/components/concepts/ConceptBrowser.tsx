/**
 * ConceptBrowser Component
 * Full-width SKOS concept browsing view with tree navigation, detail tabs, and SKOS/Turtle export
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, Loader2, Copy, Check, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConceptTree } from './ConceptTree';
import { ConceptCard } from './ConceptCard';
import { api } from '@/api';
import { realtimeEventBus } from '@/services/realtimeEventBus';
import type { Concept, ConceptFull, ConceptScheme } from '@/api/types-extended';

// ===========================
// Helper functions
// ===========================

function labelToUri(label: string): string {
  return label.replace(/[^a-zA-Z0-9]/g, '_');
}

function generateConceptTurtle(concept: ConceptFull, namespace?: string): string {
  const ns = namespace || 'http://example.org/concepts/';
  const uri = `<${ns}${labelToUri(concept.pref_label)}>`;
  const lines: string[] = [
    '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
    `@prefix ex: <${ns}> .`,
    '',
    `${uri} a skos:Concept ;`,
    `    skos:prefLabel "${concept.pref_label}" ;`,
  ];

  if (concept.alt_labels && concept.alt_labels.length > 0) {
    for (const label of concept.alt_labels) {
      lines.push(`    skos:altLabel "${label}" ;`);
    }
  }

  if (concept.definition) {
    lines.push(`    skos:definition "${concept.definition.replace(/"/g, '\\"')}" ;`);
  }

  if (concept.notation) {
    lines.push(`    skos:notation "${concept.notation}" ;`);
  }

  if (concept.broader && concept.broader.length > 0) {
    for (const b of concept.broader) {
      lines.push(`    skos:broader <${ns}${labelToUri(b.pref_label)}> ;`);
    }
  }

  if (concept.narrower && concept.narrower.length > 0) {
    for (const n of concept.narrower) {
      lines.push(`    skos:narrower <${ns}${labelToUri(n.pref_label)}> ;`);
    }
  }

  if (concept.related && concept.related.length > 0) {
    for (const r of concept.related) {
      lines.push(`    skos:related <${ns}${labelToUri(r.pref_label)}> ;`);
    }
  }

  // Replace last semicolon with period
  const lastIdx = lines.length - 1;
  lines[lastIdx] = lines[lastIdx].replace(/ ;$/, ' .');

  return lines.join('\n');
}

function downloadAsFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/turtle;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===========================
// Inline sub-components
// ===========================

function SkosPreview({ turtle }: { turtle: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(turtle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7"
        onClick={handleCopy}
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
      <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-auto max-h-[600px] whitespace-pre-wrap">
        {turtle}
      </pre>
    </div>
  );
}

function SchemeDetail({
  scheme,
}: {
  scheme: ConceptScheme;
}) {
  const [turtleContent, setTurtleContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTurtle = async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await api.concepts.exportTurtle(scheme.id);
      setTurtleContent(content);
    } catch (err) {
      setError('Failed to load Turtle export');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (turtleContent) {
      downloadAsFile(turtleContent, `${scheme.title.replace(/[^a-zA-Z0-9]/g, '_')}.ttl`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h3 className="text-lg font-semibold">{scheme.title}</h3>
        </div>
        <div className="p-4 space-y-3">
          {scheme.description && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">Description</h4>
              <p className="text-sm">{scheme.description}</p>
            </div>
          )}
          {scheme.namespace && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">Namespace</h4>
              <p className="text-sm font-mono text-muted-foreground">{scheme.namespace}</p>
            </div>
          )}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">Created</h4>
            <p className="text-sm">{new Date(scheme.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTurtle}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {turtleContent ? 'Reload' : 'Load'} Full Turtle Export
          </Button>
          {turtleContent && (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download .ttl
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {turtleContent && <SkosPreview turtle={turtleContent} />}
      </div>
    </div>
  );
}

// ===========================
// Main component
// ===========================

interface ConceptBrowserProps {
  isOpen?: boolean;
  onSelectConcept?: (concept: Concept) => void;
  initialSchemeId?: string;
  className?: string;
}

export function ConceptBrowser({
  isOpen,
  onSelectConcept,
  initialSchemeId,
  className,
}: ConceptBrowserProps) {
  // State
  const [schemes, setSchemes] = useState<ConceptScheme[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>(initialSchemeId || '');
  const [schemeConcepts, setSchemeConcepts] = useState<Concept[]>([]);
  const [childrenMap, setChildrenMap] = useState<Map<string, Concept[]>>(new Map());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedConcept, setSelectedConcept] = useState<ConceptFull | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Concept[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState('details');

  // Load schemes on mount
  useEffect(() => {
    if (isOpen === false) return;
    loadSchemes();
  }, [isOpen]);

  // Load scheme concepts when scheme changes
  useEffect(() => {
    if (selectedSchemeId) {
      loadSchemeConcepts(selectedSchemeId);
    } else {
      setSchemeConcepts([]);
      setChildrenMap(new Map());
      setExpandedIds(new Set());
    }
  }, [selectedSchemeId]);

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.concepts.listConcepts({
          schemeId: selectedSchemeId || undefined,
          search: searchQuery,
          limit: 20,
        });
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedSchemeId]);

  useEffect(() => {
    if (isOpen === false) return;
    const unsubscribe = realtimeEventBus.subscribe((event) => {
      if (event.type === 'ConceptUpdated') {
        void loadSchemes();
        if (selectedSchemeId) {
          void loadSchemeConcepts(selectedSchemeId);
        }
      }
    });
    return () => unsubscribe();
  }, [isOpen, selectedSchemeId]);

  const loadSchemes = async () => {
    setError(null);
    try {
      const data = await api.concepts.listSchemes();
      setSchemes(data);
      if (data.length === 0) {
        setSelectedSchemeId('');
        setSchemeConcepts([]);
        setChildrenMap(new Map());
        setExpandedIds(new Set());
        setSelectedConcept(null);
        return;
      }

      if (!selectedSchemeId || !data.some((scheme) => scheme.id === selectedSchemeId)) {
        setSelectedSchemeId(data[0].id);
      }
    } catch (err) {
      setError('Failed to load concept schemes');
      console.error(err);
    }
  };

  const loadSchemeConcepts = async (schemeId: string) => {
    if (!schemeId) {
      setSchemeConcepts([]);
      setChildrenMap(new Map());
      setExpandedIds(new Set());
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const concepts = await api.concepts.listConcepts({
        schemeId,
        limit: 1000,
      });
      setSchemeConcepts(concepts);
      setChildrenMap(new Map());
      setExpandedIds(new Set());
    } catch (err) {
      setError('Failed to load concepts');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChildren = useCallback(async (conceptId: string): Promise<Concept[]> => {
    try {
      const children = await api.concepts.getNarrower(conceptId);
      setChildrenMap((prev) => {
        const next = new Map(prev);
        next.set(conceptId, children);
        return next;
      });
      return children;
    } catch (err) {
      console.error('Failed to load children:', err);
      return [];
    }
  }, []);

  const handleSelectConcept = useCallback(async (concept: Concept) => {
    try {
      const full = await api.concepts.getConceptFull(concept.id);
      setSelectedConcept(full);
      onSelectConcept?.(concept);
    } catch (err) {
      console.error('Failed to load concept details:', err);
    }
  }, [onSelectConcept]);

  const handleExpandCollapse = useCallback((conceptId: string, expanded: boolean) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (expanded) {
        next.add(conceptId);
      } else {
        next.delete(conceptId);
      }
      return next;
    });
  }, []);

  const handleNavigateToConcept = useCallback((concept: Concept) => {
    handleSelectConcept(concept);
  }, [handleSelectConcept]);

  if (isOpen === false) return null;

  const displayConcepts = searchQuery.trim() ? searchResults : schemeConcepts;
  const currentScheme = schemes.find((s) => s.id === selectedSchemeId);

  return (
    <div
      className={cn('flex flex-col h-full bg-background', className)}
      role="region"
      aria-label="SKOS Concept Browser"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/50">
        <h2 className="text-lg font-semibold shrink-0">Concepts</h2>
        <Select value={selectedSchemeId} onValueChange={setSelectedSchemeId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select a concept scheme" />
          </SelectTrigger>
          <SelectContent>
            {schemes.map((scheme) => (
              <SelectItem key={scheme.id} value={scheme.id}>
                {scheme.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => loadSchemes()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Tree Panel */}
        <div className="w-[320px] shrink-0 border-r overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8 px-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedSchemeId && loadSchemeConcepts(selectedSchemeId)}
                className="mt-2"
                disabled={!selectedSchemeId}
              >
                Retry
              </Button>
            </div>
          ) : !selectedSchemeId ? (
            <div className="text-center py-8 px-4 text-muted-foreground">
              <p className="text-sm">
                {schemes.length === 0
                  ? 'No concept schemes available'
                  : 'Select a concept scheme'}
              </p>
            </div>
          ) : (
            <ConceptTree
              concepts={displayConcepts}
              childrenMap={childrenMap}
              selectedId={selectedConcept?.id}
              expandedIds={expandedIds}
              onSelectConcept={handleSelectConcept}
              onExpandCollapse={handleExpandCollapse}
              onLoadChildren={loadChildren}
            />
          )}

          {/* Footer Actions */}
          <div className="px-4 py-3 border-t bg-muted/30">
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              New Concept
            </Button>
          </div>
        </div>

        {/* Detail Panel with Tabs */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedConcept ? (
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="skos">SKOS</TabsTrigger>
                <TabsTrigger value="scheme">Scheme</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <ConceptCard
                  concept={selectedConcept}
                  schemeName={currentScheme?.title}
                  onNavigateToConcept={handleNavigateToConcept}
                />
              </TabsContent>
              <TabsContent value="skos">
                <SkosPreview
                  turtle={generateConceptTurtle(selectedConcept, currentScheme?.namespace)}
                />
              </TabsContent>
              <TabsContent value="scheme">
                {currentScheme ? (
                  <SchemeDetail scheme={currentScheme} />
                ) : (
                  <p className="text-sm text-muted-foreground">No scheme selected</p>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Select a concept to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
