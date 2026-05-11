/**
 * ArchiveInferenceSettings (Issue #208)
 *
 * Thin wrapper over <InferenceSettings> that scopes every API call to a
 * single archive via the `X-Fortemi-Memory` header. Composition over
 * inheritance — we don't fork the 1100-line settings form, we just pass
 * the scope prop through.
 *
 * Render this inside a modal or side-panel from ArchiveManager. The
 * underlying form surfaces a deferred-hot-swap warning at the top
 * automatically when `scope` is set (see InferenceSettings.tsx).
 */

import { InferenceSettings } from '@/components/admin/InferenceSettings';

export interface ArchiveInferenceSettingsProps {
  archive: string;
  className?: string;
}

export function ArchiveInferenceSettings({ archive, className }: ArchiveInferenceSettingsProps) {
  return (
    <div className={className}>
      <InferenceSettings scope={{ archive }} />
    </div>
  );
}
