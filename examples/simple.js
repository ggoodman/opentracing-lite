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
