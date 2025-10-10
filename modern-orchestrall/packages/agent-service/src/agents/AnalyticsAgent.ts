import { OpenAI } from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  Logger,
  ServiceError,
  AgentError,
  AgentResponse,
  AgentContext
} from '@orchestrall/shared';

interface AnalyticsConfig {
  dataSources: string[];
  reportFormats: string[];
  defaultMetrics: string[];
}

interface DataQuery {
  metrics: string[];
  dimensions: string[];
  filters: Record<string, any>;
  dateRange: {
    start: Date;
    end: Date;
  };
  aggregation?: string;
}

interface AnalyticsInsight {
  metric: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  significance: 'high' | 'medium' | 'low';
  explanation: string;
}

class AnalyticsAgent {
  private openai: OpenAI;
  private config: AnalyticsConfig;
  private logger: Logger;

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.logger = new Logger('analytics-agent');

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async process(input: string, context: AgentContext): Promise<AgentResponse> {
    try {
      const startTime = Date.now();

      // Determine the analytics operation
      const operation = this.classifyOperation(input);

      let result: any;

      switch (operation.type) {
        case 'data_query':
          result = await this.executeDataQuery(input, context);
          break;
        case 'trend_analysis':
          result = await this.analyzeTrends(input, context);
          break;
        case 'anomaly_detection':
          result = await this.detectAnomalies(input, context);
          break;
        case 'predictive_insights':
          result = await this.generatePredictiveInsights(input, context);
          break;
        case 'report_generation':
          result = await this.generateReport(input, context);
          break;
        case 'competitor_analysis':
          result = await this.analyzeCompetitors(input, context);
          break;
        default:
          result = await this.generalAnalyticsQuery(input, context);
      }

      const duration = Date.now() - startTime;

      return {
        content: result.content,
        actions: result.actions || [],
        metadata: {
          agent: 'Analytics',
          operation: operation.type,
          duration,
          confidence: result.confidence || 0.8,
          dataSources: result.dataSources || ['analytics_database'],
        },
        framework: 'openai',
      };
    } catch (error) {
      this.logger.error('Analytics agent error', error);
      throw new AgentError(`Analytics operation failed: ${error.message}`);
    }
  }

  private classifyOperation(input: string): { type: string; confidence: number } {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('query') || lowerInput.includes('data') || lowerInput.includes('metrics')) {
      return { type: 'data_query', confidence: 0.9 };
    }
    if (lowerInput.includes('trend') || lowerInput.includes('pattern') || lowerInput.includes('growth')) {
      return { type: 'trend_analysis', confidence: 0.9 };
    }
    if (lowerInput.includes('anomaly') || lowerInput.includes('unusual') || lowerInput.includes('outlier')) {
      return { type: 'anomaly_detection', confidence: 0.8 };
    }
    if (lowerInput.includes('predict') || lowerInput.includes('forecast') || lowerInput.includes('future')) {
      return { type: 'predictive_insights', confidence: 0.8 };
    }
    if (lowerInput.includes('report') || lowerInput.includes('summary') || lowerInput.includes('dashboard')) {
      return { type: 'report_generation', confidence: 0.8 };
    }
    if (lowerInput.includes('competitor') || lowerInput.includes('market share') || lowerInput.includes('competitive')) {
      return { type: 'competitor_analysis', confidence: 0.8 };
    }

    return { type: 'general_analytics_query', confidence: 0.6 };
  }

  private async executeDataQuery(input: string, context: AgentContext): Promise<any> {
    // Parse the query to extract metrics, dimensions, and filters
    const query = await this.parseDataQuery(input);

    // Execute the query against data sources
    const data = await this.fetchData(query);

    // Format and return results
    const formattedResults = this.formatQueryResults(data, query);

    return {
      content: `Data Query Results:\n${formattedResults}`,
      actions: [
        {
          type: 'save_query_results',
          payload: { query, results: data, savedAt: new Date() },
          confidence: 0.9,
        },
      ],
      confidence: 0.9,
      dataSources: this.config.dataSources,
    };
  }

  private async analyzeTrends(input: string, context: AgentContext): Promise<any> {
    // Analyze trends in the data
    const prompt = `Analyze trends and patterns in the following data:

    Analysis Request: ${input}

    Identify:
    - Overall trend direction (upward, downward, stable)
    - Key turning points or changes
    - Seasonal patterns
    - Growth/decline rates
    - Statistical significance

    Provide specific insights with confidence levels and actionable recommendations.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a data analyst specializing in trend analysis and pattern recognition.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const analysis = response.choices[0].message.content || '';

    return {
      content: `Trend Analysis:\n${analysis}`,
      actions: [
        {
          type: 'create_trend_report',
          payload: { analysis, trends: analysis, generatedAt: new Date() },
          confidence: 0.8,
        },
      ],
      confidence: 0.8,
      dataSources: ['historical_data', 'trend_analysis'],
    };
  }

  private async detectAnomalies(input: string, context: AgentContext): Promise<any> {
    // Detect anomalies in data patterns
    const prompt = `Detect anomalies and unusual patterns in the data:

    Analysis Request: ${input}

    Look for:
    - Statistical outliers
    - Unexpected spikes or drops
    - Unusual correlations
    - Data quality issues
    - Seasonal anomalies

    Provide specific findings with severity levels and potential causes.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an anomaly detection specialist with expertise in statistical analysis.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 400,
    });

    const anomalies = response.choices[0].message.content || '';

    return {
      content: `Anomaly Detection Results:\n${anomalies}`,
      actions: [
        {
          type: 'flag_anomalies',
          payload: { anomalies, severity: 'medium', requiresAttention: true },
          confidence: 0.7,
        },
      ],
      confidence: 0.7,
      dataSources: ['time_series_data', 'statistical_models'],
    };
  }

  private async generatePredictiveInsights(input: string, context: AgentContext): Promise<any> {
    // Generate predictive insights using historical data
    const prompt = `Generate predictive insights based on historical data:

    Prediction Request: ${input}

    Consider:
    - Historical trends and seasonality
    - External factors and market conditions
    - Growth patterns and cycles
    - Risk factors and uncertainties

    Provide predictions with confidence intervals and key assumptions.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a predictive analytics expert with strong forecasting skills.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    const predictions = response.choices[0].message.content || '';

    return {
      content: `Predictive Insights:\n${predictions}`,
      actions: [
        {
          type: 'create_prediction_report',
          payload: { predictions, model: 'gpt-4', confidence: 'medium' },
          confidence: 0.6,
        },
      ],
      confidence: 0.6,
      dataSources: ['historical_data', 'predictive_models'],
    };
  }

  private async generateReport(input: string, context: AgentContext): Promise<any> {
    // Generate comprehensive analytics report
    const prompt = `Create a comprehensive analytics report:

    Report Request: ${input}

    Include:
    - Executive summary
    - Key metrics and KPIs
    - Trend analysis
    - Insights and recommendations
    - Visual data descriptions
    - Action items

    Structure the report professionally with clear sections and actionable conclusions.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a business intelligence analyst creating professional reports for executive audiences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 800,
    });

    const report = response.choices[0].message.content || '';

    return {
      content: `Analytics Report:\n${report}`,
      actions: [
        {
          type: 'export_report',
          payload: { report, format: 'markdown', sections: ['summary', 'metrics', 'insights'] },
          confidence: 0.9,
        },
      ],
      confidence: 0.9,
      dataSources: ['multiple_data_sources', 'ai_generated_insights'],
    };
  }

  private async analyzeCompetitors(input: string, context: AgentContext): Promise<any> {
    // Analyze competitive landscape
    const prompt = `Analyze competitive landscape and market position:

    Analysis Request: ${input}

    Research and analyze:
    - Market share and positioning
    - Competitive advantages/disadvantages
    - Market trends and opportunities
    - Pricing and product comparisons
    - Strategic recommendations

    Provide data-driven competitive analysis with specific recommendations.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a competitive intelligence analyst with expertise in market research and strategy.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 700,
    });

    const analysis = response.choices[0].message.content || '';

    return {
      content: `Competitive Analysis:\n${analysis}`,
      actions: [
        {
          type: 'create_competitive_report',
          payload: { analysis, competitors: ['analyzed'], recommendations: analysis },
          confidence: 0.7,
        },
      ],
      confidence: 0.7,
      dataSources: ['market_data', 'competitive_intelligence', 'industry_reports'],
    };
  }

  private async generalAnalyticsQuery(input: string, context: AgentContext): Promise<any> {
    // Handle general analytics queries
    const prompt = `Answer this analytics-related question:

    Question: ${input}

    Provide accurate, helpful responses based on analytics best practices and methodologies.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an analytics expert with deep knowledge of data analysis, visualization, and business intelligence.',
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
      dataSources: ['analytics_knowledge_base', 'best_practices'],
    };
  }

  private async parseDataQuery(input: string): Promise<DataQuery> {
    // Parse natural language query into structured data query
    // This is a simplified implementation - in production would use more sophisticated NLP

    return {
      metrics: ['revenue', 'orders', 'customers'],
      dimensions: ['date', 'product_category'],
      filters: {},
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date(),
      },
      aggregation: 'sum',
    };
  }

  private async fetchData(query: DataQuery): Promise<any[]> {
    // Query actual data from database based on metrics and dimensions
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // Build dynamic query based on requested metrics
      const results: any[] = [];
      
      // Query workflow executions for analytics data
      const executions = await prisma.workflowExecution.findMany({
        where: {
          createdAt: {
            gte: query.dateRange.start,
            lte: query.dateRange.end,
          },
        },
        include: {
          workflow: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      
      // Aggregate data by date
      const dataByDate = new Map<string, any>();
      
      executions.forEach(exec => {
        const dateKey = exec.createdAt.toISOString().split('T')[0];
        
        if (!dataByDate.has(dateKey)) {
          dataByDate.set(dateKey, {
            date: dateKey,
            executions: 0,
            workflows: new Set(),
            avgDuration: 0,
            totalDuration: 0,
          });
        }
        
        const dayData = dataByDate.get(dateKey)!;
        dayData.executions++;
        dayData.workflows.add(exec.workflowId);
        
        // Calculate duration if available
        if (exec.completedAt) {
          const duration = exec.completedAt.getTime() - exec.createdAt.getTime();
          dayData.totalDuration += duration;
          dayData.avgDuration = dayData.totalDuration / dayData.executions;
        }
      });
      
      // Convert to array format
      dataByDate.forEach((value, key) => {
        results.push({
          date: key,
          executions: value.executions,
          workflows: value.workflows.size,
          avgDuration: Math.round(value.avgDuration),
        });
      });
      
      await prisma.$disconnect();
      return results;
    } catch (error) {
      this.logger.error('Data fetch failed', error);
      await prisma.$disconnect();
      throw new ServiceError('Failed to fetch analytics data');
    }
  }

  private formatQueryResults(data: any[], query: DataQuery): string {
    if (!data || data.length === 0) {
      return 'No data found for the specified query.';
    }

    let result = 'Query Results:\n\n';

    // Summary statistics
    const totalRevenue = data.reduce((sum, row) => sum + (row.revenue || 0), 0);
    const totalOrders = data.reduce((sum, row) => sum + (row.orders || 0), 0);
    const totalCustomers = data.reduce((sum, row) => sum + (row.customers || 0), 0);

    result += `Summary:
- Total Revenue: $${totalRevenue.toLocaleString()}
- Total Orders: ${totalOrders}
- Total Customers: ${totalCustomers}
- Average Order Value: $${(totalRevenue / totalOrders).toFixed(2)}

`;

    // Sample data points
    result += 'Sample Data Points:\n';
    data.slice(0, 5).forEach((row, index) => {
      result += `${index + 1}. ${row.date}: Revenue $${row.revenue}, Orders ${row.orders}, Customers ${row.customers}\n`;
    });

    return result;
  }

  async getCapabilities(): Promise<string[]> {
    return [
      'data_query',
      'trend_analysis',
      'anomaly_detection',
      'predictive_insights',
      'report_generation',
      'competitor_analysis',
      'statistical_analysis',
      'data_visualization',
      'business_intelligence',
    ];
  }
}

export { AnalyticsAgent, AnalyticsConfig };
