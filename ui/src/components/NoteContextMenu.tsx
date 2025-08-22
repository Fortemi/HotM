import { useEffect } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Edit,
  FileText,
  RefreshCw,
  Trash2,
  FolderOpen,
  Star,
} from 'lucide-react';

interface NoteContextMenuProps {
  children: React.ReactNode;
  noteId: string;
  isArchived?: boolean;
  isStarred?: boolean;
  onEdit: () => void;
  onViewMetadata: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onToggleStar: () => void;
}

export function NoteContextMenu({
  children,
  isArchived,
  isStarred,
  onEdit,
  onViewMetadata,
  onRegenerate,
  onDelete,
  onArchive,
  onToggleStar,
}: NoteContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onEdit} className="gap-2">
          <Edit className="h-4 w-4" />
          Edit Note
        </ContextMenuItem>
        
        <ContextMenuItem onClick={onViewMetadata} className="gap-2">
          <FileText className="h-4 w-4" />
          View Metadata
        </ContextMenuItem>
        
        <ContextMenuItem onClick={onRegenerate} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Regenerate AI
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={onToggleStar} className="gap-2">
          <Star className={`h-4 w-4 ${isStarred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
          {isStarred ? 'Unstar Note' : 'Star Note'}
        </ContextMenuItem>
        
        <ContextMenuItem onClick={onArchive} className="gap-2">
          <FolderOpen className="h-4 w-4" />
          {isArchived ? 'Unarchive Note' : 'Archive Note'}
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={onDelete} 
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Delete Note
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Hook to prevent right-click globally except in specific areas
export function useGlobalContextMenuPrevention() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Allow context menu only on elements with data-allow-context attribute
      // or within context menu triggers
      const allowedElement = target.closest('[data-allow-context="true"]');
      const contextMenuTrigger = target.closest('[data-radix-collection-item]');
      
      if (!allowedElement && !contextMenuTrigger) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);
}