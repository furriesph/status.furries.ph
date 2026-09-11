export type Status =
  | "operational"
  | "unknown"
  | "degraded"
  | "outage"
  | "maintenance"
  | "not_launched";
export interface Service {
  id: string;
  name: string;
  group: string;
  description: string;
  url?: string;
  dependencies?: string[];
  check:
    | { kind: "http"; url: string; expectedStatus?: number; contains?: string }
    | { kind: "supabase"; target: "database" | "auth" | "capacity" | "limits" }
    | { kind: "cloudflare"; target: "workers" | "requests" }
    | { kind: "media"; url: string }
    | { kind: "cms" }
    | { kind: "platform" | "operations"; target: string }
    | {
        kind: "provider";
        provider: "supabase" | "cloudflare";
        components: string[];
      }
    | { kind: "heartbeat"; signal: string }
    | { kind: "lifecycle"; reason: string };
}
export interface Observation {
  serviceId: string;
  status: Status;
  checkedAt: string;
  latencyMs: number | null;
  message: string;
  evidence?: "direct" | "dependency" | "monitoring-gap";
}
export interface Incident {
  id: string;
  title: string;
  status:
    | "investigating"
    | "identified"
    | "monitoring"
    | "resolved"
    | "scheduled";
  impact: "operational" | "degraded" | "outage" | "maintenance";
  serviceIds: string[];
  startedAt: string;
  resolvedAt?: string;
  endsAt?: string;
  updates: { at: string; message: string }[];
}
export interface DailyHistory {
  serviceId: string;
  date: string;
  status: Status;
  checks: number;
  operationalChecks: number;
}
export interface Snapshot {
  schemaVersion: 2;
  generatedAt: string | null;
  observations: Observation[];
  history: DailyHistory[];
  incidents: Incident[];
}
