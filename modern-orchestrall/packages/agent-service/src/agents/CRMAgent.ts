import { OpenAI } from 'openai';
import axios from 'axios';
import {
  Logger,
  ServiceError,
  AgentError,
  AgentResponse,
  AgentContext
} from '@orchestrall/shared';

interface CRMConfig {
  apiKey: string;
  instanceUrl: string;
  apiVersion?: string;
}

interface CustomerData {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status?: string;
  lastContact?: Date;
  leadScore?: number;
  tags?: string[];
}

interface LeadInsight {
  score: number;
  confidence: number;
  recommendations: string[];
  nextActions: string[];
}

class CRMAgent {
  private openai: OpenAI;
  private config: CRMConfig;
  private logger: Logger;

  constructor(config: CRMConfig) {
    this.config = config;
    this.logger = new Logger('crm-agent');

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async process(input: string, context: AgentContext): Promise<AgentResponse> {
    try {
      const startTime = Date.now();

      // Determine the CRM operation based on input
      const operation = this.classifyOperation(input);

      let result: any;

      switch (operation.type) {
        case 'customer_lookup':
          result = await this.lookupCustomer(input, context);
          break;
        case 'lead_scoring':
          result = await this.scoreLead(input, context);
          break;
        case 'customer_insights':
          result = await this.generateCustomerInsights(input, context);
          break;
        case 'sales_recommendations':
          result = await this.generateSalesRecommendations(input, context);
          break;
        case 'customer_segmentation':
          result = await this.segmentCustomers(input, context);
          break;
        default:
          result = await this.generalCRMQuery(input, context);
      }

      const duration = Date.now() - startTime;

      return {
        content: result.content,
        actions: result.actions || [],
        metadata: {
          agent: 'CRM',
          operation: operation.type,
          duration,
          confidence: result.confidence || 0.8,
          dataSources: result.dataSources || ['crm_database'],
        },
        framework: 'openai',
      };
    } catch (error) {
      this.logger.error('CRM agent error', error);
      throw new AgentError(`CRM operation failed: ${error.message}`);
    }
  }

  private classifyOperation(input: string): { type: string; confidence: number } {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('find customer') || lowerInput.includes('lookup customer')) {
      return { type: 'customer_lookup', confidence: 0.9 };
    }
    if (lowerInput.includes('score lead') || lowerInput.includes('lead score')) {
      return { type: 'lead_scoring', confidence: 0.9 };
    }
    if (lowerInput.includes('customer insights') || lowerInput.includes('customer analysis')) {
      return { type: 'customer_insights', confidence: 0.8 };
    }
    if (lowerInput.includes('sales recommendations') || lowerInput.includes('sales strategy')) {
      return { type: 'sales_recommendations', confidence: 0.8 };
    }
    if (lowerInput.includes('segment customers') || lowerInput.includes('customer segments')) {
      return { type: 'customer_segmentation', confidence: 0.8 };
    }

    return { type: 'general_crm_query', confidence: 0.6 };
  }

  private async lookupCustomer(input: string, context: AgentContext): Promise<any> {
    // Extract customer information from input
    const customerInfo = await this.extractCustomerInfo(input);

    // Query CRM system (mock implementation)
    const customer = await this.queryCRM(`SELECT * FROM customers WHERE email = '${customerInfo.email}'`);

    if (!customer) {
      return {
        content: `Customer not found for email: ${customerInfo.email}`,
        confidence: 0.9,
        dataSources: ['crm_database'],
      };
    }

    return {
      content: `Found customer: ${customer.name} (${customer.email})\nStatus: ${customer.status}\nLast Contact: ${customer.lastContact}\nLead Score: ${customer.leadScore}`,
      actions: [
        {
          type: 'update_customer_contact',
          payload: { customerId: customer.id, contactDate: new Date() },
          confidence: 0.8,
        },
      ],
      confidence: 0.9,
      dataSources: ['crm_database', 'interaction_history'],
    };
  }

  private async scoreLead(input: string, context: AgentContext): Promise<any> {
    // Extract lead information from input
    const leadInfo = await this.extractLeadInfo(input);

    // Calculate lead score using AI
    const prompt = `Analyze this lead and provide a score from 0-100 based on:
    - Company size and industry
    - Budget and timeline
    - Decision-making authority
    - Current pain points
    - Engagement level

    Lead Info: ${JSON.stringify(leadInfo)}

    Provide a score and 2-3 specific reasons for the score.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a lead scoring expert. Provide accurate, data-driven lead scores.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const analysis = response.choices[0].message.content || '';
    const scoreMatch = analysis.match(/(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;

    return {
      content: `Lead Score Analysis:\n${analysis}\n\nFinal Score: ${score}/100`,
      actions: [
        {
          type: 'update_lead_score',
          payload: { leadId: leadInfo.id, score, reasoning: analysis },
          confidence: 0.9,
        },
      ],
      confidence: 0.8,
      dataSources: ['crm_database', 'ai_analysis'],
    };
  }

  private async generateCustomerInsights(input: string, context: AgentContext): Promise<any> {
    // Generate customer insights using AI analysis
    const prompt = `Analyze customer behavior and provide actionable insights:

    Customer Query: ${input}

    Consider:
    - Purchase history and patterns
    - Engagement levels and frequency
    - Customer lifetime value
    - Churn risk indicators
    - Upselling/cross-selling opportunities

    Provide 3-5 specific, actionable insights with confidence levels.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a customer insights analyst. Provide actionable, data-driven insights.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 400,
    });

    const insights = response.choices[0].message.content || '';

    return {
      content: `Customer Insights:\n${insights}`,
      actions: [
        {
          type: 'create_customer_insights_report',
          payload: { insights, generatedAt: new Date() },
          confidence: 0.7,
        },
      ],
      confidence: 0.7,
      dataSources: ['customer_data', 'behavioral_analysis', 'ai_insights'],
    };
  }

  private async generateSalesRecommendations(input: string, context: AgentContext): Promise<any> {
    // Generate sales strategy recommendations
    const prompt = `Based on current sales data and market conditions, provide strategic recommendations:

    Query: ${input}

    Consider:
    - Current sales pipeline
    - Market trends and competition
    - Customer feedback and preferences
    - Product performance data
    - Team capacity and resources

    Provide 3-4 strategic recommendations with implementation steps.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a sales strategy consultant. Provide practical, actionable recommendations.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    const recommendations = response.choices[0].message.content || '';

    return {
      content: `Sales Strategy Recommendations:\n${recommendations}`,
      actions: [
        {
          type: 'create_sales_strategy_report',
          payload: { recommendations, priority: 'high' },
          confidence: 0.8,
        },
      ],
      confidence: 0.8,
      dataSources: ['sales_data', 'market_analysis', 'customer_feedback'],
    };
  }

  private async segmentCustomers(input: string, context: AgentContext): Promise<any> {
    // Customer segmentation analysis
    const prompt = `Analyze customer base and create meaningful segments:

    Analysis Request: ${input}

    Create segments based on:
    - Purchase behavior (frequency, value, recency)
    - Demographics (industry, company size, location)
    - Engagement level (email opens, website visits, support tickets)
    - Customer lifetime value
    - Churn risk

    Define 3-5 segments with characteristics and recommended actions for each.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a customer segmentation expert. Create actionable, data-driven customer segments.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    const segmentation = response.choices[0].message.content || '';

    return {
      content: `Customer Segmentation Analysis:\n${segmentation}`,
      actions: [
        {
          type: 'create_customer_segments',
          payload: { segments: segmentation, targetAudience: 'all' },
          confidence: 0.7,
        },
      ],
      confidence: 0.7,
      dataSources: ['customer_database', 'behavioral_data', 'demographics'],
    };
  }

  private async generalCRMQuery(input: string, context: AgentContext): Promise<any> {
    // Handle general CRM queries
    const prompt = `Answer this CRM-related question based on best practices and industry knowledge:

    Question: ${input}

    Provide a helpful, accurate response with specific examples where applicable.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a CRM expert with deep knowledge of customer relationship management systems and best practices.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 400,
    });

    const answer = response.choices[0].message.content || '';

    return {
      content: answer,
      confidence: 0.6,
      dataSources: ['crm_knowledge_base', 'industry_best_practices'],
    };
  }

  private async extractCustomerInfo(input: string): Promise<{ email?: string; name?: string }> {
    // Simple extraction - in production would use more sophisticated NLP
    const emailMatch = input.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const nameMatch = input.match(/customer[:\s]+([A-Za-z\s]+)/i);

    return {
      email: emailMatch ? emailMatch[1] : undefined,
      name: nameMatch ? nameMatch[1].trim() : undefined,
    };
  }

  private async extractLeadInfo(input: string): Promise<any> {
    // Extract lead information from input
    return {
      id: 'lead_123',
      name: 'Extracted Lead',
      company: 'Example Corp',
      source: 'website',
      engagement: 'high',
    };
  }

  private async queryCRM(query: string): Promise<CustomerData | null> {
    try {
      // Use Prisma to query customer data from database
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      // Parse email from query (simple extraction)
      const emailMatch = query.match(/email\s*=\s*'([^']+)'/i);
      if (!emailMatch) {
        await prisma.$disconnect();
        return null;
      }
      
      const email = emailMatch[1];
      
      // Query actual customer data from database
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          organization: true,
        },
      });
      
      await prisma.$disconnect();
      
      if (!user) {
        return null;
      }
      
      // Transform to CustomerData format
      return {
        id: user.id,
        name: user.name || email.split('@')[0],
        email: user.email,
        phone: user.metadata?.phone as string,
        company: user.organization?.name,
        status: user.status || 'active',
        lastContact: user.lastLoginAt || user.updatedAt,
        leadScore: user.metadata?.leadScore as number || 50,
        tags: user.metadata?.tags as string[] || [],
      };
    } catch (error) {
      this.logger.error('CRM query failed', error);
      throw new ServiceError('CRM system unavailable');
    }
  }

  async getCapabilities(): Promise<string[]> {
    return [
      'customer_lookup',
      'lead_scoring',
      'customer_insights',
      'sales_recommendations',
      'customer_segmentation',
      'crm_data_analysis',
      'customer_support_analysis',
    ];
  }
}

export { CRMAgent, CRMConfig };
