'use strict';

const Opentracing = require('opentracing');

const Span = require('./lib/span');
const SpanContext = require('./lib/span_context');
const Tracer = require('./lib/tracer');

const ExtractSpanContextEvent = require('./lib/events/extract_span_context');
const FinishSpanEvent = require('./lib/events/finish_span');
const InjectSpanContextEvent = require('./lib/events/inject_span_context');
const StartSpanEvent = require('./lib/events/start_span');

exports.FORMAT_BINARY = Opentracing.FORMAT_BINARY;
exports.FORMAT_HTTP_HEADERS = Opentracing.FORMAT_HTTP_HEADERS;
exports.FORMAT_TEXT_MAP = Opentracing.FORMAT_TEXT_MAP;

exports.Span = Span;
exports.SpanContext = SpanContext;
exports.Tracer = Tracer;

exports.events = {
    ExtractSpanContextEvent,
    FinishSpanEvent,
    InjectSpanContextEvent,
    StartSpanEvent,
};
