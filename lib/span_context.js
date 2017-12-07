'use strict';

const Opentracing = require('opentracing');

const Id = require('./id');

const DELIMITER = ':';

class SpanContext extends Opentracing.SpanContext {
    constructor(options) {
        super();

        if (!options) options = {};

        this._baggageItems = options.baggageItems || {};
        this._traceId = options.traceId || Id.generate();
        this._spanId =
            options.spanId ||
            (options.parentSpanId
                ? `${options.parentSpanId}${DELIMITER}${Id.generate()}`
                : Id.generate());
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

SpanContext.DELIMITER = DELIMITER;

module.exports = SpanContext;
