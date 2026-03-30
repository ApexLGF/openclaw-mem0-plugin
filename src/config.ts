import type { Mem0Config, Mem0Mode } from "./types.js";

export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

export function resolveEnvVarsDeep(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = resolveEnvVars(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = resolveEnvVarsDeep(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const DEFAULT_CUSTOM_INSTRUCTIONS = `Your Task: Extract and maintain a structured, evolving profile of the user from their conversations with an AI assistant. Capture information that would help the assistant provide personalized, context-aware responses in future interactions.

Information to Extract:

1. Identity & Demographics:
   - Name, age, location, timezone, language preferences
   - Occupation, employer, job role, industry
   - Education background

2. Preferences & Opinions:
   - Communication style preferences (formal/casual, verbose/concise)
   - Tool and technology preferences (languages, frameworks, editors, OS)
   - Content preferences (topics of interest, learning style)
   - Strong opinions or values they've expressed
   - Likes and dislikes they've explicitly stated

3. Goals & Projects:
   - Current projects they're working on (name, description, status)
   - Short-term and long-term goals
   - Deadlines and milestones mentioned
   - Problems they're actively trying to solve

4. Technical Context:
   - Tech stack and tools they use
   - Skill level in different areas (beginner/intermediate/expert)
   - Development environment and setup details
   - Recurring technical challenges

5. Relationships & People:
   - Names and roles of people they mention (colleagues, family, friends)
   - Team structure and dynamics
   - Key contacts and their relevance

6. Decisions & Lessons:
   - Important decisions made and their reasoning
   - Lessons learned from past experiences
   - Strategies that worked or failed
   - Changed opinions or updated beliefs

7. Routines & Habits:
   - Daily routines and schedules mentioned
   - Work patterns (when they're productive, how they organize work)
   - Health and wellness habits if voluntarily shared

8. Life Events:
   - Significant events (new job, moving, milestones)
   - Upcoming events or plans
   - Changes in circumstances

Guidelines:
- Store memories as clear, self-contained statements (each memory should make sense on its own)
- Use third person: "User prefers..." not "I prefer..."
- Include temporal context when relevant: "As of [date], user is working on..."
- When information updates, UPDATE the existing memory rather than creating duplicates
- Merge related facts into single coherent memories when possible
- Preserve specificity: "User uses Next.js 14 with App Router" is better than "User uses React"
- Capture the WHY behind preferences when stated: "User prefers Vim because of keyboard-driven workflow"

Exclude:
- Passwords, API keys, tokens, or any authentication credentials
- Exact financial amounts (account balances, salaries) unless the user explicitly asks to remember them
- Temporary or ephemeral information (one-time questions, debugging sessions with no lasting insight)
- Generic small talk with no informational content
- The assistant's own responses unless they contain a commitment or promise to the user
- Raw code snippets (capture the intent/decision, not the code itself)
- Information the user explicitly asks not to remember`;

export const DEFAULT_CUSTOM_CATEGORIES: Record<string, string> = {
  identity:
    "Personal identity information: name, age, location, timezone, occupation, employer, education, demographics",
  preferences:
    "Explicitly stated likes, dislikes, preferences, opinions, and values across any domain",
  goals:
    "Current and future goals, aspirations, objectives, targets the user is working toward",
  projects:
    "Specific projects, initiatives, or endeavors the user is working on, including status and details",
  technical:
    "Technical skills, tools, tech stack, development environment, programming languages, frameworks",
  decisions:
    "Important decisions made, reasoning behind choices, strategy changes, and their outcomes",
  relationships:
    "People mentioned by the user: colleagues, family, friends, their roles and relevance",
  routines:
    "Daily habits, work patterns, schedules, productivity routines, health and wellness habits",
  life_events:
    "Significant life events, milestones, transitions, upcoming plans and changes",
  lessons:
    "Lessons learned, insights gained, mistakes acknowledged, changed opinions or beliefs",
  work:
    "Work-related context: job responsibilities, workplace dynamics, career progression, professional challenges",
  health:
    "Health-related information voluntarily shared: conditions, medications, fitness, wellness goals",
};

const ALLOWED_KEYS = [
  "mode",
  "apiKey",
  "userId",
  "orgId",
  "projectId",
  "autoCapture",
  "autoRecall",
  "customInstructions",
  "customCategories",
  "customPrompt",
  "enableGraph",
  "host",
  "searchThreshold",
  "topK",
  "oss",
  "agentIsolation",
];

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

export const mem0ConfigSchema = {
  parse(value: unknown): Mem0Config {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("openclaw-mem0-plugin config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(cfg, ALLOWED_KEYS, "openclaw-mem0-plugin config");

    const mode: Mem0Mode =
      cfg.mode === "oss" || cfg.mode === "open-source" ? "open-source" : "platform";

    if (mode === "platform") {
      if (typeof cfg.apiKey !== "string" || !cfg.apiKey) {
        throw new Error(
          "apiKey is required for platform mode (set mode: \"open-source\" for self-hosted)",
        );
      }
    }

    let ossConfig: Mem0Config["oss"];
    if (cfg.oss && typeof cfg.oss === "object" && !Array.isArray(cfg.oss)) {
      ossConfig = resolveEnvVarsDeep(
        cfg.oss as Record<string, unknown>,
      ) as unknown as Mem0Config["oss"];
    }

    return {
      mode,
      apiKey:
        typeof cfg.apiKey === "string" ? resolveEnvVars(cfg.apiKey) : undefined,
      userId:
        typeof cfg.userId === "string" && cfg.userId ? cfg.userId : "default",
      orgId: typeof cfg.orgId === "string" ? cfg.orgId : undefined,
      projectId: typeof cfg.projectId === "string" ? cfg.projectId : undefined,
      autoCapture: cfg.autoCapture !== false,
      autoRecall: cfg.autoRecall !== false,
      customInstructions:
        typeof cfg.customInstructions === "string"
          ? cfg.customInstructions
          : DEFAULT_CUSTOM_INSTRUCTIONS,
      customCategories:
        cfg.customCategories &&
          typeof cfg.customCategories === "object" &&
          !Array.isArray(cfg.customCategories)
          ? (cfg.customCategories as Record<string, string>)
          : DEFAULT_CUSTOM_CATEGORIES,
      customPrompt:
        typeof cfg.customPrompt === "string"
          ? cfg.customPrompt
          : DEFAULT_CUSTOM_INSTRUCTIONS,
      enableGraph: cfg.enableGraph === true,
      host: typeof cfg.host === "string" ? resolveEnvVars(cfg.host) : undefined,
      searchThreshold:
        typeof cfg.searchThreshold === "number" ? cfg.searchThreshold : 0.5,
      topK: typeof cfg.topK === "number" ? cfg.topK : 5,
      agentIsolation: cfg.agentIsolation === true,
      oss: ossConfig,
    };
  },
};
