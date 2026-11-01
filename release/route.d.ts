/**
 * Resolving a provider route chosen in Settings → Models into an endpoint this
 * plugin can call: a base URL and an API key.
 *
 * Neither value is stored by this plugin. The route's profile is read through
 * the settings service, exactly as the official Models page reads it, and the
 * key is resolved per operation through the credentials service, so a key
 * rotated in Settings → Models takes effect on the next recording.
 * @module dsh-speech-to-text/route
 */
import type { HostContext, LlmConfigurableProvider } from './dsh';
/** An endpoint ready to be called. */
export interface Endpoint {
    /** Provider route id, kept for error messages. */
    provider: string;
    /** Display name of the route. */
    displayName: string;
    /** OpenAI-compatible base URL, without a trailing slash. */
    baseURL: string;
    /** Secret resolved for this operation only; never returned to the browser. */
    apiKey: string;
}
/** A route that cannot be called, described without any secret material. */
export declare class RouteError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
/**
 * Conventional credential reference for a provider route.
 *
 * The Models page stores a typed key under this name and records it in the
 * profile as `apiKeyEnv`; the derivation is repeated here only for routes the
 * profile leaves unnamed, which is how an environment-supplied key is found.
 *
 * @param provider - route id, e.g. `minimax-cn`.
 * @returns the reference name, e.g. `MINIMAX_CN_API_KEY`.
 */
export declare function deriveKeyRef(provider: string): string;
/**
 * Locate a directory entry for a route id.
 *
 * @param ctx host context.
 * @param provider route id chosen in this plugin's settings.
 * @returns the entry, or undefined when no adapter declares the route.
 */
export declare function findRoute(ctx: HostContext, provider: string): LlmConfigurableProvider | undefined;
/**
 * Resolve the endpoint one route answers on.
 *
 * @param ctx host context.
 * @param provider route id.
 * @returns base URL and key, ready for one operation.
 * @throws RouteError when the route is unknown, has no endpoint, or has no stored key.
 */
export declare function resolveEndpoint(ctx: HostContext, provider: string): Promise<Endpoint>;
