# PatientFlow Test Suite

Comprehensive Jest unit tests for the PatientFlow domain, including PatientService, AppointmentService, ConversationOrchestrator, and webhook handlers with mocked Prisma, Twilio, and AI integrations.

## Overview

The PatientFlow test suite mirrors the core clinic/healthcare patient flow scenarios:

- **Patient Management**: Lookup/create patients by phone, preference resolution, signup flows
- **Appointment Scheduling**: Slot generation, conflict prevention, rescheduling, cancellation
- **Conversational AI**: Tool invocation decisions with LLM integration for booking/rescheduling
- **Webhook Handling**: WhatsApp and voice webhook processing with signature validation and duplicate detection

## Test Structure

```
tests/patientflow/
├── PatientService.test.js              # Patient CRUD and preference tests
├── AppointmentService.test.js          # Appointment scheduling and conflict tests
├── ConversationOrchestrator.test.js    # LLM-driven conversation and tool invocation tests
├── webhookHandlers.test.js             # Webhook signature validation and action triggers
├── patientflow.integration.test.js     # End-to-end demo flow tests
├── fixtures/
│   └── seedData.js                     # Test data fixtures and cleanup utilities
├── utils/
│   └── mockPrisma.js                   # Mock Prisma client, LLM, and external services
└── README.md                           # This file
```

## Running Tests

### Run all PatientFlow tests
```bash
npm run test:patientflow
```

### Run specific test file
```bash
npm test -- tests/patientflow/PatientService.test.js
```

### Run with coverage
```bash
npm run test:coverage -- tests/patientflow
```

### Watch mode (auto-rerun on file changes)
```bash
npm run test:watch -- tests/patientflow
```

## Test Coverage

The test suite includes comprehensive coverage for:

### PatientService Tests
- ✅ Patient lookup by phone and organization
- ✅ Create new patient with validation
- ✅ Get or create patient (return existing or create new)
- ✅ Resolve patient preferences (with defaults)
- ✅ Create/update patient preferences
- ✅ Add patient notes
- ✅ Update communication opt-ins
- ✅ New patient signup flow with preferences
- ✅ Retrieve complete patient history

### AppointmentService Tests
- ✅ Generate available appointment slots
- ✅ Exclude conflicting appointments from slots
- ✅ Book appointments with conflict detection
- ✅ Reschedule appointments with conflict prevention
- ✅ Cancel appointments
- ✅ Retrieve appointments by doctor and date range
- ✅ Retrieve appointments by patient
- ✅ Confirm appointments
- ✅ Send appointment reminders

### ConversationOrchestrator Tests
- ✅ Initialize conversation sessions
- ✅ Get or create sessions
- ✅ Process user messages with LLM integration
- ✅ Detect user intent (booking, rescheduling, cancellation, confirmation)
- ✅ Invoke tools based on detected intent
- ✅ Handle tool execution results
- ✅ Close conversation sessions
- ✅ Handle LLM service errors gracefully

### WebhookHandler Tests
- ✅ Validate webhook signatures (HMAC-SHA256)
- ✅ Detect duplicate webhooks
- ✅ Handle WhatsApp message webhooks
- ✅ Handle voice call webhooks with multiple statuses
- ✅ Trigger actions (send message, place call, book appointment)
- ✅ Extract and store message/call metadata
- ✅ Update call logs for multi-message conversations

### Integration Tests
- ✅ New patient signup flow
- ✅ Complete WhatsApp booking conversation
- ✅ Voice call booking with call status transitions
- ✅ Appointment booking and confirmation without conflicts
- ✅ Double-booking prevention
- ✅ Appointment rescheduling to new slot
- ✅ Patient conversation with tool invocation
- ✅ Duplicate webhook handling
- ✅ Appointment cancellation

## Mocking Strategy

The test suite uses Jest mocks to avoid external dependencies:

### Prisma Client Mocking
All database operations are mocked using Jest mocks. The `createMockPrisma()` utility creates a fully mocked Prisma client with all required models.

```javascript
const mockPrisma = createMockPrisma();
const patientService = new PatientService(mockPrisma);
```

### LLM Service Mocking
The LLM service is mocked to return deterministic tool invocation decisions:

```javascript
const mockLlmService = createMockLlmService();
// Returns stubbed intent detection and tool invocations
```

### Twilio/WhatsApp Mocking
External communication services are mocked:

```javascript
const mockTwilioClient = createMockTwilioClient();
const mockWhatsAppClient = createMockWhatsAppClient();
```

## Example Test Patterns

### Testing Patient Lookup
```javascript
it('should find a patient by phone and organizationId', async () => {
  const mockPatient = { id: 'patient-1', phone: '+1-555-1000' };
  mockPrisma.patient.findUnique.mockResolvedValue(mockPatient);

  const result = await patientService.lookupByPhone('org-1', '+1-555-1000');

  expect(result).toEqual(mockPatient);
});
```

### Testing Appointment Conflict Detection
```javascript
it('should throw error on time slot conflict', async () => {
  const conflictingAppointment = {
    doctorId: 'doctor-1',
    startTime: new Date('2025-01-07T10:00:00'),
    endTime: new Date('2025-01-07T10:30:00'),
  };
  mockPrisma.appointment.findFirst.mockResolvedValue(conflictingAppointment);

  await expect(appointmentService.bookAppointment(...)).rejects.toThrow(
    'Time slot conflict with existing appointment'
  );
});
```

### Testing Webhook Processing
```javascript
it('should process a WhatsApp webhook', async () => {
  const payload = {
    id: 'wh-1',
    from: '+1-555-1000',
    text: 'I want to book',
  };

  const result = await webhookHandler.handleWhatsAppWebhook(payload, 'org-1');

  expect(result.status).toBe('processed');
  expect(result.toolsDetected).toContain('BOOK_APPOINTMENT');
});
```

## Test Data Fixtures

The `fixtures/seedData.js` provides utilities for test data:

```javascript
const { seedTestData, cleanupTestData } = require('./fixtures/seedData');

// In your test:
const testData = await seedTestData(prisma);
// Use testData.patients, testData.doctors, etc.

// Cleanup after test
await cleanupTestData(prisma);
```

## Acceptance Criteria

✅ `npm run test:patientflow` executes all tests  
✅ Tests include scenarios mirroring required demo flows  
✅ DB writes are confirmed through mocks/spies (exactly once per flow)  
✅ Test suite passes in CI without external API dependencies  
✅ Coverage thresholds maintained (80% branches/functions/lines/statements)  

## Key Design Decisions

1. **Mock-First Approach**: All external dependencies mocked to ensure tests are fast and deterministic
2. **Unit + Integration Mix**: Unit tests for individual services + integration tests for complete flows
3. **Realistic Test Data**: Fixtures use realistic healthcare data (medical specialties, appointment slots, etc.)
4. **Error Scenarios**: Comprehensive error case coverage (conflicts, invalid data, not found, etc.)
5. **Single Responsibility**: Each test focuses on one specific behavior or flow

## Running in CI

The test suite is designed to run in CI/CD pipelines without modification:

```bash
# Install dependencies
npm install

# Run PatientFlow tests
npm run test:patientflow

# Or run all tests including PatientFlow
npm test
```

All external services are mocked, so no credentials or external API access is required.

## Troubleshooting

### Tests timeout
If tests timeout, check that mock setup is complete before test execution. Ensure `beforeEach` hooks properly initialize mocks.

### Mock not called
Verify that the service method is actually calling the mocked function. Add debugging with `console.log(mockFn.mock.calls)`.

### Unexpected mock behavior
Jest mocks can sometimes retain state between tests. Ensure `jest.clearAllMocks()` is called in `afterEach`.

## Future Enhancements

- [ ] Add snapshot tests for complex state objects
- [ ] Add performance benchmarks for slot generation
- [ ] Add more edge cases for rescheduling logic
- [ ] Add stress tests for concurrent appointment bookings
- [ ] Add memory leak detection in long-running tests
- [ ] Add visual regression tests for UI components (when added)

## Related Documentation

- [PatientFlow Architecture](../../docs/patientflow-architecture.md)
- [API Reference](../../API_REFERENCE.md)
- [Jest Configuration](../../package.json)
