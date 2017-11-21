'use strict';

const EVENT_NAME = 'span:finish';

module.exports = class SpanFinishEvent {
    constructor(span) {
        this.name = EVENT_NAME;
        this.span = span;
    }
};

module.exports.EVENT_NAME = EVENT_NAME;
