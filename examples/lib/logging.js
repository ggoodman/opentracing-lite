'use strict';

const Pino = require('pino'); // Could be bunyan as well
const Tracing = require('../../');

const inflightSpans = new Map();

exports.logInflightTracesOnUncaught = (error, req) => {
    const now = Date.now();
    const spanContext =
        req.span && typeof req.span.context === 'function'
            ? req.span.context()
            : null;
    const inflightSpansOfTrace =
        spanContext && inflightSpans.has(spanContext.traceId)
            ? Array.from(inflightSpans.get(spanContext.traceId)).reverse()
            : [];

    if (spanContext && inflightSpans.has(spanContext.traceId)) {
        inflightSpans.get(spanContext.traceId).clear();
    }

    for (const i in inflightSpansOfTrace) {
        const span = inflightSpansOfTrace[i];

        if (i === '0') {
            span.addTags({ error, level: 'fatal', uncaught: true });
        } else {
            span.addTags({ level: 'error', uncaught: true });
        }

        span.finish(now);
    }
};

function logSpanLifecycleEvent(event, span, logger) {
    const loggerMeta = { span };
    const spanContext = span.context();
    let level = 'info';

    for (const key in spanContext.baggageItems) {
        if (
            key === 'level' &&
            typeof logger[spanContext.baggageItems['level']] === 'function'
        ) {
            level = spanContext.baggageItems['level'];
        } else {
            loggerMeta[key] = spanContext.baggageItems[key];
        }
    }

    for (const key in span._tags) {
        if (
            key === 'level' &&
            typeof logger[span._tags['level']] === 'function'
        ) {
            level = span._tags['level'];
        } else if (key === 'uncaught') {
            event = 'uncaught exception in';
        } else {
            loggerMeta[key] = span._tags[key];
        }
    }

    logger[level](loggerMeta, `${event} ${span.getOperationName()}`);
}

exports.createLogger = () =>
    Pino({
        serializers: {
            error: error => ({
                message: error.message,
                code: error.code,
                name: error.name,
                stack: error.stack,
            }),
            req: Pino.stdSerializers.req,
            res: Pino.stdSerializers.res,
            span(span) {
                const spanContext = span.context();

                return {
                    id: spanContext.spanId,
                    trace: spanContext.traceId,
                    elapsed:
                        (span._finishedTime || Date.now()) - span._startTime,
                    parentId: spanContext.parentSpanId,
                };
            },
        },
    });

exports.createLoggingTracer = logger =>
    new Tracing.Tracer({
        onExtractSpanContext(event) {
            if (event.format === Tracing.FORMAT_HTTP_HEADERS) {
                delete event.carrier[Tracing.Tracer.CARRIER_KEY_BAGGAGE_ITEMS];
                delete event.carrier[Tracing.Tracer.CARRIER_KEY_SPAN_IDS];
                delete event.carrier[Tracing.Tracer.CARRIER_KEY_TRACE_ID];
            }
        },
        onStartSpan(event) {
            let spanContext = event.span.context();

            if (!inflightSpans.has(spanContext.traceId)) {
                inflightSpans.set(spanContext.traceId, new Set());
            }

            inflightSpans.get(spanContext.traceId).add(event.span);
            return logSpanLifecycleEvent('started', event.span, logger);
        },
        onFinishSpan(event) {
            const spanContext = event.span.context();

            if (inflightSpans.has(spanContext.traceId)) {
                inflightSpans.get(spanContext.traceId).delete(event.span);

                if (!spanContext.parentSpanId) {
                    const unfinishedSpans = Array.from(
                        inflightSpans.get(spanContext.traceId)
                    ).reverse();

                    inflightSpans.delete(spanContext.traceId);

                    for (const unfinishedSpan of unfinishedSpans) {
                        unfinishedSpan.addTags({
                            level: 'warn',
                            unfinished: true,
                        });
                        unfinishedSpan.finish();
                    }
                }
            }

            return logSpanLifecycleEvent('finished', event.span, logger);
        },
    });
