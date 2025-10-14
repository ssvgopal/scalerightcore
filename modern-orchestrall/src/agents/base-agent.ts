// src/agents/base-agent.ts
export interface AgentInput {
  input: any;
  context?: Record<string, any>;
  userId?: string;
}

export interface AgentOutput {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export abstract class BaseAgent {
  protected name: string;
  protected description: string;

  constructor(name: string, description: string = '') {
    this.name = name;
    this.description = description;
  }

  abstract execute(input: AgentInput): Promise<AgentOutput>;

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }
}
