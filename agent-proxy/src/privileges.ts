import { createHash } from 'node:crypto';
import type { ToolSet } from 'ai';
import type { AgentToolName } from './tools.js';

export type PrivilegeMode = 'full' | 'assisted' | 'read-only';
export type OperationPrivilege = 'read' | 'write' | 'delete' | 'admin';
export type PermissionDecision = 'allowed' | 'confirm' | 'denied';
export type ConfirmationDecision = 'allow' | 'allow-remember' | 'deny';

export interface AgentPrivilegeSettings {
  mode: PrivilegeMode;
  overrides: Partial<Record<AgentToolName, PermissionDecision>>;
}

export interface PrivilegeRequestRestriction {
  mode: PrivilegeMode;
  overrides: Partial<Record<AgentToolName, PermissionDecision>>;
}

export interface PrivilegeAuditEvent {
  outcome: 'allow' | 'deny' | 'confirm';
  toolName: string;
  privilege?: OperationPrivilege;
  reason: string;
}

export type PrivilegeAuditLogger = (event: PrivilegeAuditEvent) => void;

export const AGENT_TOOL_PRIVILEGES = {
  search_notes: 'read',
  create_note: 'write',
  get_note: 'read',
  revise_note: 'write',
  update_tags: 'write',
  list_collections: 'read',
  search_concepts: 'read',
  get_related: 'read',
  list_archives: 'read',
  list_notes: 'read',
  get_attachments: 'read',
} as const satisfies Record<AgentToolName, OperationPrivilege>;

export const DEFAULT_PRIVILEGE_SETTINGS: AgentPrivilegeSettings = {
  mode: 'assisted',
  overrides: {},
};

const CONFIRMATION_TTL_MS = 10 * 60_000;
const DECISION_RANK: Record<PermissionDecision, number> = {
  denied: 0,
  confirm: 1,
  allowed: 2,
};

interface ConfirmationRecord {
  toolName: string;
  argumentsDigest: string;
  state: 'pending' | 'approved' | 'denied' | 'consumed';
  expiresAt: number;
}

interface PrivilegeSession {
  identityKey: string;
  settings: AgentPrivilegeSettings;
  clientRevision: number;
  sessionAllowlist: Set<AgentToolName>;
  confirmations: Map<string, ConfirmationRecord>;
}

export class AgentPrivilegeError extends Error {
  constructor(
    readonly code:
      | 'invalid_settings'
      | 'operation_denied'
      | 'confirmation_required'
      | 'confirmation_invalid'
      | 'confirmation_replayed'
      | 'session_context_mismatch',
    message: string,
  ) {
    super(message);
    this.name = 'AgentPrivilegeError';
  }
}

export function classifyTool(toolName: string): OperationPrivilege | undefined {
  return AGENT_TOOL_PRIVILEGES[toolName as AgentToolName];
}

export function resolveFromMode(
  privilege: OperationPrivilege,
  mode: PrivilegeMode,
): PermissionDecision {
  if (mode === 'read-only') {
    return privilege === 'read' ? 'allowed' : 'denied';
  }
  if (mode === 'assisted') {
    return privilege === 'read' ? 'allowed' : 'confirm';
  }
  return privilege === 'read' || privilege === 'write' ? 'allowed' : 'confirm';
}

export function resolvePermission(
  toolName: string,
  settings: AgentPrivilegeSettings,
  sessionAllowlist: ReadonlySet<AgentToolName> = new Set(),
): PermissionDecision {
  const privilege = classifyTool(toolName);
  if (!privilege) return 'denied';

  const override = settings.overrides[toolName as AgentToolName];
  if (override === 'denied') return 'denied';

  if (settings.mode === 'read-only' && !override && privilege !== 'read') {
    return 'denied';
  }

  // Once enabled, destructive and administrative actions retain a confirmation floor.
  if (privilege === 'delete' || privilege === 'admin') return 'confirm';
  if (override) return override;
  if (privilege === 'write' && sessionAllowlist.has(toolName as AgentToolName)) {
    return 'allowed';
  }
  return resolveFromMode(privilege, settings.mode);
}

export function parsePrivilegeSettings(value: unknown): AgentPrivilegeSettings {
  if (!value || typeof value !== 'object') {
    throw new AgentPrivilegeError('invalid_settings', 'Privilege settings are required.');
  }
  const input = value as Record<string, unknown>;
  if (!isPrivilegeMode(input.mode)) {
    throw new AgentPrivilegeError('invalid_settings', 'Privilege mode is invalid.');
  }
  if (input.overrides !== undefined && (!input.overrides || typeof input.overrides !== 'object' || Array.isArray(input.overrides))) {
    throw new AgentPrivilegeError('invalid_settings', 'Privilege overrides are invalid.');
  }

  const overrides: AgentPrivilegeSettings['overrides'] = {};
  for (const [toolName, decision] of Object.entries(input.overrides ?? {})) {
    if (!classifyTool(toolName) || !isPermissionDecision(decision)) {
      throw new AgentPrivilegeError(
        'invalid_settings',
        `Privilege override for "${toolName}" is invalid.`,
      );
    }
    overrides[toolName as AgentToolName] = decision;
  }
  return { mode: input.mode, overrides };
}

function isPrivilegeMode(value: unknown): value is PrivilegeMode {
  return value === 'full' || value === 'assisted' || value === 'read-only';
}

function isPermissionDecision(value: unknown): value is PermissionDecision {
  return value === 'allowed' || value === 'confirm' || value === 'denied';
}

function mostRestrictive(
  first: PermissionDecision,
  second: PermissionDecision,
): PermissionDecision {
  return DECISION_RANK[first] <= DECISION_RANK[second] ? first : second;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function digestToolArguments(args: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(args)) ?? 'undefined')
    .digest('hex');
}

function defaultAuditLogger(event: PrivilegeAuditEvent): void {
  console.info('[agent-privilege]', JSON.stringify(event));
}

export class AgentPrivilegeStore {
  private readonly sessions = new Map<string, PrivilegeSession>();

  constructor(
    private readonly audit: PrivilegeAuditLogger = defaultAuditLogger,
    private readonly now: () => number = Date.now,
  ) {}

  updateSession(
    sessionId: string,
    settings: AgentPrivilegeSettings,
    clientRevision: number,
    identityKey = 'anonymous_local:public',
  ): AgentPrivilegeSettings {
    const session = this.getSession(sessionId, identityKey);
    if (!Number.isSafeInteger(clientRevision) || clientRevision < 0) {
      throw new AgentPrivilegeError('invalid_settings', 'Privilege policy revision is invalid.');
    }
    if (clientRevision > session.clientRevision) {
      session.settings = {
        mode: settings.mode,
        overrides: { ...settings.overrides },
      };
      session.clientRevision = clientRevision;
    }
    return { ...session.settings, overrides: { ...session.settings.overrides } };
  }

  decisionFor(
    sessionId: string,
    toolName: string,
    requestRestriction?: PrivilegeRequestRestriction,
    identityKey = 'anonymous_local:public',
  ): PermissionDecision {
    const session = this.getSession(sessionId, identityKey);
    const stored = resolvePermission(toolName, session.settings, session.sessionAllowlist);
    if (!requestRestriction) return stored;
    const storedBase = resolvePermission(toolName, session.settings);
    const requested = resolvePermission(toolName, requestRestriction);
    return DECISION_RANK[requested] < DECISION_RANK[storedBase]
      ? mostRestrictive(stored, requested)
      : stored;
  }

  registerConfirmation(
    sessionId: string,
    toolCallId: string,
    toolName: string,
    args: unknown,
    identityKey = 'anonymous_local:public',
  ): void {
    const session = this.getSession(sessionId, identityKey);
    this.pruneExpired(session);
    const existing = session.confirmations.get(toolCallId);
    const argumentsDigest = digestToolArguments(args);
    if (existing) {
      if (existing.toolName === toolName && existing.argumentsDigest === argumentsDigest && existing.state === 'pending') {
        return;
      }
      throw new AgentPrivilegeError(
        existing.state === 'consumed' ? 'confirmation_replayed' : 'confirmation_invalid',
        'This confirmation cannot be reused for another operation.',
      );
    }
    session.confirmations.set(toolCallId, {
      toolName,
      argumentsDigest,
      state: 'pending',
      expiresAt: this.now() + CONFIRMATION_TTL_MS,
    });
  }

  resolveConfirmation(input: {
    sessionId: string;
    toolCallId: string;
    toolName: string;
    args: unknown;
    decision: ConfirmationDecision;
    identityKey?: string;
  }): void {
    const session = this.getSession(input.sessionId, input.identityKey);
    this.pruneExpired(session);
    const record = session.confirmations.get(input.toolCallId);
    this.assertMatchingConfirmation(record, input.toolName, input.args);
    if (record!.state !== 'pending') {
      throw new AgentPrivilegeError(
        record!.state === 'consumed' ? 'confirmation_replayed' : 'confirmation_invalid',
        'This confirmation has already been resolved.',
      );
    }

    if (input.decision === 'deny') {
      record!.state = 'denied';
      this.log(input.toolName, 'deny', 'user_denied');
      return;
    }

    record!.state = 'approved';
    if (input.decision === 'allow-remember' && classifyTool(input.toolName) === 'write') {
      session.sessionAllowlist.add(input.toolName as AgentToolName);
    }
    this.log(input.toolName, 'allow', input.decision === 'allow-remember' ? 'user_allowed_session' : 'user_allowed_once');
  }

  authorizeExecution(input: {
    sessionId: string;
    toolCallId: string;
    toolName: string;
    args: unknown;
    requestRestriction?: PrivilegeRequestRestriction;
    identityKey?: string;
  }): void {
    const decision = this.decisionFor(
      input.sessionId,
      input.toolName,
      input.requestRestriction,
      input.identityKey,
    );
    if (decision === 'denied') {
      this.log(input.toolName, 'deny', classifyTool(input.toolName) ? 'policy_denied' : 'unclassified_tool');
      throw new AgentPrivilegeError(
        'operation_denied',
        `Operation "${input.toolName}" is not allowed by the active agent privilege policy.`,
      );
    }
    if (decision === 'allowed') {
      this.log(input.toolName, 'allow', 'policy_allowed');
      return;
    }

    const session = this.getSession(input.sessionId, input.identityKey);
    this.pruneExpired(session);
    const record = session.confirmations.get(input.toolCallId);
    this.assertMatchingConfirmation(record, input.toolName, input.args);
    if (record!.state !== 'approved') {
      throw new AgentPrivilegeError(
        record!.state === 'consumed' ? 'confirmation_replayed' : 'confirmation_required',
        `Operation "${input.toolName}" requires a new user confirmation.`,
      );
    }
    record!.state = 'consumed';
    this.log(input.toolName, 'allow', 'confirmation_consumed');
  }

  noteConfirmationRequired(toolName: string): void {
    this.log(toolName, 'confirm', 'policy_confirmation_required');
  }

  resetForTests(): void {
    this.sessions.clear();
  }

  private getSession(
    sessionId: string,
    identityKey = 'anonymous_local:public',
  ): PrivilegeSession {
    let session = this.sessions.get(sessionId);
    if (session && session.identityKey !== identityKey) {
      throw new AgentPrivilegeError(
        'session_context_mismatch',
        'This privilege session belongs to another authenticated context.',
      );
    }
    if (!session) {
      session = {
        identityKey,
        settings: { ...DEFAULT_PRIVILEGE_SETTINGS, overrides: {} },
        clientRevision: -1,
        sessionAllowlist: new Set(),
        confirmations: new Map(),
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  private assertMatchingConfirmation(
    record: ConfirmationRecord | undefined,
    toolName: string,
    args: unknown,
  ): void {
    if (!record || record.toolName !== toolName || record.argumentsDigest !== digestToolArguments(args)) {
      throw new AgentPrivilegeError(
        'confirmation_invalid',
        'Confirmation does not match this tool call and its arguments.',
      );
    }
  }

  private pruneExpired(session: PrivilegeSession): void {
    const now = this.now();
    for (const [toolCallId, confirmation] of session.confirmations) {
      if (confirmation.expiresAt <= now) session.confirmations.delete(toolCallId);
    }
  }

  private log(toolName: string, outcome: PrivilegeAuditEvent['outcome'], reason: string): void {
    this.audit({
      outcome,
      toolName,
      privilege: classifyTool(toolName),
      reason,
    });
  }
}

interface PrivilegedToolContext {
  sessionId: string;
  identityKey?: string;
  requestRestriction?: PrivilegeRequestRestriction;
}

interface ExecutableTool {
  execute?: (input: unknown, options: ToolExecutionOptions) => unknown;
  needsApproval?: (
    input: unknown,
    options: Pick<ToolExecutionOptions, 'toolCallId'>,
  ) => boolean | PromiseLike<boolean>;
  [key: string]: unknown;
}

interface ToolExecutionOptions {
  toolCallId: string;
  [key: string]: unknown;
}

export function createPrivilegedTools<T extends ToolSet>(
  tools: T,
  store: AgentPrivilegeStore,
  context: PrivilegedToolContext,
): T {
  return Object.fromEntries(
    Object.entries(tools).map(([toolName, definition]) => {
      const source = definition as ExecutableTool;
      if (!classifyTool(toolName) || typeof source.execute !== 'function') {
        throw new AgentPrivilegeError(
          'operation_denied',
          `Tool "${toolName}" is not completely classified and executable.`,
        );
      }
      return [toolName, {
        ...source,
        needsApproval: (args: unknown, options: Pick<ToolExecutionOptions, 'toolCallId'>) => {
          const decision = store.decisionFor(
            context.sessionId,
            toolName,
            context.requestRestriction,
            context.identityKey,
          );
          if (decision !== 'confirm') return false;
          store.registerConfirmation(
            context.sessionId,
            options.toolCallId,
            toolName,
            args,
            context.identityKey,
          );
          store.noteConfirmationRequired(toolName);
          return true;
        },
        execute: async (args: unknown, options: ToolExecutionOptions) => {
          store.authorizeExecution({
            sessionId: context.sessionId,
            toolCallId: options.toolCallId,
            toolName,
            args,
            requestRestriction: context.requestRestriction,
            identityKey: context.identityKey,
          });
          return source.execute!(args, options);
        },
      }];
    }),
  ) as unknown as T;
}

export function assertCompleteToolClassification(tools: ToolSet): void {
  const registered = Object.keys(tools).sort();
  const classified = Object.keys(AGENT_TOOL_PRIVILEGES).sort();
  if (registered.length !== classified.length || registered.some((name, index) => name !== classified[index])) {
    throw new AgentPrivilegeError(
      'operation_denied',
      'Agent tool registry and privilege classification are inconsistent.',
    );
  }
}
