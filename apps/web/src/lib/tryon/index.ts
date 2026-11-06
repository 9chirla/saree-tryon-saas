import { env } from "../env";
import { DemoTryOnProvider } from "./demo-provider";
import { ExternalApiTryOnProvider } from "./external-provider";
import { SelfHostedTryOnProvider } from "./selfhosted-provider";
import type { VirtualTryOnProvider } from "./types";

let cached: VirtualTryOnProvider | null = null;

export function getTryOnProvider(): VirtualTryOnProvider {
  if (cached) return cached;
  switch (env.tryonProvider) {
    case "external":
      cached = new ExternalApiTryOnProvider();
      break;
    case "selfhosted":
      cached = new SelfHostedTryOnProvider();
      break;
    case "demo":
    default:
      cached = new DemoTryOnProvider();
      break;
  }
  return cached;
}

export type * from "./types";
