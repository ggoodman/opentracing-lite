'use strict';

const Assert = require('assert');
const Lab = require('lab');
const Tracing = require('../');

const lab = (exports.lab = Lab.script());
const it = lab.it;
const describe = lab.describe;

describe('Basic usage', { parallel: true }, () => {
    it('will invoke the onStartSpan hook', done => {
        const tracer = new Tracing.Tracer({
            onStartSpan(event) {
                const span = event.span;

                Assert(span.getOperationName('span'));
                done();
            },
        });

        tracer.startSpan('span');
    });

    it('will invoke the onFinishSpan hook', done => {
        const tracer = new Tracing.Tracer({
            onFinishSpan(event) {
                const span = event.span;

                Assert(span.getOperationName('span'));
                done();
            },
        });
        tracer.startSpan('span').finish();
    });
});

describe('Cross-process serialization', { parallel: true }, () => {
    it('can be used to inject a span into http headers', done => {
        const tracer = new Tracing.Tracer({
            onInjectSpanContext(event) {
                Assert(event.carrier === headers);
                Assert(event.format === Tracing.FORMAT_HTTP_HEADERS);
                Assert(event.spanContext === span.context());

                Assert(
                    event.carrier[Tracing.Tracer.CARRIER_KEY_BAGGAGE_ITEMS] ===
                        JSON.stringify({})
                );
                Assert(
                    event.carrier[Tracing.Tracer.CARRIER_KEY_SPAN_IDS] ===
                        span.context().spanId
                );
                Assert(
                    event.carrier[Tracing.Tracer.CARRIER_KEY_TRACE_ID] ===
                        span.context().traceId
                );

                done();
            },
        });
        const span = tracer.startSpan('span');
        const headers = {};

        tracer.inject(span, Tracing.FORMAT_HTTP_HEADERS, headers);
    });

    it('can revive serialized state', done => {
        const tracer = new Tracing.Tracer({
            onExtractSpanContext(event) {
                Assert(event.carrier === headers);
                Assert(event.format === Tracing.FORMAT_HTTP_HEADERS);

                Assert.deepEqual(span.context(), event.spanContext);

                done();
            },
        });
        const span = tracer.startSpan('span');
        const headers = {};

        tracer.inject(span, Tracing.FORMAT_HTTP_HEADERS, headers);
        tracer.extract(
            Tracing.FORMAT_HTTP_HEADERS,
            headers
        );
    });

    it('can revive serialized state with baggage items', done => {
        const tracer = new Tracing.Tracer();
        const span = tracer.startSpan('span');

        span.setBaggageItem('baggage', 'item');

        const headers = {};

        tracer.inject(span, Tracing.FORMAT_HTTP_HEADERS, headers);

        const revivedSpanContext = tracer.extract(
            Tracing.FORMAT_HTTP_HEADERS,
            headers
        );

        Assert.deepEqual(span.context(), revivedSpanContext);

        done();
    });

    it('can revive serialized state including childOf relationships', done => {
        const tracer = new Tracing.Tracer();
        const span = tracer.startSpan('span');
        const childSpan = tracer.startSpan('child', { childOf: span });

        childSpan.setBaggageItem('child', true);

        const headers = {};

        tracer.inject(childSpan, Tracing.FORMAT_HTTP_HEADERS, headers);

        const revivedChildSpanContext = tracer.extract(
            Tracing.FORMAT_HTTP_HEADERS,
            headers
        );

        Assert.deepEqual(childSpan.context(), revivedChildSpanContext);

        done();
    });
});
