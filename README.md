# An simple [opentracing](http://opentracing.io) implementation

This module provides very basic implementation of an opentracing client.

## Examples

### Log a message that is associated with a trace

`npm run example:simple`

```js
'use strict';

const Pino = require('pino');
const Tracing = require('../');

const logger = Pino({ serializers: Pino.stdSerializers });
const tracer = new Tracing.Tracer({
    onStartSpan(span) {
        logger.info(span.toJSON(), `started ${span.getOperationName()}`);
    },
    onFinishSpan(span) {
        logger.info(span.toJSON(), `finished ${span.getOperationName()}`);
    },
});

// Let's create a new span to represent a logical operation
const span = tracer.startSpan('top-level operation');

// Something important happens and we want to emit a log message with tracing data attached
logger.warn(span.toJSON(), 'something strange happened');

span.setTag('err', new Error('The sky is falling'));

span.finish();
```

### Serialize a trace across an http request

Here we are simulating two processes -- one that is an http server and another that is a client of that server. We will start a trace in the client that will be propagated through to the server using http headers as a transport.

Logging messages on both the client and server will have tracing metadata that allows correlating events across process boundaries.

`npm run example:http`

```js
'use strict';

const Http = require('http');
const Pino = require('pino'); // Could be bunyan as well
const Tracing = require('../');
const Wreck = require('wreck');

const logger = Pino();
const tracer = new Tracing.Tracer({
    onStartSpan(span) {
        logger.info(span.toJSON(), `started ${span.getOperationName()}`);
    },
    onFinishSpan(span) {
        logger.info(span.toJSON(), `finished ${span.getOperationName()}`);
    },
});

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
        });

        // span.addTags({ req, res });

        res.writeHead(200);
        res.end('hello world');

        // Make sure we log errors and finish the span
        res.on('error', error => {
            span.error({ error }, 'error sending response');
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
            logger.error({ error, span }, 'error invoking hello world service');
            span.finish();
            return cb(error);
        }

        span.addTags({
            data: data.toString('utf8'),
            statusCode: res.statusCode,
        });
        span.finish();

        cb();
    });
};

createServer(cb => runClient(cb));
```
