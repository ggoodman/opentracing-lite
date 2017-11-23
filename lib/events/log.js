'use strict';

const EVENT_NAME = 'log';

module.exports = class LogEvent {
    constructor(span, fields, timestamp) {
        this.fields = Object.assign({}, fields);
        this.name = EVENT_NAME;
        this.span = span;
        this.timestamp = isNaN(timestamp) ? Date.now() : timestamp;
    }
};

module.exports.EVENT_NAME = EVENT_NAME;
