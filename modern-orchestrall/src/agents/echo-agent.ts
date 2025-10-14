// src/agents/echo-agent.ts
import { BaseAgent, AgentInput, AgentOutput } from './base-agent';

export class EchoAgent extends BaseAgent {
  constructor() {
    super('echo', 'Returns the input exactly as provided');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    try {
      return {
        success: true,
        output: input.input,
        metadata: {
          agentName: this.name,
          executionTime: new Date().toISOString(),
          inputType: typeof input.input
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          agentName: this.name,
          executionTime: new Date().toISOString()
        }
      };
    }
  }
}
