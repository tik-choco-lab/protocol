// Canonical dependency-free v1 reference; see docs/llm-config.md.
// New writers preserve legacy preset/network fields unchanged for old readers.
// Task refs, reasoning effort, and room sharing are app-local.
// Regenerate vendored copies with protocol/scripts/sync-vendored.mjs.
/**
 * @typedef {object} LlmProviderV1
 * @property {string} id
 * @property {string} label
 * @property {string} baseUrl HTTP URL or mist-network://<roomId>.
 * @property {string} apiKey Empty for a Room.
 * @property {boolean} [enabled] Absent means true.
 * @property {string[]} [models] Cached raw model ids.
 * @property {string} [modelsFetchedAt] ISO 8601 successful-fetch time.
 */
/**
 * @typedef {object} ModelRefV1
 * @property {string} providerId
 * @property {string} model
 */
/** @typedef {ModelRefV1} ModelRef */
/**
 * @typedef {object} ModelPresetV1 Deprecated migration input; preserve unchanged.
 * @property {string} id
 * @property {string} label
 * @property {string} providerId
 * @property {string} model
 * @property {number} [temperature] Legacy only; never sent.
 * @property {string} [reasoningEffort] Migrated to app-local task settings.
 */
/**
 * @typedef {object} VoiceConfigV1
 * @property {string} [providerId] Omitted means the defaultModel provider.
 * @property {string} model Room auto-selection uses network-auto.
 * @property {string} [voice]
 * @property {number} [speed]
 */
/**
 * @typedef {object} SharedLlmConfigV1
 * @property {1} v
 * @property {LlmProviderV1[]} providers
 * @property {ModelRefV1} [defaultModel]
 * @property {ModelPresetV1[]} presets Deprecated; preserve unchanged.
 * @property {string} defaultPresetId Deprecated; preserve unchanged.
 * @property {VoiceConfigV1} [tts]
 * @property {VoiceConfigV1} [stt]
 * @property {{roomId: string}} network Deprecated; preserve unchanged.
 * @property {string} updatedAt ISO 8601, last-write-wins.
 */
/**
 * @typedef {object} ResolvedLlmTargetV1
 * @property {string} providerId
 * @property {string} model
 * @property {string} label Provider label.
 * @property {string} baseUrl
 * @property {string} apiKey
 */
export const LLM_CONFIG_KEY = "tc-shared-llm-config-v1";
export const LLM_CONFIG_VERSION = 1;
export const NETWORK_PROVIDER_URL_PREFIX = "mist-network://";
export const NETWORK_VOICE_AUTO_MODEL = "network-auto";
export function isModelRef(value) {
    if (!value || typeof value !== 'object')
        return false;
    const ref = value;
    return typeof ref.providerId === 'string' && typeof ref.model === 'string';
}
function isLlmProviderV1(value) {
    if (value === null || typeof value !== "object")
        return false;
    const record = value;
    return (typeof record.id === "string" &&
        typeof record.label === "string" &&
        typeof record.baseUrl === "string" &&
        typeof record.apiKey === "string" &&
        (record.enabled === undefined || typeof record.enabled === "boolean") &&
        (record.models === undefined || (Array.isArray(record.models) && record.models.every(m => typeof m === "string"))) &&
        (record.modelsFetchedAt === undefined || typeof record.modelsFetchedAt === "string"));
}
function isModelPresetV1(value) {
    if (value === null || typeof value !== "object")
        return false;
    const record = value;
    return (typeof record.id === "string" &&
        typeof record.label === "string" &&
        typeof record.providerId === "string" &&
        typeof record.model === "string" &&
        (record.temperature === undefined || typeof record.temperature === "number") &&
        (record.reasoningEffort === undefined || typeof record.reasoningEffort === "string"));
}
function isVoiceConfigV1(value) {
    if (value === null || typeof value !== "object")
        return false;
    const record = value;
    return ((record.providerId === undefined || typeof record.providerId === "string") &&
        typeof record.model === "string" &&
        (record.voice === undefined || typeof record.voice === "string") &&
        (record.speed === undefined || typeof record.speed === "number"));
}
/**
 * Field-by-field defensive parse of a raw `SharedLlmConfigV1` value. Returns
 * null if a required top-level field is missing/malformed or `v` isn't 1.
 * Malformed entries inside `providers`/`presets` are dropped individually
 * rather than invalidating the whole record; a malformed optional `tts`/`stt`
 * is dropped the same way.
 */
function sanitizeLlmConfig(value) {
    if (value === null || typeof value !== "object")
        return null;
    const record = value;
    if (record.v !== 1)
        return null;
    if (!Array.isArray(record.providers))
        return null;
    if (!Array.isArray(record.presets))
        return null;
    if (typeof record.defaultPresetId !== "string")
        return null;
    if (record.network === null || typeof record.network !== "object")
        return null;
    const network = record.network;
    if (typeof network.roomId !== "string")
        return null;
    if (typeof record.updatedAt !== "string")
        return null;
    const config = {
        v: 1,
        providers: record.providers.filter(isLlmProviderV1),
        presets: record.presets.filter(isModelPresetV1),
        defaultPresetId: record.defaultPresetId,
        network: network,
        updatedAt: record.updatedAt,
    };
    if (record.tts !== undefined && isVoiceConfigV1(record.tts))
        config.tts = record.tts;
    if (record.stt !== undefined && isVoiceConfigV1(record.stt))
        config.stt = record.stt;
    if (isModelRef(record.defaultModel))
        config.defaultModel = record.defaultModel;
    return config;
}
function newId() {
    try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
    }
    catch {
        // fall through to the Math.random fallback below
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
/** Returns a fresh, empty `SharedLlmConfigV1` (not persisted). */
export function emptyLlmConfig() {
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
export function loadLlmConfig() {
    try {
        const raw = localStorage.getItem(LLM_CONFIG_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        return sanitizeLlmConfig(parsed);
    }
    catch {
        return null;
    }
}
/**
 * Persists `config` to `tc-shared-llm-config-v1`, stamping `config.updatedAt`
 * with the current time (mutates the passed object). Never throws: storage
 * failures (quota, disabled storage, etc.) are swallowed after a
 * console.warn.
 */
export function saveLlmConfig(config) {
    config.updatedAt = new Date().toISOString();
    try {
        // presets/defaultPresetId/network are written back unchanged: unmigrated
        // apps on the same origin still require them to accept the record at all.
        localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
    }
    catch (error) {
        console.warn("tc-shared-llm-config: failed to persist config", error);
    }
}
/**
 * Subscribes to cross-tab/cross-app updates of `tc-shared-llm-config-v1` via
 * the `storage` window event (same-origin only, and only fires for tabs
 * other than the writer). Calls `cb` with the freshly loaded config (or null)
 * whenever the key changes. Returns an unsubscribe function.
 */
export function subscribeLlmConfig(cb) {
    function onStorageEvent(event) {
        if (event.key !== LLM_CONFIG_KEY)
            return;
        cb(loadLlmConfig());
    }
    window.addEventListener("storage", onStorageEvent);
    return () => window.removeEventListener("storage", onStorageEvent);
}
/** Trims whitespace and strips trailing slashes, so equivalent endpoints compare equal. */
export function normalizeBaseUrl(url) {
    return url.trim().replace(/\/+$/, "");
}
/**
 * Finds-or-creates a provider by (normalized baseUrl, apiKey) pair. Mutates
 * `config.providers` in place (push-only, never overwrites an existing
 * entry) and returns the provider's id; the caller is responsible for
 * calling `saveLlmConfig` afterwards.
 */
export function ensureProvider(config, input) {
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const existing = config.providers.find((p) => normalizeBaseUrl(p.baseUrl) === baseUrl && p.apiKey === input.apiKey);
    if (existing)
        return existing.id;
    const id = newId();
    config.providers.push({ id, label: input.label || baseUrl, baseUrl, apiKey: input.apiKey });
    return id;
}
/** Resolve exactly, without default fallback (used for the share list). Cache membership is not required. */
export function resolveModelExact(config, ref) {
    if (!ref?.model.trim())
        return null;
    const provider = config.providers.find(p => p.id === ref.providerId);
    if (!provider || provider.enabled === false || !provider.baseUrl.trim())
        return null;
    return { ...ref, label: provider.label, baseUrl: provider.baseUrl, apiKey: provider.apiKey };
}
/** A missing task ref follows the default; an unusable ref may use only that default. */
export function resolveModel(config, ref) {
    return resolveModelExact(config, ref ?? config.defaultModel) ?? resolveModelExact(config, config.defaultModel);
}
export function resolveVoice(config, kind) {
    const voice = config[kind];
    if (!voice?.model)
        return null;
    const ref = { providerId: voice.providerId ?? config.defaultModel?.providerId ?? '', model: voice.model };
    const target = resolveModel(config, ref);
    if (!target)
        return null;
    return { ...target, ...(voice.voice !== undefined ? { voice: voice.voice } : {}), ...(voice.speed !== undefined ? { speed: voice.speed } : {}) };
}
export function isNetworkProviderBaseUrl(baseUrl) {
    return baseUrl.trim().startsWith(NETWORK_PROVIDER_URL_PREFIX);
}
export function networkProviderBaseUrl(roomId) {
    return `${NETWORK_PROVIDER_URL_PREFIX}${roomId.trim() || 'default'}`;
}
export function roomIdFromBaseUrl(baseUrl) {
    return isNetworkProviderBaseUrl(baseUrl) ? baseUrl.trim().slice(NETWORK_PROVIDER_URL_PREFIX.length) : '';
}
export function providerKind(provider) {
    return isNetworkProviderBaseUrl(provider.baseUrl) ? 'room' : 'http';
}
/** Apply only to Room voice requests; the sentinel is never sent on the wire. */
export function networkVoiceModelParam(model) {
    const trimmed = model.trim();
    return !trimmed || trimmed === NETWORK_VOICE_AUTO_MODEL ? undefined : trimmed;
}
/** CRUD helpers mutate config; the caller decides when to save. */
export function createProvider(config, label) {
    const id = newId();
    config.providers.push({ id, label, baseUrl: '', apiKey: '', enabled: true, models: [] });
    return id;
}
export function createRoomProvider(config, input) {
    const baseUrl = networkProviderBaseUrl(input.roomId);
    const existing = config.providers.find(p => normalizeBaseUrl(p.baseUrl) === baseUrl);
    if (existing)
        return { id: existing.id, existed: true };
    const id = newId();
    config.providers.push({ id, label: input.label || roomIdFromBaseUrl(baseUrl), baseUrl, apiKey: '', enabled: true, models: [] });
    return { id, existed: false };
}
export function patchProvider(config, id, patch) {
    const provider = config.providers.find(p => p.id === id);
    if (provider)
        Object.assign(provider, patch);
}
export function deleteProvider(config, id) {
    config.providers = config.providers.filter(p => p.id !== id);
}
export function setDefaultModel(config, ref) {
    if (ref)
        config.defaultModel = { ...ref };
    else
        delete config.defaultModel;
}
export function setVoiceConfig(config, kind, next) {
    if (next)
        config[kind] = { ...next };
    else
        delete config[kind];
}
/** Migration lookup only, including old Room refs; no enabled-provider requirement. */
export function presetIdToRef(config, presetId) {
    const preset = config.presets.find(p => p.id === presetId);
    return preset ? { providerId: preset.providerId, model: preset.model } : undefined;
}
/** Idempotent migration; no save/network side effects. Legacy fields are untouched. */
export function migrateSharedLlmConfig(config) {
    let changed = false;
    if (!config.defaultModel) {
        const ref = presetIdToRef(config, config.defaultPresetId);
        if (ref) {
            config.defaultModel = ref;
            changed = true;
        }
    }
    const roomId = config.network.roomId.trim();
    if (roomId && !createRoomProvider(config, { roomId }).existed)
        changed = true;
    for (const preset of config.presets) {
        const provider = config.providers.find(p => p.id === preset.providerId);
        if (!provider || providerKind(provider) === 'room' || !preset.model.trim())
            continue;
        if ((provider.models ?? []).includes(preset.model))
            continue;
        provider.models = [...(provider.models ?? []), preset.model];
        changed = true;
    }
    return { changed };
}
