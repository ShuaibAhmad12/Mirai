// lib/api/agents.ts - client wrapper for agents endpoints
export type AgentBasic = { id: string; name: string };

export async function listAgents(): Promise<AgentBasic[]> {
  const res = await fetch("/api/agents", { cache: "no-store" });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Failed to load agents");
  }
  const json = (await res.json()) as { agents: AgentBasic[] };
  return json.agents ?? [];
}
