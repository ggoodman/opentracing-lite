'use strict';

const Assert = require('assert');
const Opentracing = require('opentracing');

const Span = require('./span');
const SpanContext = require('./span_context');

const CARRIER_KEY_BAGGAGE_ITEMS = 'x-tracer-baggage-items';
const CARRIER_KEY_SERVICE_KEYS = 'x-tracer-service-key';
const CARRIER_KEY_TRACE_ID = 'x-tracer-trace-id';
const CARRIER_KEY_SPAN_IDS = 'x-tracer-span-id';

class Tracer extends Opentracing.Tracer {
    constructor(serviceKey, logger) {
        super();

        Assert(typeof serviceKey === 'string', 'serviceKey must be a string');
        Assert(logger, 'logger is required');
        Assert(
            typeof logger.child === 'function',
            'logger must have a child method'
        );

        this.logger = logger;
        this._serviceKey = serviceKey;
    }

    _extract(format, carrier) {
        if (
            format !== Opentracing.FORMAT_HTTP_HEADERS &&
            format !== Opentracing.FORMAT_TEXT_MAP
        ) {
            return null;
        }

        const serviceKeys = (carrier[Tracer.CARRIER_KEY_SERVICE_KEYS] || ''
        ).split(':');

        const spanIds = (carrier[Tracer.CARRIER_KEY_SPAN_IDS] || '').split(':');

        const baggageItems = (() => {
            const json = carrier[Tracer.CARRIER_KEY_BAGGAGE_ITEMS];
            if (!json) return {};
            try {
                return JSON.parse(json);
            } catch (__) {
                return {};
            }
        })();
        const serviceKey = serviceKeys.shift();
        const parentServiceKey = serviceKeys.shift();
        const traceId = carrier[Tracer.CARRIER_KEY_TRACE_ID];
        const spanId = spanIds.shift();
        const parentSpanId = spanIds.shift();

        if (!serviceKey || !traceId || !spanId) {
            return null;
        }

        return new SpanContext(serviceKey, {
            baggageItems,
            parentServiceKey,
            parentSpanId,
            spanId,
            traceId,
        });
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

        let serviceKeysStr = spanContext.serviceKey;

        if (spanContext.parentServiceKey) {
            serviceKeysStr += `:${spanContext.parentServiceKey}`;
        }

        let spanIdsStr = spanContext.spanId;

        if (spanContext.parentSpanId) {
            spanIdsStr += `:${spanContext.parentSpanId}`;
        }

        carrier[Tracer.CARRIER_KEY_BAGGAGE_ITEMS] = JSON.stringify(
            spanContext.baggageItems
        );
        carrier[Tracer.CARRIER_KEY_SERVICE_KEYS] = serviceKeysStr;
        carrier[Tracer.CARRIER_KEY_SPAN_IDS] = spanIdsStr;
        carrier[Tracer.CARRIER_KEY_TRACE_ID] = spanContext.traceId;

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

            spanContext = new SpanContext(this._serviceKey, {
                baggageItems: Object.assign({}, parentSpanContext.baggageItems),
                parentServiceKey: parentSpanContext.serviceKey,
                traceId: parentSpanContext.traceId,
                parentSpanId: parentSpanContext.spanId,
            });
        } else {
            spanContext = new SpanContext(this._serviceKey);
        }

        return new Span(this, operationName, spanContext, {
            tags: options.tags,
            startTime: options.startTime,
        });
    }
}

Tracer.CARRIER_KEY_BAGGAGE_ITEMS = CARRIER_KEY_BAGGAGE_ITEMS;
Tracer.CARRIER_KEY_SERVICE_KEYS = CARRIER_KEY_SERVICE_KEYS;
Tracer.CARRIER_KEY_TRACE_ID = CARRIER_KEY_TRACE_ID;
Tracer.CARRIER_KEY_SPAN_IDS = CARRIER_KEY_SPAN_IDS;

module.exports = Tracer;
