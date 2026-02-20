import { useState, useCallback } from "react";
import type { RevisionMode } from "@/api/types";

export interface StickySettings {
  archive: string | null;
  collectionId: string | null;
  collectionName: string;
  tags: string[];
  conceptId: string | null;
  conceptLabel: string;
  format: "markdown" | "plaintext";
  revisionMode: RevisionMode;
  documentType: string | null;
  documentTypeName: string;
}

const KEYS = {
  archive: "hotm.quickCapture.archive",
  collectionId: "hotm.quickCapture.collectionId",
  collectionName: "hotm.quickCapture.collectionName",
  tags: "hotm.quickCapture.tags",
  conceptId: "hotm.quickCapture.conceptId",
  conceptLabel: "hotm.quickCapture.conceptLabel",
  format: "hotm.quickCapture.format",
  revisionMode: "hotm.quickCapture.revisionMode",
  documentType: "hotm.quickCapture.documentType",
  documentTypeName: "hotm.quickCapture.documentTypeName",
} as const;

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeString(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // localStorage unavailable
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable
  }
}

function loadSettings(): StickySettings {
  return {
    archive: readString(KEYS.archive),
    collectionId: readString(KEYS.collectionId),
    collectionName: readString(KEYS.collectionName) ?? "",
    tags: readJson<string[]>(KEYS.tags, []),
    conceptId: readString(KEYS.conceptId),
    conceptLabel: readString(KEYS.conceptLabel) ?? "",
    format: (readString(KEYS.format) as StickySettings["format"]) ?? "markdown",
    revisionMode: (readString(KEYS.revisionMode) as RevisionMode) ?? "full",
    documentType: readString(KEYS.documentType),
    documentTypeName: readString(KEYS.documentTypeName) ?? "",
  };
}

export function useStickySettings() {
  const [settings, setSettingsState] = useState<StickySettings>(loadSettings);

  const setArchive = useCallback((value: string | null) => {
    writeString(KEYS.archive, value);
    setSettingsState((prev) => ({ ...prev, archive: value }));
  }, []);

  const setCollection = useCallback(
    (id: string | null, name: string) => {
      writeString(KEYS.collectionId, id);
      writeString(KEYS.collectionName, name);
      setSettingsState((prev) => ({
        ...prev,
        collectionId: id,
        collectionName: name,
      }));
    },
    []
  );

  const setConcept = useCallback(
    (id: string | null, label: string) => {
      writeString(KEYS.conceptId, id);
      writeString(KEYS.conceptLabel, label);
      setSettingsState((prev) => ({
        ...prev,
        conceptId: id,
        conceptLabel: label,
      }));
    },
    []
  );

  const setTags = useCallback((tags: string[]) => {
    writeJson(KEYS.tags, tags);
    setSettingsState((prev) => ({ ...prev, tags }));
  }, []);

  const addTag = useCallback((tag: string) => {
    setSettingsState((prev) => {
      if (prev.tags.includes(tag)) return prev;
      const next = [...prev.tags, tag];
      writeJson(KEYS.tags, next);
      return { ...prev, tags: next };
    });
  }, []);

  const removeTag = useCallback((tag: string) => {
    setSettingsState((prev) => {
      const next = prev.tags.filter((t) => t !== tag);
      writeJson(KEYS.tags, next);
      return { ...prev, tags: next };
    });
  }, []);

  const setFormat = useCallback((format: StickySettings["format"]) => {
    writeString(KEYS.format, format);
    setSettingsState((prev) => ({ ...prev, format }));
  }, []);

  const setRevisionMode = useCallback((revisionMode: RevisionMode) => {
    writeString(KEYS.revisionMode, revisionMode);
    setSettingsState((prev) => ({ ...prev, revisionMode }));
  }, []);

  const setDocumentType = useCallback(
    (slug: string | null, name: string) => {
      writeString(KEYS.documentType, slug);
      writeString(KEYS.documentTypeName, name);
      setSettingsState((prev) => ({
        ...prev,
        documentType: slug,
        documentTypeName: name,
      }));
    },
    []
  );

  return {
    settings,
    setArchive,
    setCollection,
    setConcept,
    setTags,
    addTag,
    removeTag,
    setFormat,
    setRevisionMode,
    setDocumentType,
  };
}
