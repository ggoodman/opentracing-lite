'use strict';

const Opentracing = require('opentracing');

const Span = require('./lib/span');
const SpanContext = require('./lib/span_context');
const Tracer = require('./lib/tracer');

exports.Span = Span;
exports.SpanContext = SpanContext;
exports.Tracer = Tracer;
exports.FORMAT_BINARY = Opentracing.FORMAT_BINARY;
exports.FORMAT_HTTP_HEADERS = Opentracing.FORMAT_HTTP_HEADERS;
exports.FORMAT_TEXT_MAP = Opentracing.FORMAT_TEXT_MAP;
