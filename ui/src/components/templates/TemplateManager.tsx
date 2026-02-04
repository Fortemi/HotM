/**
 * TemplateManager Component
 * CRUD interface for note templates with variable substitution
 */

import { useState, useEffect, useMemo } from 'react';
import {
  FileCode,
  Plus,
  Search,
  Grid,
  List,
  Edit2,
  Trash2,
  Play,
  Loader2,
  Variable,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { api } from '@/api';
import type { Template, CreateTemplateRequest } from '@/api/types-extended';

interface TemplateManagerProps {
  className?: string;
  onCreateNote?: (content: string, tags?: string[]) => void;
}

type ViewMode = 'grid' | 'list';

// Extract variables from template content
function extractVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

// Substitute variables in content
function substituteVariables(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] || match);
}

interface VariableChipProps {
  name: string;
  onClick?: (name: string) => void;
}

function VariableChip({ name, onClick }: VariableChipProps) {
  const handleClick = () => onClick?.(name);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(name);
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono',
        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
        onClick && 'cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800/50'
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      aria-label={`{{${name}}}`}
    >
      {`{{${name}}}`}
    </span>
  );
}

interface TemplateCardProps {
  template: Template;
  viewMode: ViewMode;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  onUse: (template: Template) => void;
}

function TemplateCard({ template, viewMode, onEdit, onDelete, onUse }: TemplateCardProps) {
  const variables = useMemo(() => extractVariables(template.content), [template.content]);

  if (viewMode === 'grid') {
    return (
      <div className="bg-card border rounded-lg overflow-hidden hover:border-primary transition-colors group">
        {/* Preview */}
        <div className="h-32 bg-muted p-3 overflow-hidden text-xs text-muted-foreground">
          <pre className="whitespace-pre-wrap line-clamp-5 font-mono">
            {template.content.slice(0, 200)}
          </pre>
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          <h4 className="font-medium truncate">{template.name}</h4>

          {/* Variables */}
          {variables.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {variables.slice(0, 3).map((v) => (
                <VariableChip key={v} name={v} />
              ))}
              {variables.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{variables.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Tags */}
          {template.default_tags && template.default_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.default_tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex border-t">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 rounded-none"
            onClick={() => onUse(template)}
          >
            <Play className="w-4 h-4 mr-1" />
            Use
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 rounded-none border-l"
            onClick={() => onEdit(template)}
          >
            <Edit2 className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 rounded-none border-l text-destructive hover:text-destructive"
            onClick={() => onDelete(template)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary transition-colors">
      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
        <FileCode className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate">{template.name}</h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{variables.length} variables</span>
          {template.default_tags && template.default_tags.length > 0 && (
            <>
              <span>·</span>
              <span>{template.default_tags.length} tags</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onUse(template)}>
          <Play className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(template)}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(template)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

interface TemplateEditorDialogProps {
  template?: Template | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateTemplateRequest) => void;
}

function TemplateEditorDialog({ template, isOpen, onClose, onSave }: TemplateEditorDialogProps) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  const variables = useMemo(() => extractVariables(content), [content]);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setContent(template.content);
      setTags(template.default_tags?.join(', ') || '');
    } else {
      setName('');
      setContent('');
      setTags('');
    }
  }, [template, isOpen]);

  const handleSave = () => {
    onSave({
      name: name.trim(),
      content: content.trim(),
      default_tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Template' : 'Create Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium">Template Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Meeting Notes"
              className="mt-1"
            />
          </div>

          {/* Content */}
          <div>
            <label className="text-sm font-medium">Content</label>
            <p className="text-xs text-muted-foreground mb-1">
              Use {'{{variable_name}}'} for substitutable fields
            </p>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# {{title}}

## Date: {{date}}

## Attendees
- {{attendees}}

## Notes
{{notes}}"
              rows={10}
              className="mt-1 font-mono text-sm"
            />
          </div>

          {/* Detected Variables */}
          {variables.length > 0 && (
            <div>
              <label className="text-sm font-medium">Detected Variables</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {variables.map((v) => (
                  <VariableChip key={v} name={v} />
                ))}
              </div>
            </div>
          )}

          {/* Default Tags */}
          <div>
            <label className="text-sm font-medium">Default Tags</label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="meeting, notes, work"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated list of tags to apply automatically
            </p>
          </div>

          {/* Preview */}
          {content && (
            <div>
              <label className="text-sm font-medium">Preview</label>
              <div className="mt-1 bg-muted rounded-lg p-4 max-h-48 overflow-y-auto">
                <MarkdownPreview content={content} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !content.trim()}>
            {template ? 'Save Changes' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface InstantiationDialogProps {
  template: Template | null;
  isOpen: boolean;
  onClose: () => void;
  onInstantiate: (content: string, tags?: string[]) => void;
}

function InstantiationDialog({ template, isOpen, onClose, onInstantiate }: InstantiationDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const variables = useMemo(
    () => (template ? extractVariables(template.content) : []),
    [template]
  );
  const preview = useMemo(
    () => (template ? substituteVariables(template.content, values) : ''),
    [template, values]
  );

  useEffect(() => {
    if (template) {
      // Initialize with empty values
      const initial: Record<string, string> = {};
      variables.forEach((v) => {
        initial[v] = '';
      });
      setValues(initial);
    }
  }, [template, variables]);

  const handleInstantiate = () => {
    onInstantiate(preview, template?.default_tags);
    onClose();
  };

  if (!template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Use Template: {template.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Variables Form */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Variable className="w-4 h-4" />
              Fill Variables
            </h4>
            {variables.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This template has no variables to fill.
              </p>
            ) : (
              variables.map((v) => (
                <div key={v}>
                  <label className="text-sm font-medium">{v}</label>
                  <Input
                    value={values[v] || ''}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [v]: e.target.value }))
                    }
                    placeholder={`Enter ${v}...`}
                    className="mt-1"
                  />
                </div>
              ))
            )}
          </div>

          {/* Live Preview */}
          <div>
            <h4 className="text-sm font-medium mb-2">Live Preview</h4>
            <div className="bg-muted rounded-lg p-4 h-64 overflow-y-auto">
              <MarkdownPreview content={preview} />
            </div>
          </div>
        </div>

        {/* Tags */}
        {template.default_tags && template.default_tags.length > 0 && (
          <div className="py-2 border-t">
            <p className="text-sm text-muted-foreground">
              Tags to apply:{' '}
              {template.default_tags.map((tag) => (
                <Badge key={tag} variant="outline" className="ml-1">
                  #{tag}
                </Badge>
              ))}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInstantiate}>
            <Play className="w-4 h-4 mr-2" />
            Create Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TemplateManager({ className, onCreateNote }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [instantiationOpen, setInstantiationOpen] = useState(false);
  const [instantiatingTemplate, setInstantiatingTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.templates.list();
      setTemplates(data);
    } catch (err) {
      setError('Failed to load templates');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const handleCreate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleSave = async (data: CreateTemplateRequest) => {
    try {
      if (editingTemplate) {
        await api.templates.update(editingTemplate.id, data);
      } else {
        await api.templates.create(data);
      }
      await loadTemplates();
      setEditorOpen(false);
    } catch (err) {
      console.error('Failed to save template:', err);
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    try {
      await api.templates.delete(deletingTemplate.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const handleUse = (template: Template) => {
    setInstantiatingTemplate(template);
    setInstantiationOpen(true);
  };

  const handleInstantiate = (content: string, tags?: string[]) => {
    onCreateNote?.(content, tags);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileCode className="w-5 h-5" />
          Templates
        </h2>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={loadTemplates} className="mt-4">
            Retry
          </Button>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {searchQuery ? 'No templates match your search' : 'No templates yet'}
          </p>
          {!searchQuery && (
            <Button variant="outline" size="sm" onClick={handleCreate} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Create your first template
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              viewMode="grid"
              onEdit={handleEdit}
              onDelete={(t) => {
                setDeletingTemplate(t);
                setDeleteDialogOpen(true);
              }}
              onUse={handleUse}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              viewMode="list"
              onEdit={handleEdit}
              onDelete={(t) => {
                setDeletingTemplate(t);
                setDeleteDialogOpen(true);
              }}
              onUse={handleUse}
            />
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <TemplateEditorDialog
        template={editingTemplate}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />

      {/* Instantiation Dialog */}
      <InstantiationDialog
        template={instantiatingTemplate}
        isOpen={instantiationOpen}
        onClose={() => setInstantiationOpen(false)}
        onInstantiate={handleInstantiate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTemplate?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
