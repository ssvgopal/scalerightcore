/**
 * Observability Configuration
 *
 * Comprehensive tracing and logging setup for the Orchestrall platform
 * using OpenTelemetry, Jaeger, Grafana, Loki, and Prometheus stack
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-otlp-grpc';
import { OTLPLogExporter as OTLPLogExporterHTTP } from '@opentelemetry/exporter-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { PrometheusMetricExporter } from '@opentelemetry/exporter-prometheus';

export class ObservabilityManager {
  private sdk: NodeSDK;
  private meterProvider: MeterProvider;
  private prometheusExporter: PrometheusExporter;

  constructor() {
    this.initializeObservability();
  }

  private initializeObservability() {
    // Resource attributes for all telemetry data
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'orchestrall-platform',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '2.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'ai-automation',
    });

    // Initialize tracing
    const traceExporter = this.getTraceExporter();
    const spanProcessor = new BatchSpanProcessor(traceExporter);

    // Initialize metrics
    this.prometheusExporter = new PrometheusExporter({
      port: parseInt(process.env.PROMETHEUS_PORT || '9464'),
      endpoint: '/metrics',
    }, () => {
      console.log('Prometheus metrics server started on port 9464');
    });

    this.meterProvider = new MeterProvider({
      resource,
      readers: [this.prometheusExporter],
    });

    // Initialize logging
    const logExporter = this.getLogExporter();
    const logProcessor = new BatchLogRecordProcessor(logExporter);

    // Create OpenTelemetry SDK
    this.sdk = new NodeSDK({
      resource,
      spanProcessor,
      logRecordProcessor: logProcessor,
      meterProvider: this.meterProvider,
      instrumentations: [getNodeAutoInstrumentations({
        // Enable file system tracing
        '@opentelemetry/instrumentation-fs': {
          enabled: true,
        },
        // Enable HTTP tracing
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        // Enable gRPC tracing
        '@opentelemetry/instrumentation-grpc': {
          enabled: true,
        },
        // Enable MongoDB tracing (if used)
        '@opentelemetry/instrumentation-mongodb': {
          enabled: false, // Enable if using MongoDB
        },
        // Enable Redis tracing (if used)
        '@opentelemetry/instrumentation-redis': {
          enabled: false, // Enable if using Redis
        },
      })],
    });

    // Start the SDK
    this.sdk.start();
    console.log('OpenTelemetry observability initialized');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      this.sdk.shutdown().then(() => {
        console.log('OpenTelemetry SDK shut down');
      });
    });
  }

  private getTraceExporter() {
    // Use Jaeger for local development
    if (process.env.NODE_ENV === 'development' || process.env.OTEL_EXPORTER === 'jaeger') {
      return new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      });
    }

    // Use OTLP for production
    return new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
      headers: {
        'api-key': process.env.OTEL_EXPORTER_OTLP_HEADERS || '',
      },
    });
  }

  private getLogExporter() {
    // Use OTLP for log export
    return new OTLPLogExporter({
      url: process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || 'http://localhost:4318/v1/logs',
      headers: {
        'api-key': process.env.OTEL_EXPORTER_OTLP_HEADERS || '',
      },
    });
  }

  // Utility methods for custom instrumentation
  getTracer(name: string) {
    const { trace } = require('@opentelemetry/api');
    return trace.getTracer(name);
  }

  getMeter() {
    return this.meterProvider.getMeter('orchestrall-platform');
  }

  getLogger() {
    const { logs } = require('@opentelemetry/api-logs');
    return logs.getLogger('orchestrall-platform');
  }
}

// Create global observability instance
export const observability = new ObservabilityManager();

// Export for use in other modules
export { observability as default };
