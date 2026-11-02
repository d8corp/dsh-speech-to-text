import { credentialRef, isCredentialRefName } from "@deepseek-ai/dsh-credentials";
// src/route.ts
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
/** A route that cannot be called, described without any secret material. */
var RouteError = class extends Error {
	constructor(message, code) {
		super(message);
		this.name = "RouteError";
		this.code = code;
	}
};
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
function deriveKeyRef(provider) {
	return credentialRef(`${provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`);
}
function text(value) {
	return typeof value === "string" ? value.trim() : "";
}
/**
* The credential reference one route answers to.
*
* The profile's own name wins; a name outside the credential grammar has no
* reference to miss, and an absent one leaves the conventional derived name.
* Both the recorder and the settings page ask through here, so the picker
* cannot offer a route the recorder would refuse for a key.
*
* @param provider - route id.
* @param profile - the route's stored profile, when it has one.
* @returns the reference the key is read from.
*/
function keyRefOf(provider, profile) {
	const named = text(profile?.apiKeyEnv);
	return named !== "" && isCredentialRefName(named) ? credentialRef(named) : deriveKeyRef(provider);
}
/**
* Read one route's stored profile out of the settings snapshot.
*
* @param ctx host context.
* @param entry directory entry naming the namespace and path of the profile.
* @returns the profile object, or undefined when the route has no stored profile.
*/
function readProfile(ctx, entry) {
	if (entry.settingsNs.length === 0) return void 0;
	const descriptor = ctx.settings.describe().find((form) => form.ns === entry.settingsNs);
	if (descriptor === void 0) return void 0;
	let node = descriptor.value;
	for (const segment of entry.settingsPath) {
		if (node === null || typeof node !== "object") return void 0;
		node = node[segment];
	}
	return node !== null && typeof node === "object" && !Array.isArray(node) ? node : void 0;
}
/**
* Locate a directory entry for a route id.
*
* @param ctx host context.
* @param provider route id chosen in this plugin's settings.
* @returns the entry, or undefined when no adapter declares the route.
*/
function findRoute(ctx, provider) {
	return ctx.llm.listConfigurableProviders().find((entry) => entry.provider === provider);
}
/**
* Resolve the endpoint one route answers on.
*
* @param ctx host context.
* @param provider route id.
* @returns base URL and key, ready for one operation.
* @throws RouteError when the route is unknown, has no endpoint, or has no stored key.
*/
async function resolveEndpoint(ctx, provider) {
	const entry = findRoute(ctx, provider);
	const displayName = entry?.displayName ?? provider;
	if (entry === void 0) throw new RouteError(`Provider "${provider}" is not configured in Settings → Models.`, "route-unknown");
	const profile = readProfile(ctx, entry);
	const baseURL = text(profile?.baseURL) || text(entry.defaultBaseURL);
	if (baseURL === "") throw new RouteError(`Provider "${displayName}" has no base URL. Set one in Settings → Models.`, "route-base-url");
	const apiKey = text((await ctx.credentials.resolve(keyRefOf(provider, profile)))?.value);
	if (apiKey === "") throw new RouteError(`Provider "${displayName}" has no API key. Store it in Settings → Models.`, "route-key-missing");
	return {
		provider,
		displayName,
		baseURL: baseURL.replace(/\/+$/, ""),
		apiKey
	};
}
export { RouteError, deriveKeyRef, findRoute, keyRefOf, resolveEndpoint };
