import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { NoteConceptSummary } from "@/api/types";
import { 
  Tag, 
  Hash, 
  FileText, 
  Users, 
  Building2, 
  Cpu, 
  MapPin,
  Link,
  Star
} from "lucide-react";

interface NoteMetadataProps {
  metadata?: any;
  provenance?: any;
  aiMetadata?: any;
  tags?: string[];
  conceptTags?: NoteConceptSummary[];
  links?: any[];
  starred?: boolean;
  archived?: boolean;
  onTagClick?: (tag: string) => void;
  onLinkClick?: (noteId: string) => void;
}

export function NoteMetadata({ 
  metadata,
  provenance,
  aiMetadata, 
  tags = [], 
  conceptTags = [],
  links = [],
  starred = false,
  archived = false,
  onTagClick,
  onLinkClick
}: NoteMetadataProps) {
  // Parse AI metadata if it exists
  const parsedAiMetadata = aiMetadata || {};
  const parsedMetadata = metadata || {};
  const metadataEntries = Object.entries(parsedMetadata as Record<string, unknown>);
  const provenanceData =
    provenance ||
    parsedMetadata.provenance ||
    parsedMetadata.memory_provenance ||
    null;

  const formatProvenanceValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Note Metadata</span>
          <div className="flex gap-2">
            {starred && <Star className="h-4 w-4 fill-current text-yellow-500" />}
            {archived && <Badge variant="secondary">Archived</Badge>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {/* Tags */}
          {tags.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Tags</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {tags.map((tag, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline"
                    className={onTagClick ? "cursor-pointer hover:bg-accent" : ""}
                    onClick={() => onTagClick && onTagClick(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <Separator className="my-4" />
            </>
          )}

          {/* SKOS Concept Tags */}
          {conceptTags.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">SKOS Concepts</span>
              </div>
              <div className="space-y-2 mb-4">
                {conceptTags.map((conceptTag, idx) => (
                  <div key={`${conceptTag.concept_id}-${idx}`} className="rounded-md border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={conceptTag.is_primary ? "default" : "secondary"}
                        className={onTagClick ? "cursor-pointer hover:bg-accent" : ""}
                        onClick={() => onTagClick && onTagClick(conceptTag.pref_label)}
                      >
                        {conceptTag.pref_label}
                      </Badge>
                      {conceptTag.notation && (
                        <span className="text-xs text-muted-foreground">
                          {conceptTag.notation}
                        </span>
                      )}
                    </div>
                    {(typeof conceptTag.confidence === "number" ||
                      typeof conceptTag.relevance_score === "number") && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {typeof conceptTag.confidence === "number" && (
                          <span>confidence {(conceptTag.confidence * 100).toFixed(0)}%</span>
                        )}
                        {typeof conceptTag.confidence === "number" &&
                          typeof conceptTag.relevance_score === "number" && <span> · </span>}
                        {typeof conceptTag.relevance_score === "number" && (
                          <span>relevance {(conceptTag.relevance_score * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
            </>
          )}

          {/* AI-Generated Categories */}
          {parsedAiMetadata.categories && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Categories</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {parsedAiMetadata.categories.map((cat: string, idx: number) => (
                  <Badge 
                    key={idx} 
                    variant="secondary"
                    className={onTagClick ? "cursor-pointer hover:bg-accent" : ""}
                    onClick={() => onTagClick && onTagClick(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </>
          )}

          {/* Topics */}
          {parsedAiMetadata.topics && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Topics</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {parsedAiMetadata.topics.map((topic: string, idx: number) => (
                  <Badge 
                    key={idx}
                    className={onTagClick ? "cursor-pointer hover:bg-accent" : ""}
                    onClick={() => onTagClick && onTagClick(topic)}
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </>
          )}

          {/* Entities */}
          {parsedAiMetadata.entities && (
            <>
              <Separator className="my-4" />
              <div className="space-y-3">
                {parsedAiMetadata.entities.people?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">People</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {parsedAiMetadata.entities.people.map((person: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {person}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {parsedAiMetadata.entities.organizations?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Organizations</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {parsedAiMetadata.entities.organizations.map((org: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {org}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {parsedAiMetadata.entities.technologies?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Technologies</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {parsedAiMetadata.entities.technologies.map((tech: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {parsedAiMetadata.entities.locations?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Locations</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {parsedAiMetadata.entities.locations.map((loc: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {loc}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Summary */}
          {parsedAiMetadata.summary && (
            <>
              <Separator className="my-4" />
              <div>
                <span className="text-sm font-semibold">Summary</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {parsedAiMetadata.summary}
                </p>
              </div>
            </>
          )}

          {/* Context */}
          {parsedAiMetadata.context && (
            <>
              <Separator className="my-4" />
              <div>
                <span className="text-sm font-semibold">Context</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {parsedAiMetadata.context}
                </p>
              </div>
            </>
          )}

          {/* Keywords */}
          {parsedAiMetadata.keywords && (
            <>
              <Separator className="my-4" />
              <div>
                <span className="text-sm font-semibold mb-2 block">Keywords</span>
                <div className="flex flex-wrap gap-1">
                  {parsedAiMetadata.keywords.map((keyword: string, idx: number) => (
                    <Badge 
                      key={idx} 
                      variant="secondary" 
                      className={`text-xs ${onTagClick ? "cursor-pointer hover:bg-accent" : ""}`}
                      onClick={() => onTagClick && onTagClick(keyword)}
                    >
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Provenance */}
          {provenanceData && (
            <>
              <Separator className="my-4" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Provenance</span>
                </div>

                {Array.isArray(provenanceData.provenance) && provenanceData.provenance.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {provenanceData.provenance.map((activity: any, idx: number) => (
                      <div key={idx} className="rounded border p-2 text-xs space-y-1">
                        <div><span className="font-medium">Activity:</span> {formatProvenanceValue(activity.activity)}</div>
                        <div><span className="font-medium">Agent:</span> {formatProvenanceValue(activity.agent)}</div>
                        <div><span className="font-medium">Timestamp:</span> {formatProvenanceValue(activity.timestamp)}</div>
                        {activity.location && (
                          <div><span className="font-medium">Location:</span> {formatProvenanceValue(activity.location)}</div>
                        )}
                        {activity.device && (
                          <div><span className="font-medium">Device:</span> {formatProvenanceValue(activity.device)}</div>
                        )}
                        {activity.temporal_context && (
                          <div><span className="font-medium">Temporal:</span> {formatProvenanceValue(activity.temporal_context)}</div>
                        )}
                        {activity.parameters && (
                          <div><span className="font-medium">Parameters:</span> {formatProvenanceValue(activity.parameters)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(provenanceData.attachments) && provenanceData.attachments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    <span className="text-xs font-medium">Attachment Provenance</span>
                    {provenanceData.attachments.map((attachment: any, idx: number) => (
                      <div key={idx} className="rounded border p-2 text-xs space-y-1">
                        <div><span className="font-medium">File:</span> {formatProvenanceValue(attachment.filename)}</div>
                        <div><span className="font-medium">Attachment ID:</span> {formatProvenanceValue(attachment.attachment_id)}</div>
                        {attachment.capture_time && (
                          <div><span className="font-medium">Capture Time:</span> {formatProvenanceValue(attachment.capture_time)}</div>
                        )}
                        {attachment.location && (
                          <div><span className="font-medium">Location:</span> {formatProvenanceValue(attachment.location)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <span className="text-xs font-medium block mb-1">Raw Provenance JSON</span>
                  <pre className="rounded border bg-muted/30 p-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(provenanceData, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}

          {/* Raw JSONB Metadata */}
          {metadataEntries.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">JSON Metadata</span>
                </div>
                <div className="space-y-2 mb-3">
                  {metadataEntries.map(([key, value]) => (
                    <div key={key} className="rounded border p-2 text-xs">
                      <span className="font-medium">{key}:</span>{' '}
                      <span className="text-muted-foreground">
                        {formatProvenanceValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <span className="text-xs font-medium block mb-1">Raw Metadata JSON</span>
                  <pre className="rounded border bg-muted/30 p-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(parsedMetadata, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}

          {/* Linked Notes */}
          {links.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Link className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Linked Notes ({links.length})</span>
                </div>
                <div className="space-y-2">
                  {links.map((link: any, idx: number) => (
                    <div 
                      key={idx} 
                      className={`p-2 rounded border ${onLinkClick ? 'cursor-pointer hover:bg-accent' : ''}`}
                      onClick={() => onLinkClick && onLinkClick(link.to_note_id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium capitalize">
                          {link.kind === 'semantic' ? '🧠 Semantic' : '🔑 Keyword'} Link
                          {link.kind === 'keyword' && link.metadata?.keywords && (
                            <span className="ml-1 text-muted-foreground">
                              ({link.metadata.keywords.join(', ')})
                            </span>
                          )}
                        </span>
                        <Badge variant={link.score > 0.8 ? "default" : "outline"} className="text-xs">
                          {(link.score * 100).toFixed(0)}% match
                        </Badge>
                      </div>
                      {link.snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {link.snippet}
                        </p>
                      )}
                      <div className="text-xs text-blue-600 hover:underline mt-1">
                        Click to open linked note →
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
