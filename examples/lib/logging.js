'use strict';

const Pino = require('pino'); // Could be bunyan as well
const Tracing = require('../../');

function logSpanLifecycleEvent(event, span, logger) {
    const loggerMeta = { span };
    const spanContext = span.context();
    let level = 'info';

    for (const key in span._tags) {
        if (key === 'level' && typeof logger[span._tags['level']] === 'function') {
            level = span._tags['level'];
        } else {
            loggerMeta[key] = span._tags[key];
        }
    }

    for (const key in spanContext.baggageItems) {
        if (key === 'level' && typeof logger[span._tags['level']] === 'function') {
            level = span._tags['level'];
        } else {
            loggerMeta[key] = spanContext.baggageItems[key];
        }
    }

    logger[level](loggerMeta, `${event} ${span.getOperationName()}`);
}

exports.createLogger = () => Pino({
    serializers: {
        error: Pino.stdSerializers.err,
        req: Pino.stdSerializers.req,
        res: Pino.stdSerializers.res,
        span(span) {
            const spanContext = span.context();

            return {
                id: spanContext.spanId,
                trace: spanContext.traceId,
                elapsed: (span._finishedTime || Date.now()) - span._startTime,
                parentId: spanContext.parentSpanId,
            };
        },
    },
});

exports.createLoggingTracer = logger => new Tracing.Tracer({
    onExtractSpanContext(spanContext, format, carrier) {
        if (format === Tracing.FORMAT_HTTP_HEADERS) {
            delete carrier[Tracing.Tracer.CARRIER_KEY_BAGGAGE_ITEMS];
            delete carrier[Tracing.Tracer.CARRIER_KEY_SPAN_IDS];
            delete carrier[Tracing.Tracer.CARRIER_KEY_TRACE_ID];
        }
    },
    onStartSpan(span) {
        return logSpanLifecycleEvent('started', span, logger);
    },
    onFinishSpan(span) {
        return logSpanLifecycleEvent('finished', span, logger);
    },
});
