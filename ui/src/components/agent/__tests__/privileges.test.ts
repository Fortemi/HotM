import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  canExecute,
  resolveFromMode,
  getToolPrivilege,
  getPrivilegeModeLabel,
  getPrivilegeModeDescription,
  loadPrivilegeSettings,
  savePrivilegeSettings,
  TOOL_PRIVILEGES,
  DEFAULT_PRIVILEGE_SETTINGS,
  type AgentPrivilegeSettings,
} from '../privileges';

describe('privileges', () => {
  describe('TOOL_PRIVILEGES', () => {
    it('classifies all read tools as read', () => {
      expect(TOOL_PRIVILEGES.search_notes).toBe('read');
      expect(TOOL_PRIVILEGES.get_note).toBe('read');
      expect(TOOL_PRIVILEGES.list_collections).toBe('read');
      expect(TOOL_PRIVILEGES.get_related).toBe('read');
      expect(TOOL_PRIVILEGES.search_concepts).toBe('read');
      expect(TOOL_PRIVILEGES.list_archives).toBe('read');
      expect(TOOL_PRIVILEGES.list_notes).toBe('read');
      expect(TOOL_PRIVILEGES.get_attachments).toBe('read');
    });

    it('classifies write tools as write', () => {
      expect(TOOL_PRIVILEGES.create_note).toBe('write');
      expect(TOOL_PRIVILEGES.revise_note).toBe('write');
      expect(TOOL_PRIVILEGES.update_tags).toBe('write');
    });

    it('matches the complete currently implemented proxy registry', () => {
      expect(Object.keys(TOOL_PRIVILEGES)).toHaveLength(11);
    });
  });

  describe('getToolPrivilege', () => {
    it('returns correct privilege for known tools', () => {
      expect(getToolPrivilege('search_notes')).toBe('read');
      expect(getToolPrivilege('create_note')).toBe('write');
    });

    it('does not classify unknown tools', () => {
      expect(getToolPrivilege('unknown_tool')).toBeUndefined();
    });
  });

  describe('resolveFromMode', () => {
    it('full mode: allows read/write and confirms delete/admin', () => {
      expect(resolveFromMode('read', 'full')).toBe('allowed');
      expect(resolveFromMode('write', 'full')).toBe('allowed');
      expect(resolveFromMode('delete', 'full')).toBe('confirm');
      expect(resolveFromMode('admin', 'full')).toBe('confirm');
    });

    it('assisted mode: allows read, confirms write/delete/admin', () => {
      expect(resolveFromMode('read', 'assisted')).toBe('allowed');
      expect(resolveFromMode('write', 'assisted')).toBe('confirm');
      expect(resolveFromMode('delete', 'assisted')).toBe('confirm');
      expect(resolveFromMode('admin', 'assisted')).toBe('confirm');
    });

    it('read-only mode: allows read, denies everything else', () => {
      expect(resolveFromMode('read', 'read-only')).toBe('allowed');
      expect(resolveFromMode('write', 'read-only')).toBe('denied');
      expect(resolveFromMode('delete', 'read-only')).toBe('denied');
      expect(resolveFromMode('admin', 'read-only')).toBe('denied');
    });
  });

  describe('canExecute', () => {
    const baseSettings: AgentPrivilegeSettings = {
      ...DEFAULT_PRIVILEGE_SETTINGS,
      mode: 'assisted',
    };

    it('uses mode-based resolution by default', () => {
      expect(canExecute('search_notes', baseSettings)).toBe('allowed');
      expect(canExecute('create_note', baseSettings)).toBe('confirm');
    });

    it('respects per-tool overrides over mode', () => {
      const settings: AgentPrivilegeSettings = {
        ...baseSettings,
        overrides: { create_note: 'allowed' },
      };
      expect(canExecute('create_note', settings)).toBe('allowed');
    });

    it('respects session allowlist', () => {
      const settings: AgentPrivilegeSettings = {
        ...baseSettings,
        sessionAllowlist: ['create_note'],
      };
      expect(canExecute('create_note', settings)).toBe('allowed');
    });

    it('overrides take precedence over session allowlist', () => {
      const settings: AgentPrivilegeSettings = {
        ...baseSettings,
        overrides: { create_note: 'denied' },
        sessionAllowlist: ['create_note'],
      };
      // Override wins
      expect(canExecute('create_note', settings)).toBe('denied');
    });

    it('denies unknown tools', () => {
      expect(canExecute('some_future_tool', baseSettings)).toBe('denied');
    });

    it('read-only mode denies all mutations', () => {
      const settings: AgentPrivilegeSettings = {
        ...baseSettings,
        mode: 'read-only',
      };
      expect(canExecute('search_notes', settings)).toBe('allowed');
      expect(canExecute('create_note', settings)).toBe('denied');
      expect(canExecute('future_mutation', settings)).toBe('denied');
    });

    it('full mode allows every currently implemented tool', () => {
      const settings: AgentPrivilegeSettings = {
        ...baseSettings,
        mode: 'full',
      };
      expect(canExecute('search_notes', settings)).toBe('allowed');
      expect(canExecute('create_note', settings)).toBe('allowed');
      expect(canExecute('list_archives', settings)).toBe('allowed');
    });
  });

  describe('getPrivilegeModeLabel', () => {
    it('returns human-readable labels', () => {
      expect(getPrivilegeModeLabel('full')).toBe('Full Access');
      expect(getPrivilegeModeLabel('assisted')).toBe('Assisted');
      expect(getPrivilegeModeLabel('read-only')).toBe('Read Only');
    });
  });

  describe('getPrivilegeModeDescription', () => {
    it('returns descriptions for each mode', () => {
      expect(getPrivilegeModeDescription('full')).toContain('all operations');
      expect(getPrivilegeModeDescription('assisted')).toContain('confirmation');
      expect(getPrivilegeModeDescription('read-only')).toContain('search');
    });
  });

  describe('persistence', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns defaults when nothing saved', () => {
      const settings = loadPrivilegeSettings();
      expect(settings.mode).toBe('assisted');
      expect(settings.overrides).toEqual({});
      expect(settings.sessionAllowlist).toEqual([]);
    });

    it('round-trips mode and overrides', () => {
      const settings: AgentPrivilegeSettings = {
        mode: 'full',
        overrides: { create_note: 'denied' },
        sessionAllowlist: ['update_tags'],
      };
      savePrivilegeSettings(settings);
      const loaded = loadPrivilegeSettings();
      expect(loaded.mode).toBe('full');
      expect(loaded.overrides).toEqual({ create_note: 'denied' });
      // Session allowlist is NOT persisted
      expect(loaded.sessionAllowlist).toEqual([]);
    });

    it('returns defaults for corrupt data', () => {
      localStorage.setItem('hotm:agent-privileges', 'not json');
      const settings = loadPrivilegeSettings();
      expect(settings.mode).toBe('assisted');
    });

    it('returns defaults for invalid mode', () => {
      localStorage.setItem('hotm:agent-privileges', JSON.stringify({ mode: 'super' }));
      const settings = loadPrivilegeSettings();
      expect(settings.mode).toBe('assisted');
    });

    it('drops unknown or invalid persisted overrides', () => {
      localStorage.setItem('hotm:agent-privileges', JSON.stringify({
        mode: 'full',
        overrides: { create_note: 'denied', unknown_tool: 'allowed', get_note: 'maybe' },
      }));
      expect(loadPrivilegeSettings().overrides).toEqual({ create_note: 'denied' });
    });

    it('handles localStorage write errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      expect(() => savePrivilegeSettings(DEFAULT_PRIVILEGE_SETTINGS)).not.toThrow();
      vi.restoreAllMocks();
    });
  });
});
