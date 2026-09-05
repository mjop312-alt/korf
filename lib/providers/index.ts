// Provider-registry. Bepaalt welke bron(nen) de ingestion-worker gebruikt.
//
// DATA_MODE=mock  → alleen MockProvider (demodata)
// DATA_MODE=live  → alle echte providers (Albert Heijn, Jumbo, Lidl)
//
// Nieuwe supermarkt = een bestand dat PriceProvider implementeert, hier registreren.

import { ahProvider } from "./ah";
import { jumboProvider } from "./jumbo";
import { lidlProvider } from "./lidl";
import { mockProvider } from "./mock";
import type { PriceProvider } from "./types";

const REGISTRY: Record<string, PriceProvider> = {
  mock: mockProvider,
  ah: ahProvider,
  jumbo: jumboProvider,
  lidl: lidlProvider,
};

export function getProvider(name: string): PriceProvider {
  return REGISTRY[name] ?? mockProvider;
}

export function activeProviders(): PriceProvider[] {
  const mode = process.env.DATA_MODE ?? "mock";
  if (mode === "mock") return [mockProvider];
  return Object.values(REGISTRY).filter((p) => p.mode === "live");
}

export type { NormalisedProduct, PriceProvider } from "./types";
