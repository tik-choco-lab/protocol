// Canonical dependency-free v1 reference; see docs/llm-config.md.
// New writers preserve legacy preset/network fields unchanged for old readers.
// Task refs, reasoning effort, and room sharing are app-local.
// Regenerate vendored copies with protocol/scripts/sync-vendored.mjs.
export const LLM_CONFIG_KEY = "tc-shared-llm-config-v1";
export const LLM_CONFIG_VERSION = 1;
export const NETWORK_PROVIDER_URL_PREFIX = "mist-network://";
export const NETWORK_VOICE_AUTO_MODEL = "network-auto";

/** 接続情報のみ = 「どこに繋ぐか」 */
export type LlmProviderV1 = {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  enabled?: boolean;
  models?: string[];
  modelsFetchedAt?: string;
};

/** Deprecated migration input. New writers never edit/create presets. */
export type ModelPresetV1 = {
  id: string;
  label: string;
  providerId: string;
  model: string;
  temperature?: number;
  reasoningEffort?: string;
};

/** TTS/STT。providerId 省略時は defaultModel の provider を使用 */
export type VoiceConfigV1 = {
  providerId?: string;
  model: string;
  voice?: string;
  speed?: number;
};

export type ModelRefV1 = { providerId: string; model: string };
export type ModelRef = ModelRefV1;

export type SharedLlmConfigV1 = {
  defaultModel?: ModelRefV1;
  v: 1;
  providers: LlmProviderV1[];
  presets: ModelPresetV1[];
  /** Deprecated; preserve unchanged for old readers. */
  defaultPresetId: string;
  tts?: VoiceConfigV1;
  stt?: VoiceConfigV1;
  /** Deprecated; preserve unchanged. Rooms now live in providers. */
  network: { roomId: string };
  /** ISO 8601、LWW(last-write-wins)用 */
  updatedAt: string;
};

export type ResolvedLlmTargetV1 = ModelRefV1 & {
  label: string;
  baseUrl: string;
  apiKey: string;
};

export function isModelRef(value: unknown): value is ModelRefV1 {
  if (!value || typeof value !== 'object') return false;
  const ref = value as ModelRefV1;
  return typeof ref.providerId === 'string' && typeof ref.model === 'string';
}

function isLlmProviderV1(value: unknown): value is LlmProviderV1 {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    typeof record.baseUrl === "string" &&
    typeof record.apiKey === "string" &&
    (record.enabled === undefined || typeof record.enabled === "boolean") &&
    (record.models === undefined || (Array.isArray(record.models) && record.models.every(m => typeof m === "string"))) &&
    (record.modelsFetchedAt === undefined || typeof record.modelsFetchedAt === "string")
  );
}

function isModelPresetV1(value: unknown): value is ModelPresetV1 {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    typeof record.providerId === "string" &&
    typeof record.model === "string" &&
    (record.temperature === undefined || typeof record.temperature === "number") &&
    (record.reasoningEffort === undefined || typeof record.reasoningEffort === "string")
  );
}

function isVoiceConfigV1(value: unknown): value is VoiceConfigV1 {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (record.providerId === undefined || typeof record.providerId === "string") &&
    typeof record.model === "string" &&
    (record.voice === undefined || typeof record.voice === "string") &&
    (record.speed === undefined || typeof record.speed === "number")
  );
}

/**
 * Field-by-field defensive parse of a raw `SharedLlmConfigV1` value. Returns
 * null if a required top-level field is missing/malformed or `v` isn't 1.
 * Malformed entries inside `providers`/`presets` are dropped individually
 * rather than invalidating the whole record; a malformed optional `tts`/`stt`
 * is dropped the same way.
 */
function sanitizeLlmConfig(value: unknown): SharedLlmConfigV1 | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (record.v !== 1) return null;
  if (!Array.isArray(record.providers)) return null;
  if (!Array.isArray(record.presets)) return null;
  if (typeof record.defaultPresetId !== "string") return null;
  if (record.network === null || typeof record.network !== "object") return null;
  const network = record.network as Record<string, unknown>;
  if (typeof network.roomId !== "string") return null;
  if (typeof record.updatedAt !== "string") return null;

  const config: SharedLlmConfigV1 = {
    v: 1,
    providers: record.providers.filter(isLlmProviderV1),
    presets: record.presets.filter(isModelPresetV1),
    defaultPresetId: record.defaultPresetId,
    network: network as { roomId: string },
    updatedAt: record.updatedAt,
  };

  if (record.tts !== undefined && isVoiceConfigV1(record.tts)) config.tts = record.tts;
  if (record.stt !== undefined && isVoiceConfigV1(record.stt)) config.stt = record.stt;

  if (isModelRef(record.defaultModel)) config.defaultModel = record.defaultModel;
  return config;
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the Math.random fallback below
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Returns a fresh, empty `SharedLlmConfigV1` (not persisted). */
export function emptyLlmConfig(): SharedLlmConfigV1 {
  return {
    v: 1,
    providers: [],
    presets: [],
    defaultPresetId: "",
    network: { roomId: "" },
    updatedAt: "",
  };
}

/**
 * Reads and validates `tc-shared-llm-config-v1`. Returns null if the key is
 * missing, the JSON is malformed, or the shape doesn't match
 * `SharedLlmConfigV1` (never throws). See `sanitizeLlmConfig` for how
 * malformed array entries are handled.
 */
export function loadLlmConfig(): SharedLlmConfigV1 | null {
  try {
    const raw = localStorage.getItem(LLM_CONFIG_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return sanitizeLlmConfig(parsed);
  } catch {
    return null;
  }
}

/**
 * Persists `config` to `tc-shared-llm-config-v1`, stamping `config.updatedAt`
 * with the current time (mutates the passed object). Never throws: storage
 * failures (quota, disabled storage, etc.) are swallowed after a
 * console.warn.
 */
export function saveLlmConfig(config: SharedLlmConfigV1): void {
  config.updatedAt = new Date().toISOString();
  try {
    // presets/defaultPresetId/network are written back unchanged: unmigrated
    // apps on the same origin still require them to accept the record at all.
    localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn("tc-shared-llm-config: failed to persist config", error);
  }
}

/**
 * Subscribes to cross-tab/cross-app updates of `tc-shared-llm-config-v1` via
 * the `storage` window event (same-origin only, and only fires for tabs
 * other than the writer). Calls `cb` with the freshly loaded config (or null)
 * whenever the key changes. Returns an unsubscribe function.
 */
export function subscribeLlmConfig(cb: (config: SharedLlmConfigV1 | null) => void): () => void {
  function onStorageEvent(event: StorageEvent) {
    if (event.key !== LLM_CONFIG_KEY) return;
    cb(loadLlmConfig());
  }

  window.addEventListener("storage", onStorageEvent);
  return () => window.removeEventListener("storage", onStorageEvent);
}

/** Trims whitespace and strips trailing slashes, so equivalent endpoints compare equal. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Finds-or-creates a provider by (normalized baseUrl, apiKey) pair. Mutates
 * `config.providers` in place (push-only, never overwrites an existing
 * entry) and returns the provider's id; the caller is responsible for
 * calling `saveLlmConfig` afterwards.
 */
export function ensureProvider(
  config: SharedLlmConfigV1,
  input: { label?: string; baseUrl: string; apiKey: string },
): string {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const existing = config.providers.find((p) => normalizeBaseUrl(p.baseUrl) === baseUrl && p.apiKey === input.apiKey);
  if (existing) return existing.id;

  const id = newId();
  config.providers.push({ id, label: input.label || baseUrl, baseUrl, apiKey: input.apiKey });
  return id;
}

/** Resolve exactly, without default fallback (used for the share list). Cache membership is not required. */
export function resolveModelExact(config: SharedLlmConfigV1, ref?: ModelRefV1): ResolvedLlmTargetV1 | null {
  if (!ref?.model.trim()) return null;
  const provider = config.providers.find(p => p.id === ref.providerId);
  if (!provider || provider.enabled === false || !provider.baseUrl.trim()) return null;
  return { ...ref, label: provider.label, baseUrl: provider.baseUrl, apiKey: provider.apiKey };
}

/** A missing task ref follows the default; an unusable ref may use only that default. */
export function resolveModel(config: SharedLlmConfigV1, ref?: ModelRefV1): ResolvedLlmTargetV1 | null {
  return resolveModelExact(config, ref ?? config.defaultModel) ?? resolveModelExact(config, config.defaultModel);
}

export function resolveVoice(config: SharedLlmConfigV1, kind: 'tts' | 'stt'): (ResolvedLlmTargetV1 & { voice?: string; speed?: number }) | null {
  const voice = config[kind];
  if (!voice?.model) return null;
  const ref = { providerId: voice.providerId ?? config.defaultModel?.providerId ?? '', model: voice.model };
  const target = resolveModel(config, ref);
  if (!target) return null;
  return { ...target, ...(voice.voice !== undefined ? { voice: voice.voice } : {}), ...(voice.speed !== undefined ? { speed: voice.speed } : {}) };
}

export function isNetworkProviderBaseUrl(baseUrl: string): boolean {
  return baseUrl.trim().startsWith(NETWORK_PROVIDER_URL_PREFIX);
}

export function networkProviderBaseUrl(roomId: string): string {
  return `${NETWORK_PROVIDER_URL_PREFIX}${roomId.trim() || 'default'}`;
}

export function roomIdFromBaseUrl(baseUrl: string): string {
  return isNetworkProviderBaseUrl(baseUrl) ? baseUrl.trim().slice(NETWORK_PROVIDER_URL_PREFIX.length) : '';
}

export function providerKind(provider: LlmProviderV1): 'http' | 'room' {
  return isNetworkProviderBaseUrl(provider.baseUrl) ? 'room' : 'http';
}

/** Apply only to Room voice requests; the sentinel is never sent on the wire. */
export function networkVoiceModelParam(model: string): string | undefined {
  const trimmed = model.trim();
  return !trimmed || trimmed === NETWORK_VOICE_AUTO_MODEL ? undefined : trimmed;
}

/** CRUD helpers mutate config; the caller decides when to save. */
export function createProvider(config: SharedLlmConfigV1, label: string): string {
  const id = newId();
  config.providers.push({ id, label, baseUrl: '', apiKey: '', enabled: true, models: [] });
  return id;
}

export function createRoomProvider(
  config: SharedLlmConfigV1,
  input: { roomId: string; label?: string },
): { id: string; existed: boolean } {
  const baseUrl = networkProviderBaseUrl(input.roomId);
  const existing = config.providers.find(p => normalizeBaseUrl(p.baseUrl) === baseUrl);
  if (existing) return { id: existing.id, existed: true };
  const id = newId();
  config.providers.push({ id, label: input.label || roomIdFromBaseUrl(baseUrl), baseUrl, apiKey: '', enabled: true, models: [] });
  return { id, existed: false };
}

export function patchProvider(config: SharedLlmConfigV1, id: string, patch: Partial<Omit<LlmProviderV1, 'id'>>): void {
  const provider = config.providers.find(p => p.id === id);
  if (provider) Object.assign(provider, patch);
}

export function deleteProvider(config: SharedLlmConfigV1, id: string): void {
  config.providers = config.providers.filter(p => p.id !== id);
}

export function setDefaultModel(config: SharedLlmConfigV1, ref?: ModelRefV1): void {
  if (ref) config.defaultModel = { ...ref };
  else delete config.defaultModel;
}

export function setVoiceConfig(config: SharedLlmConfigV1, kind: 'tts' | 'stt', next?: VoiceConfigV1): void {
  if (next) config[kind] = { ...next };
  else delete config[kind];
}

/** Migration lookup only, including old Room refs; no enabled-provider requirement. */
export function presetIdToRef(config: SharedLlmConfigV1, presetId: string): ModelRefV1 | undefined {
  const preset = config.presets.find(p => p.id === presetId);
  return preset ? { providerId: preset.providerId, model: preset.model } : undefined;
}

/** Idempotent migration; no save/network side effects. Legacy fields are untouched. */
export function migrateSharedLlmConfig(config: SharedLlmConfigV1): { changed: boolean } {
  let changed = false;
  if (!config.defaultModel) {
    const ref = presetIdToRef(config, config.defaultPresetId);
    if (ref) { config.defaultModel = ref; changed = true; }
  }
  const roomId = config.network.roomId.trim();
  if (roomId && !createRoomProvider(config, { roomId }).existed) changed = true;
  for (const preset of config.presets) {
    const provider = config.providers.find(p => p.id === preset.providerId);
    if (!provider || providerKind(provider) === 'room' || !preset.model.trim()) continue;
    if ((provider.models ?? []).includes(preset.model)) continue;
    provider.models = [...(provider.models ?? []), preset.model];
    changed = true;
  }
  return { changed };
}
