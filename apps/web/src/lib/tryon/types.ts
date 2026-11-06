export type TryOnInput = {
  jobId: string;
  personImagePath: string;
  sareeImagePath: string;
  storeId: string;
};

export type TryOnJobRef = {
  providerJobId: string;
  status: "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
};

export type TryOnStatus = {
  providerJobId: string;
  status: TryOnJobRef["status"];
  error?: string;
  progress?: number;
};

export type TryOnResult = {
  providerJobId: string;
  resultPath: string;
  isDemo: boolean;
  label?: string;
  durationMs?: number;
  provider: string;
  creditsUsed?: number;
  meta?: Record<string, unknown>;
};

export interface VirtualTryOnProvider {
  readonly name: string;
  generateTryOn(input: TryOnInput): Promise<TryOnJobRef>;
  getJobStatus(providerJobId: string): Promise<TryOnStatus>;
  getResult(providerJobId: string): Promise<TryOnResult | null>;
  cancelJob(providerJobId: string): Promise<void>;
}
