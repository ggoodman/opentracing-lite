'use strict';

const Opentracing = require('opentracing');
const Uuid = require('uuid');

class SpanContext extends Opentracing.SpanContext {
    constructor(serviceKey, options) {
        super();

        if (!options) options = {};

        this.baggageItems = options.baggageItems || {};
        this.serviceKey = serviceKey;
        this.parentServiceKey = options.parentServiceKey;
        this.traceId = options.traceId || Uuid.v4();
        this.spanId = options.spanId || Uuid.v4();
        this.parentSpanId = options.parentSpanId;
    }
}

module.exports = SpanContext;
