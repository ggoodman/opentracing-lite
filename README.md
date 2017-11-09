# An [opentracing](http://opentracing.io)-compliant logging solution

This module provides a mechanism to automatically attach distributed tracing information to [bunyan](https://www.npmjs.com/package/bunyan)-compatible logger that can cross process boundaries. The module implements the `Tracer#inject` and `Tracer#extract` methods that allow serlializing and reviving tracer metadata, respectively.

> Note: This module is also designed to also work with bunyan-compatible loggers like [pino](https://www.npmjs.com/package/pino).

## Examples

### Log a message that is associated with a trace

```js
'use strict';

const Pino = require('pino'); // Could be bunyan as well
const Tracing = require('../');

const logger = Pino();
const tracer = new Tracing.Tracer(logger);

// Let's create a new span to represent a logical operation
const span = tracer.startSpan('top-level operation');

// Something important happens and we want to emit a log message with tracing data attached
span.logger().info({ meta: 'data' }, 'something important happened');
span.finish();
```

### Serialize a trace across an http request

Here we are simulating two processes -- one that is an http server and another that is a client of that server. We will start a trace in the client that will be propagated through to the server using http headers as a transport.

Logging messages on both the client and server will have tracing metadata that allows correlating events across process boundaries.

```js
'use strict';

const Http = require('http');
const Pino = require('pino'); // Could be bunyan as well
const Tracing = require('../');
const Wreck = require('wreck');

const logger = Pino();

const createServer = cb => {
    const tracer = new Tracing.Tracer(logger);

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
        });

        span.logger().info('received hello world request');

        res.writeHead(200);
        res.end('hello world');

        // Make sure we log errors and finish the span
        res.on('error', err => {
            span.logger().error({ err }, 'error sending response');
            span.finish();
        });
        res.on('finish', () => span.finish());
    });

    server.listen(8080, () => {
        // This will not show any tracing info since we are
        // using the underlying logger.
        logger.info('server started');

        cb(() => server.close());
    });
};

const runClient = cb => {
    const tracer = new Tracing.Tracer(logger);
    // We are about to invoke a remote api that we will associate with
    // a span. All spans derived from this invocation will share a
    // common traceId while each span will have a distinct spanId.
    const span = tracer.startSpan('hello world client request');

    span.logger().info('invoking hello world service');

    const headers = {};

    // IMPORTANT: Here is where we are encoding the current trace context
    // in a way that can cross process boundaries using http headers.
    tracer.inject(span, Tracing.FORMAT_HTTP_HEADERS, headers);

    Wreck.get('http://localhost:8080', { headers }, (err, res, data) => {
        if (err) {
            span.logger().error({ err }, 'error invoking hello world service');
            span.finish();
            return cb(err);
        }

        span
            .logger()
            .info(
                { data: data.toString('utf8'), statusCode: res.statusCode },
                'received hello world response'
            );
        span.finish();

        cb();
    });
};

createServer(cb => runClient(cb));
```
