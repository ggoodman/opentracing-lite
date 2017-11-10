'use strict';

const Cuid = require('cuid');

/**
 * Generate a unique id
 */
exports.generate = () => Cuid();

/**
 * Get the timestamp embedded in a cuid
 *
 * @param {String} id
 * @returns {Number} timestamp
 */
exports.getTimestamp = id => {
    if (typeof id !== 'string' || id.length !== 25 || id[0] !== 'c')
        return 0;

    return parseInt(id.substr(1, 8), 36);
};
