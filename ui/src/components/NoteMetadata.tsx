import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  Star,
  Lock,
  Unlock,
  Save,
  X,
  Plus,
} from "lucide-react";

interface ConceptOption {
  concept_id: string;
  pref_label: string;
  notation?: string;
}

interface NoteMetadataSavePayload {
  tags: string[];
  conceptIds: string[];
  metadata: Record<string, unknown>;
}

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
  onSaveEdits?: (payload: NoteMetadataSavePayload) => Promise<void>;
  availableConcepts?: ConceptOption[];
}

export function NoteMetadata({
  metadata,
  provenance,
  aiMetadata,
  tags,
  conceptTags,
  links,
  starred = false,
  archived = false,
  onTagClick,
  onLinkClick,
  onSaveEdits,
  availableConcepts = [],
}: NoteMetadataProps) {
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftConceptIds, setDraftConceptIds] = useState<string[]>([]);
  const [draftMetadataJson, setDraftMetadataJson] = useState("{}");
  const [tagInput, setTagInput] = useState("");
  const [conceptToAdd, setConceptToAdd] = useState("");

  const parsedAiMetadata = useMemo(() => aiMetadata || {}, [aiMetadata]);
  const parsedMetadata = useMemo(() => metadata || {}, [metadata]);
  const tagsValue = useMemo(() => tags || [], [tags]);
  const conceptTagsValue = useMemo(() => conceptTags || [], [conceptTags]);
  const linksValue = useMemo(() => links || [], [links]);
  const metadataEntries = Object.entries(parsedMetadata as Record<string, unknown>);
  const provenanceData =
    provenance || parsedMetadata.provenance || parsedMetadata.memory_provenance || null;

  const conceptOptions = useMemo(() => {
    const merged = new Map<string, ConceptOption>();
    for (const concept of availableConcepts) {
      if (concept?.concept_id) {
        merged.set(concept.concept_id, concept);
      }
    }
    for (const concept of conceptTagsValue) {
      if (concept?.concept_id) {
        merged.set(concept.concept_id, {
          concept_id: concept.concept_id,
          pref_label: concept.pref_label,
          notation: concept.notation,
        });
      }
    }
    return Array.from(merged.values()).sort((a, b) => a.pref_label.localeCompare(b.pref_label));
  }, [availableConcepts, conceptTagsValue]);

  useEffect(() => {
    if (isEditUnlocked) return;
    setDraftTags(Array.from(new Set(tagsValue.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)));
    setDraftConceptIds(
      Array.from(
        new Set(
          conceptTagsValue
            .map((concept) => concept.concept_id?.trim())
            .filter((conceptId): conceptId is string => Boolean(conceptId))
        )
      )
    );
    setDraftMetadataJson(JSON.stringify(parsedMetadata, null, 2));
    setTagInput("");
    setConceptToAdd("");
    setSaveError(null);
  }, [conceptTagsValue, isEditUnlocked, parsedMetadata, tagsValue]);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const addTag = () => {
    const next = tagInput.trim();
    if (!next) return;
    if (draftTags.includes(next)) {
      setTagInput("");
      return;
    }
    setDraftTags((prev) => [...prev, next].sort((a, b) => a.localeCompare(b)));
    setTagInput("");
  };

  const addConcept = () => {
    const conceptId = conceptToAdd.trim();
    if (!conceptId) return;
    if (draftConceptIds.includes(conceptId)) {
      setConceptToAdd("");
      return;
    }
    setDraftConceptIds((prev) => [...prev, conceptId]);
    setConceptToAdd("");
  };

  const resetDrafts = () => {
    setDraftTags(Array.from(new Set(tagsValue.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)));
    setDraftConceptIds(
      Array.from(
        new Set(
          conceptTagsValue
            .map((concept) => concept.concept_id?.trim())
            .filter((conceptId): conceptId is string => Boolean(conceptId))
        )
      )
    );
    setDraftMetadataJson(JSON.stringify(parsedMetadata, null, 2));
    setTagInput("");
    setConceptToAdd("");
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!onSaveEdits) {
      setIsEditUnlocked(false);
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      const parsed = JSON.parse(draftMetadataJson) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Metadata JSON must be an object.");
      }
      await onSaveEdits({
        tags: draftTags,
        conceptIds: draftConceptIds,
        metadata: parsed as Record<string, unknown>,
      });
      setIsEditUnlocked(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save metadata edits.");
    } finally {
      setIsSaving(false);
    }
  };

  const editableConceptOptions = conceptOptions.filter(
    (option) => !draftConceptIds.includes(option.concept_id)
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Note Metadata</span>
          <div className="flex gap-2 items-center">
            {isEditUnlocked ? (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => {
                    resetDrafts();
                    setIsEditUnlocked(false);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditUnlocked(true)}
              >
                <Unlock className="h-4 w-4 mr-1" />
                Unlock Editing
              </Button>
            )}
            {!isEditUnlocked && <Lock className="h-4 w-4 text-muted-foreground" />}
            {starred && <Star className="h-4 w-4 fill-current text-yellow-500" />}
            {archived && <Badge variant="secondary">Archived</Badge>}
          </div>
        </CardTitle>
        {saveError && <div className="text-sm text-destructive">{saveError}</div>}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="mb-2 text-xs text-muted-foreground">
            {isEditUnlocked
              ? "Edit mode is unlocked. Save to apply changes."
              : "Read-only mode. Unlock editing to modify tags, SKOS concepts, and JSON metadata."}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Tags</span>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {(isEditUnlocked ? draftTags : tagsValue).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={!isEditUnlocked && onTagClick ? "cursor-pointer hover:bg-accent" : ""}
                onClick={() => !isEditUnlocked && onTagClick?.(tag)}
              >
                {tag}
                {isEditUnlocked && (
                  <button
                    className="ml-1"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDraftTags((prev) => prev.filter((item) => item !== tag));
                    }}
                    aria-label={`Remove tag ${tag}`}
                    type="button"
                  >
                    ×
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {isEditUnlocked && (
            <div className="flex items-center gap-2 mb-4">
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="Add tag"
                className="h-8"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button size="sm" variant="outline" onClick={addTag} type="button">
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          )}
          <Separator className="my-4" />

          <div className="flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">SKOS Concepts</span>
          </div>
          <div className="space-y-2 mb-2">
            {(isEditUnlocked ? draftConceptIds : conceptTagsValue.map((item) => item.concept_id))
              .map((conceptId) => {
                const concept =
                  conceptOptions.find((item) => item.concept_id === conceptId) ||
                  conceptTagsValue.find((item) => item.concept_id === conceptId);
                if (!concept) return null;
                const prefLabel = concept.pref_label;
                const notation = concept.notation;
                const scored =
                  conceptTagsValue.find((item) => item.concept_id === conceptId) ?? null;

                return (
                  <div key={conceptId} className="rounded-md border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={!isEditUnlocked && onTagClick ? "cursor-pointer hover:bg-accent" : ""}
                        onClick={() => !isEditUnlocked && onTagClick?.(prefLabel)}
                      >
                        {prefLabel}
                      </Badge>
                      {notation && <span className="text-xs text-muted-foreground">{notation}</span>}
                      {isEditUnlocked && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={() => setDraftConceptIds((prev) => prev.filter((id) => id !== conceptId))}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    {(typeof scored?.confidence === "number" ||
                      typeof scored?.relevance_score === "number") && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {typeof scored?.confidence === "number" && (
                          <span>confidence {(scored.confidence * 100).toFixed(0)}%</span>
                        )}
                        {typeof scored?.confidence === "number" &&
                          typeof scored?.relevance_score === "number" && <span> · </span>}
                        {typeof scored?.relevance_score === "number" && (
                          <span>relevance {(scored.relevance_score * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          {isEditUnlocked && (
            <div className="flex items-center gap-2 mb-4">
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={conceptToAdd}
                onChange={(event) => setConceptToAdd(event.target.value)}
              >
                <option value="">Select concept to add</option>
                {editableConceptOptions.map((option) => (
                  <option key={option.concept_id} value={option.concept_id}>
                    {option.pref_label}
                    {option.notation ? ` (${option.notation})` : ""}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={addConcept} type="button" disabled={!conceptToAdd}>
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          )}
          <Separator className="my-4" />

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
                    className={!isEditUnlocked && onTagClick ? "cursor-pointer hover:bg-accent" : ""}
                    onClick={() => !isEditUnlocked && onTagClick?.(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </>
          )}

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
                    className={!isEditUnlocked && onTagClick ? "cursor-pointer hover:bg-accent" : ""}
                    onClick={() => !isEditUnlocked && onTagClick?.(topic)}
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </>
          )}

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

          {parsedAiMetadata.summary && (
            <>
              <Separator className="my-4" />
              <div>
                <span className="text-sm font-semibold">Summary</span>
                <p className="text-sm text-muted-foreground mt-1">{parsedAiMetadata.summary}</p>
              </div>
            </>
          )}

          {parsedAiMetadata.context && (
            <>
              <Separator className="my-4" />
              <div>
                <span className="text-sm font-semibold">Context</span>
                <p className="text-sm text-muted-foreground mt-1">{parsedAiMetadata.context}</p>
              </div>
            </>
          )}

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
                      className={`text-xs ${!isEditUnlocked && onTagClick ? "cursor-pointer hover:bg-accent" : ""}`}
                      onClick={() => !isEditUnlocked && onTagClick?.(keyword)}
                    >
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

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
                        <div><span className="font-medium">Activity:</span> {formatValue(activity.activity)}</div>
                        <div><span className="font-medium">Agent:</span> {formatValue(activity.agent)}</div>
                        <div><span className="font-medium">Timestamp:</span> {formatValue(activity.timestamp)}</div>
                        {activity.location && (
                          <div><span className="font-medium">Location:</span> {formatValue(activity.location)}</div>
                        )}
                        {activity.device && (
                          <div><span className="font-medium">Device:</span> {formatValue(activity.device)}</div>
                        )}
                        {activity.temporal_context && (
                          <div><span className="font-medium">Temporal:</span> {formatValue(activity.temporal_context)}</div>
                        )}
                        {activity.parameters && (
                          <div><span className="font-medium">Parameters:</span> {formatValue(activity.parameters)}</div>
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
                        <div><span className="font-medium">File:</span> {formatValue(attachment.filename)}</div>
                        <div><span className="font-medium">Attachment ID:</span> {formatValue(attachment.attachment_id)}</div>
                        {attachment.capture_time && (
                          <div><span className="font-medium">Capture Time:</span> {formatValue(attachment.capture_time)}</div>
                        )}
                        {attachment.location && (
                          <div><span className="font-medium">Location:</span> {formatValue(attachment.location)}</div>
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

          <Separator className="my-4" />
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">JSON Metadata</span>
            </div>
            {isEditUnlocked ? (
              <Textarea
                className="min-h-[220px] font-mono text-xs"
                value={draftMetadataJson}
                onChange={(event) => setDraftMetadataJson(event.target.value)}
              />
            ) : (
              <>
                <div className="space-y-2 mb-3">
                  {metadataEntries.length === 0 && (
                    <div className="rounded border p-2 text-xs text-muted-foreground">No JSON metadata</div>
                  )}
                  {metadataEntries.map(([key, value]) => (
                    <div key={key} className="rounded border p-2 text-xs">
                      <span className="font-medium">{key}:</span>{" "}
                      <span className="text-muted-foreground">{formatValue(value)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <span className="text-xs font-medium block mb-1">Raw Metadata JSON</span>
                  <pre className="rounded border bg-muted/30 p-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(parsedMetadata, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>

          {linksValue.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Link className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Linked Notes ({linksValue.length})</span>
                </div>
                <div className="space-y-2">
                  {linksValue.map((linked: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-2 rounded border ${!isEditUnlocked && onLinkClick ? "cursor-pointer hover:bg-accent" : ""}`}
                      onClick={() => !isEditUnlocked && onLinkClick?.(linked.to_note_id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium capitalize">
                          {linked.kind === "semantic" ? "🧠 Semantic" : "🔑 Keyword"} Link
                          {linked.kind === "keyword" && linked.metadata?.keywords && (
                            <span className="ml-1 text-muted-foreground">
                              ({linked.metadata.keywords.join(", ")})
                            </span>
                          )}
                        </span>
                        <Badge variant={linked.score > 0.8 ? "default" : "outline"} className="text-xs">
                          {(linked.score * 100).toFixed(0)}% match
                        </Badge>
                      </div>
                      {linked.snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{linked.snippet}</p>
                      )}
                      {!isEditUnlocked && (
                        <div className="text-xs text-blue-600 hover:underline mt-1">Click to open linked note →</div>
                      )}
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
