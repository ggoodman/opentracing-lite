'use strict';

const EVENT_NAME = 'span:start';

module.exports = class SpanStartEvent {
    constructor(span) {
        this.name = EVENT_NAME;
        this.span = span;
    }
};

module.exports.EVENT_NAME = EVENT_NAME;
