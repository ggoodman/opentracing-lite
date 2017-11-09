const Pino = require('pino'); // Could be bunyan as well
const Tracing = require('../');

const logger = Pino();
const tracer = new Tracing.Tracer('simple', logger);

// Let's create a new span to represent a logical operation
const span = tracer.startSpan('top-level operation');

// Something important happens and we want to emit a log message with tracing data attached
span.logger().info({ meta: 'data' }, 'something important happened');
span.finish();
