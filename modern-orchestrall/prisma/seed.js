const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default organization
  const organization = await prisma.organization.upsert({
    where: { slug: 'orchestrall-demo' },
    update: {},
    create: {
      name: 'Orchestrall Demo Organization',
      slug: 'orchestrall-demo',
      tier: 'enterprise',
      status: 'active',
    },
  });

  console.log('✅ Created organization:', organization.name);

  // Create default admin user
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@orchestrall.com' },
    update: {},
    create: {
      email: 'admin@orchestrall.com',
      name: 'Admin User',
      password: hashedPassword,
      organizationId: organization.id,
      status: 'active',
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create default agents
  const agents = [
    {
      name: 'Text Processor',
      description: 'Content analysis, reading time estimation, and text processing',
      type: 'specialist',
      framework: 'openai',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['content_analysis', 'reading_time', 'text_summarization', 'sentiment_analysis'],
        model: 'gpt-4',
        temperature: 0.3,
      },
      capabilities: ['content_analysis', 'reading_time', 'text_summarization', 'sentiment_analysis'],
      status: 'active',
    },
    {
      name: 'Calculator',
      description: 'Safe mathematical operations and calculations',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['arithmetic', 'algebra', 'statistics', 'geometry'],
        safeMode: true,
      },
      capabilities: ['arithmetic', 'algebra', 'statistics', 'geometry'],
      status: 'active',
    },
    {
      name: 'Data Validator',
      description: 'Multi-format validation (email, phone, URL, JSON)',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['email_validation', 'phone_validation', 'url_validation', 'json_validation'],
        strictMode: true,
      },
      capabilities: ['email_validation', 'phone_validation', 'url_validation', 'json_validation'],
      status: 'active',
    },
    {
      name: 'File Analyzer',
      description: 'File type detection, content statistics, and analysis',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['file_type_detection', 'content_stats', 'metadata_extraction'],
        maxFileSize: '10MB',
      },
      capabilities: ['file_type_detection', 'content_stats', 'metadata_extraction'],
      status: 'active',
    },
    {
      name: 'JSON Validator',
      description: 'JSON parsing, formatting, and structure analysis',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['json_parsing', 'json_formatting', 'schema_validation'],
        prettyPrint: true,
      },
      capabilities: ['json_parsing', 'json_formatting', 'schema_validation'],
      status: 'active',
    },
    {
      name: 'URL Analyzer',
      description: 'URL parsing, component extraction, and validation',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['url_parsing', 'component_extraction', 'url_validation'],
        followRedirects: false,
      },
      capabilities: ['url_parsing', 'component_extraction', 'url_validation'],
      status: 'active',
    },
    {
      name: 'DateTime Processor',
      description: 'Date parsing, time calculations, and timezone handling',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['date_parsing', 'time_calculations', 'timezone_conversion'],
        defaultTimezone: 'UTC',
      },
      capabilities: ['date_parsing', 'time_calculations', 'timezone_conversion'],
      status: 'active',
    },
    {
      name: 'String Manipulator',
      description: 'Text transformation, case conversion, and string operations',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['text_transformation', 'case_conversion', 'string_operations'],
        preserveWhitespace: false,
      },
      capabilities: ['text_transformation', 'case_conversion', 'string_operations'],
      status: 'active',
    },
    {
      name: 'Number Analyzer',
      description: 'Mathematical properties, prime detection, and number analysis',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['mathematical_properties', 'prime_detection', 'number_analysis'],
        precision: 10,
      },
      capabilities: ['mathematical_properties', 'prime_detection', 'number_analysis'],
      status: 'active',
    },
  ];

  for (const agentData of agents) {
    const agent = await prisma.agent.upsert({
      where: { 
        name_organizationId: {
          name: agentData.name,
          organizationId: organization.id,
        }
      },
      update: {},
      create: agentData,
    });
    console.log(`✅ Created agent: ${agent.name}`);
  }

  // Create default workflows
  const workflows = [
    {
      name: 'Customer Onboarding',
      description: 'Automated customer onboarding workflow',
      organizationId: organization.id,
      createdById: adminUser.id,
      definition: {
        nodes: [
          { id: 'start', type: 'start', next: 'validate' },
          { id: 'validate', type: 'agent', agent: 'Data Validator', next: 'process' },
          { id: 'process', type: 'agent', agent: 'Text Processor', next: 'end' },
          { id: 'end', type: 'end' }
        ],
        edges: [
          { from: 'start', to: 'validate' },
          { from: 'validate', to: 'process' },
          { from: 'process', to: 'end' }
        ]
      },
      status: 'active',
      tags: ['onboarding', 'automation'],
    },
    {
      name: 'Data Processing Pipeline',
      description: 'Multi-step data processing and validation',
      organizationId: organization.id,
      createdById: adminUser.id,
      definition: {
        nodes: [
          { id: 'start', type: 'start', next: 'validate' },
          { id: 'validate', type: 'agent', agent: 'Data Validator', next: 'analyze' },
          { id: 'analyze', type: 'agent', agent: 'Number Analyzer', next: 'format' },
          { id: 'format', type: 'agent', agent: 'JSON Validator', next: 'end' },
          { id: 'end', type: 'end' }
        ],
        edges: [
          { from: 'start', to: 'validate' },
          { from: 'validate', to: 'analyze' },
          { from: 'analyze', to: 'format' },
          { from: 'format', to: 'end' }
        ]
      },
      status: 'active',
      tags: ['data', 'processing', 'pipeline'],
    },
  ];

  for (const workflowData of workflows) {
    const workflow = await prisma.workflow.upsert({
      where: {
        name_organizationId: {
          name: workflowData.name,
          organizationId: organization.id,
        }
      },
      update: {},
      create: workflowData,
    });
    console.log(`✅ Created workflow: ${workflow.name}`);
  }

  // Create feature flags
  const featureFlags = [
    {
      name: 'Agent Runtime',
      key: 'agent-runtime',
      description: 'Enable AI agent execution engine',
      enabled: true,
      organizationId: organization.id,
      config: { runtime: 'openai', model: 'gpt-4' },
    },
    {
      name: 'Workflow Engine',
      key: 'workflow-engine',
      description: 'Enable workflow orchestration',
      enabled: true,
      organizationId: organization.id,
      config: { engine: 'langgraph', async: true },
    },
    {
      name: 'Plugin System',
      key: 'plugin-system',
      description: 'Enable plugin architecture',
      enabled: true,
      organizationId: organization.id,
      config: { registry: 'local', autoUpdate: false },
    },
  ];

  for (const flagData of featureFlags) {
    const flag = await prisma.featureFlag.upsert({
      where: { key: flagData.key },
      update: {},
      create: flagData,
    });
    console.log(`✅ Created feature flag: ${flag.name}`);
  }

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
