'use strict';

const Stringify = require('fast-safe-stringify');

exports.parse = json => {
    if (!json) return {};

    try {
        return JSON.parse(json);
    } catch (__) {
        return {};
    }
};

exports.stringify = Stringify;
