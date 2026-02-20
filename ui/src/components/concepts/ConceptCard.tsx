/**
 * ConceptCard Component
 * Detail view for a selected SKOS concept with relationships
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Link2, Tag, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ConceptFull, Concept } from '@/api/types-extended';

interface ConceptCardProps {
  concept: ConceptFull;
  schemeName?: string;
  onEdit?: (concept: ConceptFull) => void;
  onNavigateToConcept?: (concept: Concept) => void;
}

interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function AccordionSection({ title, icon, count, defaultOpen = false, children }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

interface ConceptLinkListProps {
  concepts: Concept[];
  emptyMessage: string;
  onNavigate?: (concept: Concept) => void;
}

function ConceptLinkList({ concepts, emptyMessage, onNavigate }: ConceptLinkListProps) {
  if (concepts.length === 0) {
    return <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-1">
      {concepts.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onNavigate?.(c)}
            className="flex items-center gap-2 text-sm text-primary hover:underline w-full text-left py-1"
          >
            <Tag className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{c.pref_label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function confidenceBadgeVariant(confidence: number): 'default' | 'secondary' | 'outline' {
  if (confidence >= 80) return 'default';
  if (confidence >= 50) return 'secondary';
  return 'outline';
}

export function ConceptCard({ concept, schemeName, onEdit, onNavigateToConcept }: ConceptCardProps) {
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">{concept.pref_label}</h3>
            {concept.notation && (
              <p className="text-xs text-muted-foreground font-mono">{concept.notation}</p>
            )}
          </div>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(concept)}
              className="flex-shrink-0"
            >
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Definition */}
      {concept.definition && (
        <div className="px-4 py-3 border-b">
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">Definition</h4>
          <p className="text-sm">{concept.definition}</p>
        </div>
      )}

      {/* Alternate Labels */}
      {concept.alt_labels && concept.alt_labels.length > 0 && (
        <div className="px-4 py-3 border-b">
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
            Alternate Labels
          </h4>
          <div className="flex flex-wrap gap-1">
            {concept.alt_labels.map((label, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {(concept.confidence !== undefined || concept.relevance_score !== undefined ||
        concept.is_primary !== undefined || concept.source || schemeName || concept.created_at) && (
        <div className="px-4 py-3 border-b">
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Metadata</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {concept.confidence !== undefined && (
              <>
                <span className="text-muted-foreground">Confidence</span>
                <Badge variant={confidenceBadgeVariant(concept.confidence)}>
                  {Math.round(concept.confidence)}%
                </Badge>
              </>
            )}
            {concept.relevance_score !== undefined && (
              <>
                <span className="text-muted-foreground">Relevance</span>
                <span>{concept.relevance_score.toFixed(2)}</span>
              </>
            )}
            {concept.is_primary !== undefined && (
              <>
                <span className="text-muted-foreground">Primary</span>
                <Badge variant={concept.is_primary ? 'default' : 'outline'}>
                  {concept.is_primary ? 'Yes' : 'No'}
                </Badge>
              </>
            )}
            {concept.source && (
              <>
                <span className="text-muted-foreground">Source</span>
                <span>{concept.source}</span>
              </>
            )}
            {schemeName && (
              <>
                <span className="text-muted-foreground">Scheme</span>
                <span>{schemeName}</span>
              </>
            )}
            {concept.created_at && (
              <>
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(concept.created_at).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Relationships Accordion */}
      <div>
        <AccordionSection
          title="Broader Concepts"
          icon={<ChevronRight className="w-4 h-4 rotate-[-90deg] text-blue-500" />}
          count={concept.broader?.length || 0}
          defaultOpen
        >
          <ConceptLinkList
            concepts={concept.broader || []}
            emptyMessage="No broader concepts (top-level)"
            onNavigate={onNavigateToConcept}
          />
        </AccordionSection>

        <AccordionSection
          title="Narrower Concepts"
          icon={<ChevronRight className="w-4 h-4 rotate-90 text-green-500" />}
          count={concept.narrower?.length || 0}
        >
          <ConceptLinkList
            concepts={concept.narrower || []}
            emptyMessage="No narrower concepts (leaf)"
            onNavigate={onNavigateToConcept}
          />
        </AccordionSection>

        <AccordionSection
          title="Related Concepts"
          icon={<Link2 className="w-4 h-4 text-purple-500" />}
          count={concept.related?.length || 0}
        >
          <ConceptLinkList
            concepts={concept.related || []}
            emptyMessage="No related concepts"
            onNavigate={onNavigateToConcept}
          />
        </AccordionSection>
      </div>

      {/* Usage Stats */}
      {concept.usage_count !== undefined && (
        <div className="px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Used in</span>
            <span className="font-medium">{concept.usage_count} notes</span>
          </div>
        </div>
      )}
    </div>
  );
}
