/**
 * Agent privilege system — configurable operational permissions.
 *
 * Three privilege modes gate which tools the agent can execute:
 * - full:     Agent can do everything (admin ops still need confirmation)
 * - assisted: Read freely, write/delete/admin require confirmation (default)
 * - read-only: Only read/search operations allowed
 *
 * Every tool is classified by mutation level:
 * - read:   search, get, list, browse (no side effects)
 * - write:  create, update, revise, tag, link (creates/modifies data)
 * - delete: delete, remove, unlink (destroys data)
 * - admin:  backup, restore, purge (system-level operations)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrivilegeMode = 'full' | 'assisted' | 'read-only';

export type OperationPrivilege = 'read' | 'write' | 'delete' | 'admin';

export type PermissionDecision = 'allowed' | 'confirm' | 'denied';

export interface AgentPrivilegeSettings {
  mode: PrivilegeMode;
  /** Per-tool overrides regardless of mode */
  overrides: Record<string, PermissionDecision>;
  /** Tools auto-approved via "Allow & Remember" for this session */
  sessionAllowlist: string[];
}

// ---------------------------------------------------------------------------
// Tool privilege classification
// ---------------------------------------------------------------------------

export const TOOL_PRIVILEGES: Record<string, OperationPrivilege> = {
  // Read operations — always allowed
  search_notes: 'read',
  get_note: 'read',
  list_collections: 'read',
  get_related: 'read',
  search_concepts: 'read',
  list_archives: 'read',
  list_notes: 'read',
  get_attachments: 'read',

  // Write operations — requires assisted confirmation or full mode
  create_note: 'write',
  revise_note: 'write',
  update_tags: 'write',
  link_notes: 'write',

};

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------

export const DEFAULT_PRIVILEGE_SETTINGS: AgentPrivilegeSettings = {
  mode: 'assisted',
  overrides: {},
  sessionAllowlist: [],
};

// ---------------------------------------------------------------------------
// Permission resolution
// ---------------------------------------------------------------------------

/**
 * Determine whether a tool can execute given the current privilege mode.
 * Checks overrides and session allowlist before falling back to mode rules.
 */
export function canExecute(
  toolName: string,
  settings: AgentPrivilegeSettings,
): PermissionDecision {
  const privilege = TOOL_PRIVILEGES[toolName];
  if (!privilege) return 'denied';

  const override = settings.overrides[toolName];
  if (override === 'denied') return 'denied';
  if (settings.mode === 'read-only' && !override && privilege !== 'read') {
    return 'denied';
  }

  // Once enabled, delete/admin operations retain a confirmation floor.
  if (privilege === 'delete' || privilege === 'admin') {
    return 'confirm';
  }

  // 1. Check per-tool overrides first
  if (override) return override;

  // 2. Check session allowlist ("Allow & Remember")
  if (settings.sessionAllowlist.includes(toolName)) {
    return 'allowed';
  }

  // 3. Resolve from mode + privilege level
  return resolveFromMode(privilege, settings.mode);
}

/**
 * Core permission matrix: mode x privilege → decision.
 */
export function resolveFromMode(
  privilege: OperationPrivilege,
  mode: PrivilegeMode,
): PermissionDecision {
  switch (mode) {
    case 'full':
      // Destructive/admin ops still need confirmation.
      return privilege === 'delete' || privilege === 'admin' ? 'confirm' : 'allowed';

    case 'assisted':
      // Reads auto-approved, writes/deletes/admin need confirmation
      return privilege === 'read' ? 'allowed' : 'confirm';

    case 'read-only':
      // Only reads allowed, everything else denied
      return privilege === 'read' ? 'allowed' : 'denied';
  }
}

/**
 * Get the privilege level for a tool name.
 * Returns undefined for unknown tools so callers fail closed.
 */
export function getToolPrivilege(toolName: string): OperationPrivilege | undefined {
  return TOOL_PRIVILEGES[toolName];
}

/**
 * Get a human-readable label for a privilege mode.
 */
export function getPrivilegeModeLabel(mode: PrivilegeMode): string {
  switch (mode) {
    case 'full':
      return 'Full Access';
    case 'assisted':
      return 'Assisted';
    case 'read-only':
      return 'Read Only';
  }
}

/**
 * Get a description for a privilege mode.
 */
export function getPrivilegeModeDescription(mode: PrivilegeMode): string {
  switch (mode) {
    case 'full':
      return 'Agent can perform all operations. Admin actions still require confirmation.';
    case 'assisted':
      return 'Agent can read freely. Write and delete operations require your confirmation.';
    case 'read-only':
      return 'Agent can only search, browse, and analyze. No modifications allowed.';
  }
}

// ---------------------------------------------------------------------------
// Persistence (localStorage for non-sensitive prefs)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'hotm:agent-privileges';

/**
 * Load privilege settings from localStorage.
 * Returns defaults if nothing saved or data is corrupt.
 */
export function loadPrivilegeSettings(): AgentPrivilegeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRIVILEGE_SETTINGS };
    const parsed = JSON.parse(raw);
    // Validate mode field
    if (!['full', 'assisted', 'read-only'].includes(parsed.mode)) {
      return { ...DEFAULT_PRIVILEGE_SETTINGS };
    }
    const overrides = Object.fromEntries(
      Object.entries(parsed.overrides ?? {}).filter(
        ([toolName, decision]) =>
          toolName in TOOL_PRIVILEGES &&
          ['allowed', 'confirm', 'denied'].includes(String(decision)),
      ),
    ) as Record<string, PermissionDecision>;
    return {
      mode: parsed.mode,
      overrides,
      // Session allowlist is NOT persisted — always starts empty
      sessionAllowlist: [],
    };
  } catch {
    return { ...DEFAULT_PRIVILEGE_SETTINGS };
  }
}

/**
 * Save privilege settings to localStorage.
 * Only persists mode and overrides — sessionAllowlist is ephemeral.
 */
export function savePrivilegeSettings(settings: AgentPrivilegeSettings): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: settings.mode,
        overrides: settings.overrides,
      }),
    );
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}
