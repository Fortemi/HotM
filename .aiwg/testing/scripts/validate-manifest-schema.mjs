import { readFileSync } from 'node:fs';

const schema = JSON.parse(readFileSync(new URL('../../architecture/manifest-schema-v1.json', import.meta.url), 'utf8'));
const example = {
  manifest_version: 1,
  schema_revision: '2026-05-17',
  service: { status: 'operational', message: null, cache_ttl_seconds: 300 },
  client_version: { minimum_supported: '1.0.0', recommended: '1.0.0', update_url_ios: 'https://apps.apple.com/app/idXXXXXXXXX', update_url_android: 'https://play.google.com/store/apps/details?id=io.fortemi.hotm' },
  api: { base_url: 'https://api.hotm.fortemi.io', websocket_url: 'wss://api.hotm.fortemi.io/v1/ws' },
  auth: { provider: 'clerk', issuer_url: 'https://hotm.clerk.accounts.dev', client_id: 'public_clerk_app_id', scopes: ['openid', 'email', 'profile'], redirect_uri: 'hotm://auth/callback' },
  models: {
    default_generation: 'claude-sonnet-4-7',
    default_embedding: 'voyage-3-large',
    available_providers: [
      { id: 'anthropic', name: 'Anthropic Claude', key_format: 'sk-ant-...' },
      { id: 'openai', name: 'OpenAI', key_format: 'sk-...' },
      { id: 'openrouter', name: 'OpenRouter', key_format: 'sk-or-...' },
      { id: 'ollama', name: 'Self-hosted Ollama (advanced)', key_format: null },
    ],
    available_generation_models: [
      { provider: 'anthropic', model: 'claude-sonnet-4-7', label: 'Claude Sonnet 4.7' },
      { provider: 'anthropic', model: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
      { provider: 'openai', model: 'gpt-5', label: 'GPT-5' },
    ],
    available_embedding_models: [{ provider: 'voyage', model: 'voyage-3-large' }],
  },
  features: { media_upload: true, spatial_search: true, voice_capture: false, agent_actions: false, experimental_panel: false },
  tiers: { current_tier: 'free', limits: { max_notes: 5000, max_storage_bytes: 1073741824, max_inference_requests_per_day: 100 } },
  branding: { primary_color: '#1a1a1a', logo_url: null, app_name_override: null },
  telemetry: { enabled_by_default: false, endpoint: 'https://telemetry.hotm.fortemi.io/v1/events' },
  links: { support_url: 'https://docs.fortemi.io/hotm/support', privacy_policy_url: 'https://hotm.fortemi.io/privacy', terms_url: 'https://hotm.fortemi.io/terms' },
};

const errors = [];
function typeOf(value) { if (value === null) return 'null'; if (Array.isArray(value)) return 'array'; if (Number.isInteger(value)) return 'integer'; return typeof value; }
function add(path, message) { errors.push(path + ': ' + message); }
function validate(schemaNode, value, path = '$') {
  if (schemaNode.const !== undefined && value !== schemaNode.const) add(path, 'expected const ' + schemaNode.const);
  if (schemaNode.type) {
    const allowed = Array.isArray(schemaNode.type) ? schemaNode.type : [schemaNode.type];
    const actual = typeOf(value);
    if (!allowed.includes(actual) && !(actual === 'integer' && allowed.includes('number'))) { add(path, 'expected type ' + allowed.join('|') + ', got ' + actual); return; }
  }
  if (schemaNode.enum && !schemaNode.enum.includes(value)) add(path, 'expected one of ' + schemaNode.enum.join(', '));
  if (schemaNode.pattern && typeof value === 'string' && !(new RegExp(schemaNode.pattern).test(value))) add(path, 'did not match pattern ' + schemaNode.pattern);
  if (schemaNode.minimum !== undefined && typeof value === 'number' && value < schemaNode.minimum) add(path, 'below minimum ' + schemaNode.minimum);
  if (schemaNode.maximum !== undefined && typeof value === 'number' && value > schemaNode.maximum) add(path, 'above maximum ' + schemaNode.maximum);
  if (schemaNode.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schemaNode.required ?? []) { if (!(key in value)) add(path + '.' + key, 'missing required field'); }
    if (schemaNode.additionalProperties === false) { for (const key of Object.keys(value)) { if (!schemaNode.properties?.[key]) add(path + '.' + key, 'unexpected field'); } }
    for (const [key, childSchema] of Object.entries(schemaNode.properties ?? {})) { if (key in value) validate(childSchema, value[key], path + '.' + key); }
    if (schemaNode.additionalProperties && typeof schemaNode.additionalProperties === 'object') { for (const [key, childValue] of Object.entries(value)) { if (!schemaNode.properties?.[key]) validate(schemaNode.additionalProperties, childValue, path + '.' + key); } }
  }
  if (schemaNode.type === 'array' && Array.isArray(value)) {
    if (schemaNode.minItems !== undefined && value.length < schemaNode.minItems) add(path, 'below minItems ' + schemaNode.minItems);
    value.forEach((item, index) => validate(schemaNode.items, item, path + '[' + index + ']'));
  }
}
validate(schema, example);
if (errors.length > 0) { console.error(errors.join('\n')); process.exit(1); }
console.log('manifest schema example validation passed');
