const crypto = require('crypto');
const twilio = require('twilio');
const { buildWhatsAppWebhookHandler } = require('../../src/patientflow/whatsapp-webhook');

function createReplyMock() {
  const reply = {};
  reply.code = jest.fn(() => reply);
  reply.header = jest.fn(() => reply);
  reply.send = jest.fn(() => reply);
  return reply;
}

function computeTwilioSignature(authToken, url, params) {
  const sortedKeys = Object.keys(params).sort();
  const data = sortedKeys.reduce((acc, key) => acc + key + params[key], url);
  return crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');
}

describe('PatientFlow WhatsApp webhook', () => {
  const baseConfig = {
    patientflow: {
      defaultOrganizationId: 'org-demo',
      messaging: {
        dedupeTtlSeconds: 60,
      },
      twilio: {
        enableSignatureValidation: true,
      },
    },
    server: {
      host: 'example.com',
    },
  };

  const metricsMock = {
    observeWebhookDuration: jest.fn(),
    recordInbound: jest.fn(),
    recordOutbound: jest.fn(),
    recordAppointmentBooked: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects webhook requests with invalid signature', async () => {
    const twilioMock = {
      isConfigured: true,
      validateSignature: jest.fn(() => false),
    };

    const cacheMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
    };

    const orchestratorMock = {
      handleInboundMessage: jest.fn(),
    };

    const handler = buildWhatsAppWebhookHandler({
      configService: baseConfig,
      loggerService: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
      cache: cacheMock,
      metricsService: metricsMock,
      patientResolver: { resolveOrCreatePatient: jest.fn() },
      orchestrator: orchestratorMock,
      twilio: twilioMock,
    });

    const reply = createReplyMock();
    const request = {
      id: 'req-1',
      protocol: 'https',
      headers: {
        host: 'example.com',
        'x-twilio-signature': 'invalid',
      },
      raw: { url: '/patientflow/webhooks/whatsapp' },
      body: {
        MessageSid: 'SM0001',
        From: 'whatsapp:+1234567890',
        Body: 'Hello',
      },
    };

    await handler(request, reply);

    expect(twilioMock.validateSignature).toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.header).toHaveBeenCalledWith('Content-Type', 'application/xml');
    expect(reply.send).toHaveBeenCalledWith('<Response></Response>');
    expect(orchestratorMock.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('accepts webhook when signature is valid and processes message', async () => {
    const authToken = '12345';
    const url = 'https://example.com/patientflow/webhooks/whatsapp';
    const params = {
      Body: 'Hello, I need an appointment on 2024-05-20 at 09:30',
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+1098765432',
      MessageSid: 'SM0002',
      ProfileName: 'Test User',
      WaId: '1234567890',
    };
    const signature = computeTwilioSignature(authToken, url, params);

    const twilioMock = {
      isConfigured: true,
      validateSignature: jest.fn((sig, requestUrl, bodyParams) => {
        return twilio.validateRequest(authToken, sig, requestUrl, bodyParams);
      }),
    };

    const cacheMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
    };

    const orchestratorMock = {
      handleInboundMessage: jest.fn().mockResolvedValue({}),
    };

    const patientResolverMock = {
      resolveOrCreatePatient: jest.fn().mockResolvedValue({
        id: 'patient-1',
        phone: '+1234567890',
        firstName: 'Test',
      }),
    };

    const handler = buildWhatsAppWebhookHandler({
      configService: Object.assign({}, baseConfig, {
        patientflow: Object.assign({}, baseConfig.patientflow, {
          twilio: Object.assign({}, baseConfig.patientflow.twilio, {
            enableSignatureValidation: true,
          }),
        }),
      }),
      loggerService: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
      cache: cacheMock,
      metricsService: metricsMock,
      patientResolver: patientResolverMock,
      orchestrator: orchestratorMock,
      twilio: twilioMock,
    });

    const reply = createReplyMock();
    const request = {
      id: 'req-2',
      protocol: 'https',
      headers: {
        host: 'example.com',
        'x-twilio-signature': signature,
      },
      raw: { url: '/patientflow/webhooks/whatsapp' },
      body: params,
    };

    await handler(request, reply);

    expect(twilioMock.validateSignature).toHaveBeenCalledWith(signature, url, params);
    expect(patientResolverMock.resolveOrCreatePatient).toHaveBeenCalled();
    expect(orchestratorMock.handleInboundMessage).toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.header).toHaveBeenCalledWith('Content-Type', 'application/xml');
    expect(reply.send).toHaveBeenCalledWith('<Response></Response>');
  });
});
