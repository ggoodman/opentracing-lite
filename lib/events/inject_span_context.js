'use strict';

const EVENT_NAME = 'span_context:inject';

module.exports = class InjectSpanContextEvent {
    constructor(spanContext, format, carrier) {
        this.name = EVENT_NAME;
        this.spanContext = spanContext;
        this.format = format;
        this.carrier = carrier;
    }
};

module.exports.EVENT_NAME = EVENT_NAME;
