// src/route.ts
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
	return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
}
function text(value) {
	return typeof value === "string" ? value.trim() : "";
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
	const keyRef = text(profile?.apiKeyEnv) || deriveKeyRef(provider);
	const apiKey = text((await ctx.credentials.resolve(keyRef))?.value);
	if (apiKey === "") throw new RouteError(`Provider "${displayName}" has no API key. Store it in Settings → Models.`, "route-key-missing");
	return {
		provider,
		displayName,
		baseURL: baseURL.replace(/\/+$/, ""),
		apiKey
	};
}
export { RouteError, deriveKeyRef, findRoute, resolveEndpoint };
