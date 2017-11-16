'use strict';

const Assert = require('assert');
const Events = require('events');

const Opentracing = require('opentracing');

const Json = require('./json');
const Span = require('./span');
const SpanContext = require('./span_context');

const CARRIER_KEY_BAGGAGE_ITEMS = 'x-tracer-baggage-items';
const CARRIER_KEY_TRACE_ID = 'x-tracer-trace-id';
const CARRIER_KEY_SPAN_IDS = 'x-tracer-span-ids';

const noop = () => undefined;

class Tracer extends Opentracing.Tracer {
    /**
     * Create a Tracer instance
     *
     * @param {Object|undefined} options
     * @param {Function} [options.onLog] Callback invoked upon extracting a span context from a carrier
     * @param {Function} [options.onExtractSpanContext] Callback invoked upon extracting a span context from a carrier
     * @param {Function} [options.onInjectSpanContext] Callback invoked upon injecting a span context into a carrier
     * @param {Function} [options.onStartSpan] Callback invoked upon starting a span
     * @param {Function} [options.onFinishSpan] Callback invoked upon finishing a span
     */
    constructor(options) {
        super();

        if (!options) options = {};

        this.events = new Events.EventEmitter();

        if (options.onLog) this.events.on('log', options.onLog);
        if (options.onExtractSpanContext) this.events.on('extractSpanContext', options.onExtractSpanContext);
        if (options.onInjectSpanContext) this.events.on('injectSpanContext', options.onInjectSpanContext);
        if (options.onStartSpan) this.events.on('startSpan', options.onStartSpan);
        if (options.onFinishSpan) this.events.on('finishSpan', options.onFinishSpan);
    }

    _extract(format, carrier) {
        if (
            format !== Opentracing.FORMAT_HTTP_HEADERS &&
            format !== Opentracing.FORMAT_TEXT_MAP
        ) {
            return null;
        }

        const spanIds = (carrier[Tracer.CARRIER_KEY_SPAN_IDS] || '').split(':');

        const baggageItems = Json.parse(
            carrier[Tracer.CARRIER_KEY_BAGGAGE_ITEMS]
        );
        const traceId = carrier[Tracer.CARRIER_KEY_TRACE_ID];
        const spanId = spanIds.shift();
        const parentSpanId = spanIds.shift();

        if (!traceId || !spanId) {
            return null;
        }

        const spanContext = new SpanContext({
            baggageItems,
            parentSpanId,
            spanId,
            traceId,
        });

        this.events.emit('onExtractSpanContext', spanContext, format, carrier);

        return spanContext;
    }

    /**
     * Inject a span context's metadata into a supported carrier
     *
     * @param {SpanContext} spanContext
     * @param {String} format
     * @param {Object} carrier
     */
    _inject(spanContext, format, carrier) {
        if (
            format !== Opentracing.FORMAT_HTTP_HEADERS &&
            format !== Opentracing.FORMAT_TEXT_MAP
        ) {
            return null;
        }

        if (!carrier) carrier = {};

        let spanIdsStr = spanContext._spanId;

        if (spanContext._parentSpanId) {
            spanIdsStr += `:${spanContext._parentSpanId}`;
        }

        carrier[Tracer.CARRIER_KEY_BAGGAGE_ITEMS] = JSON.stringify(
            spanContext.baggageItems
        );
        carrier[Tracer.CARRIER_KEY_SPAN_IDS] = spanIdsStr;
        carrier[Tracer.CARRIER_KEY_TRACE_ID] = spanContext._traceId;

        this.events.emit('onInjectSpanContext', spanContext, format, carrier);

        return carrier;
    }

    _startSpan(operationName, options) {
        if (!options) options = {};

        Assert(typeof operationName === 'string');

        let spanContext;

        // Right now, we only support a single parent reference
        // Ignore all other references
        if (
            options.references &&
            options.references[0] instanceof Opentracing.Reference &&
            options.references[0].type() === Opentracing.REFERENCE_CHILD_OF
        ) {
            const parentSpanContext = options.references[0].referencedContext();

            spanContext = new SpanContext({
                baggageItems: Object.assign(
                    {},
                    parentSpanContext.baggageItems,
                    options.baggageItems
                ),
                traceId: parentSpanContext.traceId,
                parentSpanId: parentSpanContext.spanId,
            });
        } else {
            spanContext = new SpanContext({
                baggageItems: options.baggageItems,
            });
        }

        const span = new Span(this, operationName, spanContext, {
            tags: options.tags,
            startTime: options.startTime,
        });

        this.events.emit('startSpan', span);

        return span;
    }
}

Tracer.CARRIER_KEY_BAGGAGE_ITEMS = CARRIER_KEY_BAGGAGE_ITEMS;
Tracer.CARRIER_KEY_TRACE_ID = CARRIER_KEY_TRACE_ID;
Tracer.CARRIER_KEY_SPAN_IDS = CARRIER_KEY_SPAN_IDS;

module.exports = Tracer;
