'use strict';

const Assert = require('assert');
const Opentracing = require('opentracing');

const SpanContext = require('./span_context');

class Span extends Opentracing.Span {
    constructor(tracer, operationName, spanContext, options) {
        if (!options) options = {};

        Assert(
            tracer instanceof Opentracing.Tracer,
            'tracer must be a Tracer instance'
        );
        Assert(
            typeof operationName === 'string',
            'operationName must be a string'
        );
        Assert(
            spanContext instanceof SpanContext,
            'spanContext must be a SpanContext instance'
        );

        super();

        this._finishedTime = 0;
        this._operationName = operationName;
        this._spanContext = spanContext;
        this._startTime = options.startTime || Date.now();
        this._tags = options.tags || {};
        this._tracer = tracer;
    }

    _addTags(tags) {
        for (const key in tags) {
            this._tags[key] = tags[key];
        }

        return this;
    }

    _context() {
        return this._spanContext;
    }

    _finish(timestamp) {
        this._finishedTime = timestamp || Date.now();

        this._tracer.onFinishSpan(this);

        return this;
    }

    _getBaggageItem(key) {
        Assert(typeof key === 'string');

        return this._spanContext.baggageItems[key];
    }

    _log(fields, time) {
        this._tracer.onLog(this, fields, time);

        return this;
    }

    _setBaggageItem(key, value) {
        Assert(typeof key === 'string');

        this._spanContext = this._spanContext.withBaggageItem(key, value);

        return this;
    }

    _setOperationName(operationName) {
        this._operationName = operationName;

        return this;
    }

    _tracer() {
        return this._tracer;
    }

    /**
     * Get the operation name
     *
     * @returns {String} operation name
     */
    getOperationName() {
        return this._operationName;
    }
}

module.exports = Span;
