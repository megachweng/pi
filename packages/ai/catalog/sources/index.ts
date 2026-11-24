import {
	MODELS_DEV_DECISIONS_URL,
	MODELS_DEV_URL,
	type ModelsDevDecisionMetadata,
	type ModelsDevV2Catalog,
} from "./models-dev.ts";

/** Everything fetched from upstream before the catalog is built. */
export interface CatalogSources {
	modelsDev: ModelsDevV2Catalog;
	modelsDevDecisions: Record<string, ModelsDevDecisionMetadata>;
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${label} returned ${response.status}`);
	return (await response.json()) as T;
}

/**
 * Fetch every upstream source. In strict mode any failure aborts generation;
 * otherwise a failed source contributes nothing.
 */
export async function loadCatalogSources(strict: boolean): Promise<CatalogSources> {
	async function load<T>(label: string, fetcher: () => Promise<T>, fallback: T): Promise<T> {
		try {
			console.log(`Fetching ${label}...`);
			return await fetcher();
		} catch (error) {
			console.error(`Failed to fetch ${label}:`, error);
			if (strict) throw error;
			return fallback;
		}
	}

	const modelsDev = await load(
		"models.dev catalog",
		() => fetchJson<ModelsDevV2Catalog>(MODELS_DEV_URL, "models.dev API"),
		{},
	);
	const modelsDevDecisions = await load(
		"models.dev decision models",
		() => fetchJson<Record<string, ModelsDevDecisionMetadata>>(MODELS_DEV_DECISIONS_URL, "models.dev decision API"),
		{},
	);

	return { modelsDev, modelsDevDecisions };
}
