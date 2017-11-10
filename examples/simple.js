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
