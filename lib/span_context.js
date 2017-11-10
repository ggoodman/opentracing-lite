'use strict';

const Opentracing = require('opentracing');

const Id = require('./id');

class SpanContext extends Opentracing.SpanContext {
    constructor(options) {
        super();

        if (!options) options = {};

        this._baggageItems = options.baggageItems || {};
        this._traceId = options.traceId || Id.generate();
        this._spanId = options.spanId || Id.generate();
        this._parentSpanId = options.parentSpanId;
    }

    get baggageItems() {
        return this._baggageItems;
    }

    get traceId() {
        return this._traceId;
    }

    get spanId() {
        return this._spanId;
    }

    get parentSpanId() {
        return this._parentSpanId;
    }

    withBaggageItem(key, value) {
        const baggageItems = Object.assign({}, this._baggageItems);

        baggageItems[key] = value;

        return new SpanContext({
            baggageItems,
            traceId: this._traceId,
            spanId: this._spanId,
            parentSpanId: this._parentSpanId,
        });
    }
}

module.exports = SpanContext;
