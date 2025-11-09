import { OpenAI } from 'openai';
import * as cheerio from 'cheerio';
import {
  Logger,
  ServiceError,
  AgentError,
  AgentResponse,
  AgentContext
} from '@orchestrall/shared';

interface DocumentConfig {
  supportedTypes: string[];
  maxFileSize: number;
  ocrEnabled: boolean;
  extractFields: string[];
}

interface DocumentAnalysis {
  type: string;
  confidence: number;
  pages: number;
  language: string;
  extractedData: Record<string, any>;
  summary: string;
  keywords: string[];
  entities: string[];
}

class DocumentProcessingAgent {
  private openai: OpenAI;
  private config: DocumentConfig;
  private logger: Logger;

  constructor(config: DocumentConfig) {
    this.config = config;
    this.logger = new Logger('document-agent');

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async process(input: string, context: AgentContext): Promise<AgentResponse> {
    try {
      const startTime = Date.now();

      // Determine the document processing operation
      const operation = this.classifyOperation(input);

      let result: any;

      switch (operation.type) {
        case 'document_analysis':
          result = await this.analyzeDocument(input, context);
          break;
        case 'data_extraction':
          result = await this.extractDocumentData(input, context);
          break;
        case 'document_classification':
          result = await this.classifyDocument(input, context);
          break;
        case 'content_summarization':
          result = await this.summarizeDocument(input, context);
          break;
        case 'keyword_extraction':
          result = await this.extractKeywords(input, context);
          break;
        case 'entity_recognition':
          result = await this.recognizeEntities(input, context);
          break;
        default:
          result = await this.generalDocumentQuery(input, context);
      }

      const duration = Date.now() - startTime;

      return {
        content: result.content,
        actions: result.actions || [],
        metadata: {
          agent: 'DocumentProcessor',
          operation: operation.type,
          duration,
          confidence: result.confidence || 0.8,
          dataSources: result.dataSources || ['document_content'],
        },
        framework: 'openai',
      };
    } catch (error) {
      this.logger.error('Document processing agent error', error);
      throw new AgentError(`Document processing failed: ${error.message}`);
    }
  }

  private classifyOperation(input: string): { type: string; confidence: number } {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('analyze document') || lowerInput.includes('document analysis')) {
      return { type: 'document_analysis', confidence: 0.9 };
    }
    if (lowerInput.includes('extract data') || lowerInput.includes('extract information')) {
      return { type: 'data_extraction', confidence: 0.9 };
    }
    if (lowerInput.includes('classify') || lowerInput.includes('document type')) {
      return { type: 'document_classification', confidence: 0.8 };
    }
    if (lowerInput.includes('summarize') || lowerInput.includes('summary')) {
      return { type: 'content_summarization', confidence: 0.9 };
    }
    if (lowerInput.includes('keywords') || lowerInput.includes('key terms')) {
      return { type: 'keyword_extraction', confidence: 0.8 };
    }
    if (lowerInput.includes('entities') || lowerInput.includes('named entities')) {
      return { type: 'entity_recognition', confidence: 0.8 };
    }

    return { type: 'general_document_query', confidence: 0.6 };
  }

  private async analyzeDocument(input: string, context: AgentContext): Promise<any> {
    // Extract document information from input
    const documentInfo = await this.extractDocumentInfo(input);

    // Analyze document content
    const prompt = `Analyze this document and provide comprehensive insights:

    Document: ${documentInfo.content}

    Provide:
    - Document type and purpose
    - Key information and data points
    - Important dates and deadlines
    - Main topics and themes
    - Action items or requirements
    - Overall document quality and completeness

    Structure your response clearly with sections and bullet points.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a document analysis expert with strong analytical and summarization skills.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    const analysis = response.choices[0].message.content || '';

    return {
      content: `Document Analysis:\n${analysis}`,
      actions: [
        {
          type: 'save_document_analysis',
          payload: { documentId: documentInfo.id, analysis, analyzedAt: new Date() },
          confidence: 0.9,
        },
      ],
      confidence: 0.9,
      dataSources: ['document_content', 'ai_analysis'],
    };
  }

  private async extractDocumentData(input: string, context: AgentContext): Promise<any> {
    // Extract specific data fields from document
    const prompt = `Extract specific information from this document:

    Document: ${input}

    Extract the following fields if present:
    - Names (people, companies, organizations)
    - Dates (meetings, deadlines, events)
    - Numbers (amounts, quantities, measurements)
    - Addresses and locations
    - Contact information (emails, phones)
    - Key terms and phrases
    - Important clauses or conditions

    Format as structured data with field names and values.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction specialist. Extract information accurately and completely.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 400,
    });

    const extractedData = response.choices[0].message.content || '';

    return {
      content: `Extracted Data:\n${extractedData}`,
      actions: [
        {
          type: 'save_extracted_data',
          payload: { data: extractedData, fields: this.config.extractFields },
          confidence: 0.8,
        },
      ],
      confidence: 0.8,
      dataSources: ['document_content', 'extraction_model'],
    };
  }

  private async classifyDocument(input: string, context: AgentContext): Promise<any> {
    // Classify document type and category
    const prompt = `Classify this document and determine its type and purpose:

    Document content: ${input}

    Possible document types:
    - Invoice/Bill/Receipt
    - Contract/Agreement
    - Report/Analysis
    - Email/Memo
    - Form/Application
    - Legal Document
    - Technical Document
    - Marketing Material
    - Other

    Provide classification with confidence level and reasoning.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a document classification expert with knowledge of various document types and formats.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const classification = response.choices[0].message.content || '';

    return {
      content: `Document Classification:\n${classification}`,
      actions: [
        {
          type: 'update_document_metadata',
          payload: { classification, classifiedAt: new Date() },
          confidence: 0.8,
        },
      ],
      confidence: 0.8,
      dataSources: ['document_content', 'classification_model'],
    };
  }

  private async summarizeDocument(input: string, context: AgentContext): Promise<any> {
    // Generate document summary
    const prompt = `Create a comprehensive summary of this document:

    Document: ${input}

    Include:
    - Main purpose and objective
    - Key points and findings
    - Important conclusions
    - Action items or next steps
    - Critical dates or deadlines

    Keep the summary concise but comprehensive (200-300 words).`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional summarizer who creates clear, concise summaries of complex documents.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 400,
    });

    const summary = response.choices[0].message.content || '';

    return {
      content: `Document Summary:\n${summary}`,
      actions: [
        {
          type: 'save_document_summary',
          payload: { summary, wordCount: summary.split(' ').length },
          confidence: 0.9,
        },
      ],
      confidence: 0.9,
      dataSources: ['document_content', 'summarization_model'],
    };
  }

  private async extractKeywords(input: string, context: AgentContext): Promise<any> {
    // Extract key terms and phrases
    const prompt = `Extract the most important keywords and key phrases from this document:

    Document: ${input}

    Focus on:
    - Technical terms and jargon
    - Proper nouns (names, places, organizations)
    - Important concepts and ideas
    - Frequently mentioned topics
    - Unique or distinctive phrases

    Return 10-15 most relevant keywords/phrases with relevance scores.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a keyword extraction expert who identifies the most relevant and important terms in documents.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 250,
    });

    const keywords = response.choices[0].message.content || '';

    return {
      content: `Extracted Keywords:\n${keywords}`,
      actions: [
        {
          type: 'index_document_keywords',
          payload: { keywords, documentId: 'current' },
          confidence: 0.8,
        },
      ],
      confidence: 0.8,
      dataSources: ['document_content', 'nlp_model'],
    };
  }

  private async recognizeEntities(input: string, context: AgentContext): Promise<any> {
    // Recognize named entities
    const prompt = `Identify and categorize named entities in this document:

    Document: ${input}

    Entity types to identify:
    - PERSON: People and individuals
    - ORG: Organizations and companies
    - LOCATION: Places and addresses
    - DATE: Dates and time expressions
    - MONEY: Currency amounts and financial figures
    - PRODUCT: Products and services
    - EVENT: Events and occurrences

    Provide entities with their types and context.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a named entity recognition expert who accurately identifies and categorizes entities in text.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 350,
    });

    const entities = response.choices[0].message.content || '';

    return {
      content: `Named Entities:\n${entities}`,
      actions: [
        {
          type: 'link_document_entities',
          payload: { entities, entityCount: entities.split('\n').length },
          confidence: 0.7,
        },
      ],
      confidence: 0.7,
      dataSources: ['document_content', 'ner_model'],
    };
  }

  private async generalDocumentQuery(input: string, context: AgentContext): Promise<any> {
    // Handle general document queries
    const prompt = `Answer this document-related question:

    Question: ${input}

    Provide helpful, accurate responses based on document processing best practices.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a document processing expert with knowledge of various document types, formats, and processing techniques.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 300,
    });

    const answer = response.choices[0].message.content || '';

    return {
      content: answer,
      confidence: 0.6,
      dataSources: ['document_knowledge_base'],
    };
  }

  private async extractDocumentInfo(input: string): Promise<{ id: string; content: string; type?: string }> {
    // Extract document information from input
    return {
      id: `doc_${Date.now()}`,
      content: input,
      type: 'unknown',
    };
  }

  async getCapabilities(): Promise<string[]> {
    return [
      'document_analysis',
      'data_extraction',
      'document_classification',
      'content_summarization',
      'keyword_extraction',
      'entity_recognition',
      'document_indexing',
      'content_search',
      'document_comparison',
    ];
  }
}

export { DocumentProcessingAgent, DocumentConfig };
