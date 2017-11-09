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
    }

    _context() {
        return this._spanContext;
    }

    _finish(timestamp) {
        this._finishedTime = timestamp || Date.now();

        this.logger().info(`finished ${this._operationName}`);
    }

    _getBaggageItem(key) {
        Assert(typeof key === 'string');

        return this.context().baggageItems[key];
    }

    _log(fields, timestamp) {
        const level = fields.level || 'info';

        delete fields.level;

        if (timestamp) {
            fields.time = new Date(timestamp).toISOString();
        }

        const logger = this.logger();
        const method = logger[level];

        if (typeof method === 'function') {
            return void method.call(logger, fields);
        }
    }

    _setBaggageItem(key, value) {
        Assert(typeof key === 'string');

        this.context().baggageItems[key] = value;
    }

    _setOperationName(operationName) {
        this._operationName = operationName;
    }

    _tracer() {
        return this._tracer;
    }

    logger() {
        const spanContext = this.context();
        const traceData = {
            trace: {
                id: spanContext.traceId,
                serviceKey: spanContext.serviceKey,
                parentServiceKey: spanContext.parentServiceKey,
            },
            span: {
                id: spanContext.spanId,
                elapsed: Date.now() - this._startTime,
                finished: this._finishedTime !== 0,
                operationName: this._operationName,
                parentId: spanContext.parentSpanId,
            },
        };

        const childLoggerOptions = Object.assign(
            traceData,
            spanContext.baggageItems,
            this._tags
        );

        const childLogger = this._tracer.logger.child(childLoggerOptions);

        Assert.ok(typeof childLogger.trace === 'function');
        Assert.ok(typeof childLogger.debug === 'function');
        Assert.ok(typeof childLogger.info === 'function');
        Assert.ok(typeof childLogger.warn === 'function');
        Assert.ok(typeof childLogger.error === 'function');
        Assert.ok(typeof childLogger.fatal === 'function');

        return childLogger;
    }
}

module.exports = Span;
