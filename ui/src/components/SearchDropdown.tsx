import { useEffect, useRef } from 'react';
import { 
  Card,
  CardContent 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Star, 
  Archive, 
  Clock, 
  Hash,
  Sparkles,
  FileText,
  Loader2,
  X
} from 'lucide-react';
import { Note } from './HallOfMind';

interface SearchDropdownProps {
  isOpen: boolean;
  searchQuery: string;
  searchMode: 'local' | 'fts' | 'semantic' | 'hybrid';
  isSearching: boolean;
  searchResults: Note[];
  onSelectNote: (note: Note) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLDivElement | null>;
  savedNotes?: Map<string, any>; // Access to full note data with AI metadata
}

export function SearchDropdown({
  isOpen,
  searchQuery,
  searchMode,
  isSearching,
  searchResults,
  onSelectNote,
  onClose,
  anchorRef,
  savedNotes
}: SearchDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);
  
  if (!isOpen) return null;
  
  // Get search mode icon and color
  const getModeIcon = () => {
    switch (searchMode) {
      case 'semantic':
        return <Sparkles className="h-3 w-3" />;
      case 'fts':
        return <FileText className="h-3 w-3" />;
      case 'hybrid':
        return <Hash className="h-3 w-3" />;
      default:
        return <Search className="h-3 w-3" />;
    }
  };
  
  const getModeLabel = () => {
    switch (searchMode) {
      case 'semantic':
        return 'Smart Search';
      case 'fts':
        return 'Text Search';
      case 'hybrid':
        return 'Enhanced Search';
      default:
        return 'Quick Search';
    }
  };
  
  // Extract categories and topics from AI metadata
  const getNoteMetadata = (note: Note) => {
    const fullNote = savedNotes?.get(note.id);
    const aiMetadata = fullNote?.revised?.ai_metadata;
    
    const categories = aiMetadata?.categories || [];
    const topics = aiMetadata?.topics || [];
    const tags = note.tags?.slice(0, 3) || [];
    
    return { categories, topics, tags };
  };
  
  const getNoteBadges = (note: Note) => {
    const badges = [];
    if (note.starred) badges.push({ icon: Star, label: 'Starred', className: 'text-yellow-500' });
    if (note.archived) badges.push({ icon: Archive, label: 'Archived', className: 'text-muted-foreground' });
    return badges;
  };
  
  return (
    <div 
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-2 z-50"
      style={{ 
        maxWidth: '600px',
        maxHeight: 'min(400px, 50vh)'
      }}
    >
      <Card className="shadow-lg border-2 max-h-full flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              {getModeIcon()}
              <span className="text-sm font-medium">{getModeLabel()}</span>
              <Badge variant="secondary" className="text-xs">
                {isSearching ? 'Searching...' : `${searchResults.length} results`}
              </Badge>
            </div>
            <button
              onClick={onClose}
              className="hover:bg-accent rounded p-1 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          
          {/* Results */}
          <div className="overflow-hidden flex-1">
            <ScrollArea className="h-full max-h-[320px]">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  No results found for "{searchQuery}"
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try different keywords or search mode
                </p>
              </div>
            ) : (
              <div className="py-2">
                {searchResults.map((note) => {
                  const metadata = getNoteMetadata(note);
                  const badges = getNoteBadges(note);
                  
                  return (
                    <button
                      key={note.id}
                      onClick={() => {
                        onSelectNote(note);
                        onClose();
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors border-b last:border-0"
                    >
                      <div className="space-y-2">
                        {/* Title and badges */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-sm line-clamp-1 flex-1">
                            {note.title}
                          </h3>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {badges.map((badge, idx) => (
                              <badge.icon 
                                key={idx} 
                                className={`h-3 w-3 ${badge.className}`}
                              />
                            ))}
                          </div>
                        </div>
                        
                        {/* Content preview */}
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {note.revised_content || note.content}
                        </p>
                        
                        {/* Metadata row */}
                        <div className="space-y-1">
                          {/* Categories and Topics */}
                          {(metadata.categories.length > 0 || metadata.topics.length > 0) && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Categories */}
                              {metadata.categories.slice(0, 2).map((category: string, idx: number) => (
                                <Badge 
                                  key={`cat-${idx}`} 
                                  variant="default" 
                                  className="text-xs py-0 h-5 bg-blue-500/10 text-blue-700 border-blue-200"
                                >
                                  📂 {category}
                                </Badge>
                              ))}
                              
                              {/* Topics */}
                              {metadata.topics.slice(0, 2).map((topic: string, idx: number) => (
                                <Badge 
                                  key={`topic-${idx}`} 
                                  variant="secondary" 
                                  className="text-xs py-0 h-5 bg-purple-500/10 text-purple-700 border-purple-200"
                                >
                                  💡 {topic}
                                </Badge>
                              ))}
                              
                              {(metadata.categories.length > 2 || metadata.topics.length > 2) && (
                                <span className="text-xs text-muted-foreground">
                                  +{(metadata.categories.length - 2) + (metadata.topics.length - 2)} more
                                </span>
                              )}
                            </div>
                          )}
                          
                          {/* Second row: Date and Tags */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(note.createdAt).toLocaleDateString()}
                            </div>
                            
                            {/* Tags */}
                            {metadata.tags.length > 0 && (
                              <>
                                <span className="text-xs text-muted-foreground">•</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {metadata.tags.map((tag, idx) => (
                                    <Badge 
                                      key={idx} 
                                      variant="outline" 
                                      className="text-xs py-0 h-5"
                                    >
                                      #{tag}
                                    </Badge>
                                  ))}
                                  {note.tags && note.tags.length > 3 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{note.tags.length - 3} tags
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}