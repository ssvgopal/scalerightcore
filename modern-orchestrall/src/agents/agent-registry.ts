// src/agents/agent-registry.ts
import { BaseAgent, AgentInput, AgentOutput } from './base-agent';
import { EchoAgent } from './echo-agent';
import { CalculatorAgent } from './calculator-agent';

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();

  constructor() {
    this.registerDefaultAgents();
  }

  private registerDefaultAgents() {
    this.register(new EchoAgent());
    this.register(new CalculatorAgent());
  }

  register(agent: BaseAgent): void {
    this.agents.set(agent.getName(), agent);
  }

  getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  getAllAgents(): Array<{ name: string; description: string }> {
    return Array.from(this.agents.entries()).map(([name, agent]) => ({
      name,
      description: agent.getDescription()
    }));
  }

  async executeAgent(name: string, input: AgentInput): Promise<AgentOutput> {
    const agent = this.agents.get(name);

    if (!agent) {
      return {
        success: false,
        error: `Agent '${name}' not found`,
        metadata: {
          availableAgents: this.getAllAgents().map(a => a.name)
        }
      };
    }

    try {
      return await agent.execute(input);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          agentName: name,
          executionTime: new Date().toISOString()
        }
      };
    }
  }
}
