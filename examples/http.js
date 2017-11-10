'use strict';

const Http = require('http');
const Wreck = require('wreck');

const Logging = require('./lib/logging');
const Tracing = require('../');

const logger = Logging.createLogger();
const tracer = Logging.createLoggingTracer(logger);

const createServer = cb => {
    // Set up a server that will start a child span from metadata
    // obtained from request headers
    const server = Http.createServer((req, res) => {
        // IMPORTANT: Here is where we are restoring the tracing
        // context that has been passed across process boundaries
        // using http headers.
        const parentSpanContext = tracer.extract(
            Tracing.FORMAT_HTTP_HEADERS,
            req.headers
        );

        // Next create a new child span of the extracted context
        const span = tracer.startSpan('get hello world', {
            childOf: parentSpanContext,
            tags: { req },
        });

        // 50% of the time, let's generate a fake error
        if (Math.random() < 0.5) {
            res.writeHead(204);
            res.end();
        } else {
            res.writeHead(200);
            res.end('hello world');
        }

        // Make sure we log errors and finish the span
        res.on('error', error => {
            span.addTags({ error, level: 'error' });
            span.finish();
        });
        res.on('finish', () => {
            span.addTags({ res });
            span.finish();
        });
    });

    server.listen(8080, () => {
        // This will not show any tracing info since we are
        // using the underlying logger.
        logger.info('server started');

        cb(() => server.close());
    });
};

const runClient = cb => {
    // We are about to invoke a remote api that we will associate with
    // a span. All spans derived from this invocation will share a
    // common traceId while each span will have a distinct spanId.
    const span = tracer.startSpan('hello world client request');
    const headers = {};

    // IMPORTANT: Here is where we are encoding the current trace context
    // in a way that can cross process boundaries using http headers.
    tracer.inject(span, Tracing.FORMAT_HTTP_HEADERS, headers);

    Wreck.get('http://localhost:8080', { headers }, (error, res, data) => {
        if (error) {
            span.addTags({ error, level: 'error' });
            span.finish();

            return cb(error);
        } else if (res.statusCode !== 200) {
            const error = new Error('Unexpected status code from client');

            span.addTags({ error, level: 'error', res });
            span.finish();

            return cb(error);
        }

        span.addTags({ res, data: data.toString('utf8') });
        span.finish();

        cb();
    });
};

createServer(cb => runClient(cb));
