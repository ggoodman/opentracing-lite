'use strict';

const Pino = require('pino');

exports.createInspectableLogger = inspectFn =>
    Pino(
        {
            slowTime: true,
        },
        {
            write(chunk) {
                const json = JSON.parse(chunk);

                return inspectFn(json);
            },
        }
    );

exports.createNoopLogger = () => Pino({}, { write() {} });
