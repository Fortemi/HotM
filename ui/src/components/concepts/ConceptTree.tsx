/**
 * ConceptTree Component
 * Hierarchical tree view for SKOS concept navigation
 */

import { useState, useCallback, KeyboardEvent } from 'react';
import { ChevronRight, ChevronDown, Tag, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Concept } from '@/api/types-extended';

interface ConceptTreeProps {
  concepts: Concept[];
  childrenMap?: Map<string, Concept[]>;
  selectedId?: string;
  expandedIds?: Set<string>;
  onSelectConcept: (concept: Concept) => void;
  onExpandCollapse: (conceptId: string, expanded: boolean) => void;
  onLoadChildren?: (conceptId: string) => Promise<Concept[]>;
}

interface TreeNodeProps {
  concept: Concept;
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  children?: Concept[];
  onSelect: (concept: Concept) => void;
  onToggle: (conceptId: string, expanded: boolean) => void;
  onLoadChildren?: (conceptId: string) => Promise<Concept[]>;
  childrenMap?: Map<string, Concept[]>;
  expandedIds: Set<string>;
  selectedId?: string;
}

function TreeNode({
  concept,
  level,
  hasChildren,
  isExpanded,
  isSelected,
  children,
  onSelect,
  onToggle,
  onLoadChildren,
  childrenMap,
  expandedIds,
  selectedId,
}: TreeNodeProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    if (!hasChildren) return;

    if (!isExpanded && onLoadChildren && !children?.length) {
      setIsLoading(true);
      try {
        await onLoadChildren(concept.id);
      } finally {
        setIsLoading(false);
      }
    }
    onToggle(concept.id, !isExpanded);
  }, [concept.id, hasChildren, isExpanded, onLoadChildren, children, onToggle]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect(concept);
          break;
        case 'ArrowRight':
          if (hasChildren && !isExpanded) {
            e.preventDefault();
            handleToggle();
          }
          break;
        case 'ArrowLeft':
          if (isExpanded) {
            e.preventDefault();
            onToggle(concept.id, false);
          }
          break;
      }
    },
    [concept, hasChildren, isExpanded, onSelect, onToggle, handleToggle]
  );

  const nodeHeight = hasChildren ? 'h-11' : 'h-10'; // 44px / 40px per wireframe

  return (
    <div role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected}>
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1 cursor-pointer rounded-md transition-colors',
          nodeHeight,
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
          'focus:outline-none focus:ring-2 focus:ring-primary/50'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(concept)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        data-testid={`concept-node-${concept.id}`}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className="p-0.5 hover:bg-muted-foreground/20 rounded"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-5" /> // Spacer for leaf nodes
        )}

        {/* Icon */}
        {hasChildren ? (
          <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
        ) : (
          <Tag className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}

        {/* Label */}
        <span className="text-sm truncate flex-1">{concept.pref_label}</span>

        {/* Usage count badge if available */}
        {(concept as any).usage_count !== undefined && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {(concept as any).usage_count}
          </span>
        )}
      </div>

      {/* Render children if expanded */}
      {isExpanded && children && children.length > 0 && (
        <div role="group">
          {children.map((child) => {
            const childHasChildren = childrenMap?.has(child.id) || false;
            const childIsExpanded = expandedIds.has(child.id);
            const childChildren = childrenMap?.get(child.id);

            return (
              <TreeNode
                key={child.id}
                concept={child}
                level={level + 1}
                hasChildren={childHasChildren}
                isExpanded={childIsExpanded}
                isSelected={selectedId === child.id}
                children={childChildren}
                onSelect={onSelect}
                onToggle={onToggle}
                onLoadChildren={onLoadChildren}
                childrenMap={childrenMap}
                expandedIds={expandedIds}
                selectedId={selectedId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ConceptTree({
  concepts,
  childrenMap = new Map(),
  selectedId,
  expandedIds = new Set(),
  onSelectConcept,
  onExpandCollapse,
  onLoadChildren,
}: ConceptTreeProps) {
  return (
    <div
      role="tree"
      aria-label="SKOS concept hierarchy"
      className="py-2"
    >
      {concepts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No concepts found</p>
        </div>
      ) : (
        concepts.map((concept) => {
          const hasChildren = childrenMap.has(concept.id);
          const isExpanded = expandedIds.has(concept.id);
          const children = childrenMap.get(concept.id);

          return (
            <TreeNode
              key={concept.id}
              concept={concept}
              level={0}
              hasChildren={hasChildren}
              isExpanded={isExpanded}
              isSelected={selectedId === concept.id}
              children={children}
              onSelect={onSelectConcept}
              onToggle={onExpandCollapse}
              onLoadChildren={onLoadChildren}
              childrenMap={childrenMap}
              expandedIds={expandedIds}
              selectedId={selectedId}
            />
          );
        })
      )}
    </div>
  );
}
