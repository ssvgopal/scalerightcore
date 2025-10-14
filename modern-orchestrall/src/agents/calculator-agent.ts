// src/agents/calculator-agent.ts
import { BaseAgent, AgentInput, AgentOutput } from './base-agent';

export class CalculatorAgent extends BaseAgent {
  constructor() {
    super('calculator', 'Performs basic mathematical operations');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    try {
      const expression = input.input?.toString() || '';

      if (!expression) {
        throw new Error('No expression provided');
      }

      // Basic validation - only allow safe operations
      if (!/^[0-9+\-*/.()\s]+$/.test(expression)) {
        throw new Error('Invalid characters in expression');
      }

      // Simple evaluation (in production, use a safer math library)
      const result = this.safeEvaluate(expression);

      return {
        success: true,
        output: {
          expression,
          result,
          type: 'number'
        },
        metadata: {
          agentName: this.name,
          executionTime: new Date().toISOString(),
          operation: 'calculation'
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

  private safeEvaluate(expression: string): number {
    // For MVP, using Function constructor (not recommended for production)
    // In production, use a proper math expression parser
    try {
      const result = new Function('return ' + expression)();
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid result');
      }
      return result;
    } catch (error) {
      throw new Error('Invalid mathematical expression');
    }
  }
}
