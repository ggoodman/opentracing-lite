'use strict';

const Opentracing = require('opentracing');
const Uuid = require('uuid');

class SpanContext extends Opentracing.SpanContext {
    constructor(options) {
        super();

        if (!options) options = {};

        this.baggageItems = options.baggageItems || {};
        this.traceId = options.traceId || Uuid.v4();
        this.spanId = options.spanId || Uuid.v4();
        this.parentSpanId = options.parentSpanId;
    }
}

module.exports = SpanContext;
