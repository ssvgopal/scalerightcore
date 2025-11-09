# PatientFlow Test Suite

This directory contains comprehensive tests for the PatientFlow functionality, covering all major components and integration scenarios.

## Test Structure

### Unit Tests
- **PatientService.test.js** - Tests patient management operations
- **AppointmentService.test.js** - Tests appointment scheduling and management
- **ConversationOrchestrator.test.js** - Tests conversation flow and intent analysis
- **WebhookHandlers.test.js** - Tests WhatsApp and voice webhook handlers

### Integration Tests
- **integration.test.js** - End-to-end testing of complete patient flows

### Test Utilities
- **fixtures.js** - Test data fixtures and scenarios
- **mocks.js** - Mock utilities for external dependencies
- **setup.js** - Test environment setup and configuration

## Running Tests

### Run all PatientFlow tests
```bash
npm run test:patientflow
```

### Run with coverage
```bash
npm run test:patientflow -- --coverage
```

### Run in watch mode
```bash
npm run test:patientflow -- --watch
```

### Run specific test file
```bash
npm run test:patientflow -- PatientService.test.js
```

## Test Coverage Areas

### PatientService
- ✅ Patient lookup by phone
- ✅ New patient creation with preferences
- ✅ Patient information updates
- ✅ Preference management
- ✅ Patient notes and history
- ✅ Error handling and validation

### AppointmentService
- ✅ Available slot generation
- ✅ Slot availability checking
- ✅ Appointment creation with conflict prevention
- ✅ Appointment rescheduling
- ✅ Appointment cancellation
- ✅ Patient and doctor appointment queries
- ✅ Time parsing utilities

### ConversationOrchestrator
- ✅ Intent analysis (booking, rescheduling, cancellation, inquiries)
- ✅ Action execution based on intents
- ✅ Session management
- ✅ LLM response stubbing
- ✅ Parameter extraction from messages
- ✅ Error handling

### WebhookHandlers
- ✅ WhatsApp webhook processing
- ✅ Voice webhook processing with TwiML generation
- ✅ Speech recognition result handling
- ✅ Signature validation
- ✅ Duplicate message prevention
- ✅ Response generation (WhatsApp and voice)
- ✅ Integration with external services

### Integration Tests
- ✅ New patient booking flow via WhatsApp
- ✅ Existing patient reschedule flow
- ✅ Appointment cancellation flow
- ✅ Voice call handling
- ✅ Direct service API endpoints
- ✅ Error handling scenarios
- ✅ Demo flow scenarios

## Test Scenarios

### Demo Flows
1. **New Patient Booking** - Complete flow from first contact to appointment confirmation
2. **Existing Patient Reschedule** - Change appointment time with conflict checking
3. **Appointment Cancellation** - Cancel appointment with proper notifications
4. **Voice Interaction** - Handle phone calls with speech recognition

### Edge Cases
- Invalid signatures and security
- Duplicate message handling
- Database errors and retries
- No available slots scenarios
- Invalid patient data
- Appointment conflicts

## Mock Strategy

### Database
- Full Prisma client mocking with transaction support
- Realistic data relationships
- Proper error simulation

### External APIs
- Twilio API mocking for WhatsApp and voice
- OpenAI LLM service mocking
- Crypto module for signature validation

### Environment
- Test-specific environment variables
- Console output suppression
- Date/time mocking for consistent tests

## Test Data

### Fixtures Include
- Organizations, clinics, doctors, schedules
- Patients with preferences and history
- Appointments with various statuses
- Conversation sessions and message logs
- Webhook payloads for different scenarios

### Test Scenarios
Predefined scenarios covering:
- New patient signup paths
- Existing patient interactions
- Multi-step conversations
- Error recovery flows

## CI/CD Integration

The test suite is designed to run in CI environments without external dependencies:
- All external APIs are mocked
- Database operations use in-memory mocks
- No network calls required
- Deterministic test results

## Coverage Requirements

Tests maintain high coverage for:
- All service methods (>90% line coverage)
- Error handling paths
- Edge cases and validation
- Integration scenarios

## Best Practices

### Test Organization
- Descriptive test names
- Clear setup/teardown
- Reusable fixtures and mocks
- Isolated test cases

### Mock Management
- Consistent mock interfaces
- Proper cleanup between tests
- Realistic response simulation
- Error scenario coverage

### Assertion Strategy
- Multiple assertion levels
- Behavior verification
- State validation
- Error message checking