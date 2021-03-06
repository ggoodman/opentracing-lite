# An simple [opentracing](http://opentracing.io) implementation

This module provides very basic implementation of an opentracing client.

## Examples

### Log a message that is associated with a trace

`npm run example:simple`

<!-- AUTO-GENERATED-CONTENT:START (CODE:src=./examples/simple.js) -->
<!-- The below code snippet is automatically added from ./examples/simple.js -->
```js
'use strict';

const Logging = require('./lib/logging');

const logger = Logging.createLogger();
const tracer = Logging.createLoggingTracer(logger);

// Let's create a new span to represent a logical operation
const span = tracer.startSpan('top-level operation');

// Something important happens and we want to emit a log message with tracing data attached
logger.warn({ span }, 'something strange happened');

// Imagine that our application generated an error that
// we want to attach to the span. We also want to mark
// the span's level tag as error to adjust how the span's
// finish event will be logged
const error = new Error('The sky is falling')
span.addTags({ error, level: 'error' });

span.finish();
```
<!-- AUTO-GENERATED-CONTENT:END -->

### Serialize a trace across an http request

Here we are simulating two processes -- one that is an http server and another that is a client of that server. We will start a trace in the client that will be propagated through to the server using http headers as a transport.

Logging messages on both the client and server will have tracing metadata that allows correlating events across process boundaries.

`npm run example:http`

<!-- AUTO-GENERATED-CONTENT:START (CODE:src=./examples/http.js) -->
<!-- The below code snippet is automatically added from ./examples/http.js -->
```js
'use strict';

const Domain = require('domain');
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
        const domain = Domain.create();

        domain.add(req);
        domain.add(res);
        domain.on('error', error => {
            Logging.logInflightTracesOnUncaught(error, req, res);

            if (!res.headersSent) {
                res.writeHead(500);
                res.end('Server error');
            }

            return server.close(error => {
                if (error) {
                    logger.error(
                        { error },
                        'error stopping server after uncaught exception'
                    );
                }

                logger.info('server stopped');

                return process.exit(1);
            });
        });

        return domain.run(handleRequest.bind(this, req, res));
    });

    server.listen(() => {
        // This will not show any tracing info since we are
        // using the underlying logger.
        logger.info('server started');

        cb(server, () => server.close());
    });
};

const handleRequest = (req, res) => {
    // IMPORTANT: Here is where we are restoring the tracing
    // context that has been passed across process boundaries
    // using http headers.
    const parentSpanContext = tracer.extract(
        Tracing.FORMAT_HTTP_HEADERS,
        req.headers
    );

    // Next create a new child span of the extracted context
    const span = tracer.startSpan(`${req.method} ${req.url}`, {
        childOf: parentSpanContext,
        tags: { req },
    });

    req.span = res.span = span;

    // 50% of the time, let's generate a fake error
    if (Math.random() < 0.5) {
        throw new Error("This can't be good");
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
};

const runClient = (server, cb) => {
    // We are about to invoke a remote api that we will associate with
    // a span. All spans derived from this invocation will share a
    // common traceId while each span will have a distinct spanId.
    const span = tracer.startSpan('hello world client request');
    const headers = {};

    // IMPORTANT: Here is where we are encoding the current trace context
    // in a way that can cross process boundaries using http headers.
    tracer.inject(span, Tracing.FORMAT_HTTP_HEADERS, headers);

    Wreck.request(
        'GET',
        `http://localhost:${server.address().port}`,
        { headers },
        (error, res) => {
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

            return Wreck.read(res, {}, (error, data) => {
                if (error) {
                    span.addTags({ error, level: 'error' });
                    span.finish();

                    return cb(error);
                }

                span.addTags({ res, data: data.toString('utf8') });
                span.finish();

                cb();
            });
        }
    );
};

createServer(runClient);
```
<!-- AUTO-GENERATED-CONTENT:END -->
