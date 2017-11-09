'use strict';

const Assert = require('assert');
const Lab = require('lab');
const Logger = require('./lib/logger');
const Tracing = require('../');

const lab = (exports.lab = Lab.script());
const it = lab.it;
const describe = lab.describe;

describe('Basic usage', { parallel: true }, () => {
    it('allows logging from a span', done => {
        const logger = Logger.createInspectableLogger(json => {
            Assert(json.level === 30);
            Assert(json.msg === 'the sky is falling');
            Assert(json.hello === 'world');
            Assert(new Date(json.time) <= new Date());

            done();
        });
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');
        const spanLogger = span.logger();

        spanLogger.info({ hello: 'world' }, 'the sky is falling');
    });

    it('allows logging of different levels', done => {
        const logger = Logger.createInspectableLogger(json => {
            Assert(json.level === 40);

            done();
        });
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');
        const spanLogger = span.logger();

        spanLogger.warn('the sky is falling');
    });

    it('allows logging using the opentracing Span#log method', done => {
        const logger = Logger.createInspectableLogger(json => {
            Assert(json.level === 30);
            Assert(json.msg === 'the sky is falling');
            Assert(json.hello === 'world');
            Assert(new Date(json.time) <= new Date());

            done();
        });
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');

        span.log({
            hello: 'world',
            msg: 'the sky is falling',
        });
    });

    it('allows logging using the opentracing Span#log method while respecting custom timestamp', done => {
        const ts = Date.now();
        const logger = Logger.createInspectableLogger(json => {
            Assert(json.level === 30);
            Assert(json.msg === 'the sky is falling');
            Assert(json.hello === 'world');
            Assert(new Date(json.time).valueOf() === new Date(ts).valueOf());

            done();
        });
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');

        span.log(
            {
                hello: 'world',
                msg: 'the sky is falling',
            },
            ts
        );
    });

    it('allows logging using the opentracing Span#log method with a named level', done => {
        const logger = Logger.createInspectableLogger(json => {
            Assert(json.level === 40);
            Assert(json.msg === 'the sky is falling');
            Assert(json.hello === 'world');
            Assert(new Date(json.time) <= new Date());

            done();
        });
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');

        span.log({
            hello: 'world',
            level: 'warn',
            msg: 'the sky is falling',
        });
    });

    it('allows for creating child spans', done => {
        const logger = Logger.createInspectableLogger(json => {
            Assert(json.level === 30);
            Assert(json.msg === 'hello world');
            Assert(json.parent === undefined);
            Assert(json.child === true);
            Assert(new Date(json.time) <= new Date());
            Assert(json.span.id === childSpan.context().spanId);
            Assert(json.span.parentId === span.context().spanId);
            Assert(json.trace.id === span.context().traceId);

            done();
        });
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');
        const childSpan = tracer.startSpan('child', { childOf: span });

        span.setTag('parent', true);
        childSpan.setTag('child', true);

        const childSpanLogger = childSpan.logger();

        childSpanLogger.info('hello world');
    });
});

describe('Baggage items', { parallel: true }, () => {
    it('are propagated to child spans', done => {
        const logger = Logger.createInspectableLogger(json => {
            Assert(json.baggage === 'parent');

            done();
        });
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');

        span.setBaggageItem('baggage', 'parent');

        const childSpan = tracer.startSpan('child', { childOf: span });
        const childSpanLogger = childSpan.logger();

        childSpanLogger.info('hello world');
    });

    it('can be overwritten by child spans', done => {
        const logger = Logger.createInspectableLogger(json => {
            Assert(json.baggage === 'child');

            done();
        });
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');

        span.setBaggageItem('baggage', 'parent');

        const childSpan = tracer.startSpan('child', { childOf: span });

        childSpan.setBaggageItem('baggage', 'child');

        const childSpanLogger = childSpan.logger();

        childSpanLogger.info('hello world');
    });
});

describe('Cross-process serialization', { parallel: true }, () => {
    it('can be used to inject a span into http headers', done => {
        const logger = Logger.createNoopLogger();
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');

        const headers = {};

        tracer.inject(span, Tracing.FORMAT_HTTP_HEADERS, headers);

        Assert(
            headers[Tracing.Tracer.CARRIER_KEY_BAGGAGE_ITEMS] ===
                JSON.stringify({})
        );
        Assert(headers[Tracing.Tracer.CARRIER_KEY_SERVICE_KEYS] === 'test');
        Assert(
            headers[Tracing.Tracer.CARRIER_KEY_SPAN_IDS] ===
                span.context().spanId
        );
        Assert(
            headers[Tracing.Tracer.CARRIER_KEY_TRACE_ID] ===
                span.context().traceId
        );

        done();
    });

    it('can revive serialized state', done => {
        const logger = Logger.createNoopLogger();
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');

        const headers = {};

        tracer.inject(span, Tracing.FORMAT_HTTP_HEADERS, headers);

        const revivedSpanContext = tracer.extract(Tracing.FORMAT_HTTP_HEADERS, headers);

        Assert.deepEqual(span.context(), revivedSpanContext);

        done();
    });

    it('can revive serialized state with baggage items', done => {
        const logger = Logger.createNoopLogger();
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');

        span.setBaggageItem('baggage', 'item');

        const headers = {};

        tracer.inject(span, Tracing.FORMAT_HTTP_HEADERS, headers);

        const revivedSpanContext = tracer.extract(Tracing.FORMAT_HTTP_HEADERS, headers);

        Assert.deepEqual(span.context(), revivedSpanContext);

        done();
    });

    it('can revive serialized state including childOf relationships', done => {
        const logger = Logger.createNoopLogger();
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');
        const childSpan = tracer.startSpan('child', { childOf: span });

        childSpan.setBaggageItem('child', true);

        const headers = {};

        tracer.inject(childSpan, Tracing.FORMAT_HTTP_HEADERS, headers);

        const revivedChildSpanContext = tracer.extract(Tracing.FORMAT_HTTP_HEADERS, headers);

        Assert.deepEqual(childSpan.context(), revivedChildSpanContext);

        done();
    });

    it('works correctly when logging from revived SpanContexts', done => {
        const logger = Logger.createInspectableLogger(json => {
            Assert(json.level === 30);
            Assert(json.msg === 'hello world');
            Assert(json.child === true);
            Assert(json.revived === true);
            Assert(new Date(json.time) <= new Date());
            Assert(json.span.id === revivedSpanChild.context().spanId);
            Assert(json.span.parentId === childSpan.context().spanId);
            Assert(json.trace.id === span.context().traceId);
            Assert(json.trace.id === childSpan.context().traceId);
            Assert(json.trace.id === revivedSpanChild.context().traceId);

            done();
        });
        const tracer = new Tracing.Tracer('test', logger);
        const span = tracer.startSpan('span');
        const childSpan = tracer.startSpan('child', { childOf: span });

        childSpan.setBaggageItem('child', true);

        const headers = {};

        tracer.inject(childSpan, Tracing.FORMAT_HTTP_HEADERS, headers);

        const revivedChildSpanContext = tracer.extract(Tracing.FORMAT_HTTP_HEADERS, headers);
        const revivedSpanChild = tracer.startSpan('revived', { childOf: revivedChildSpanContext });

        revivedSpanChild.setBaggageItem('revived', true);

        revivedSpanChild.logger().info('hello world');
    });
});
