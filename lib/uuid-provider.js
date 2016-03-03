'use strict';
var uuid = require('node-uuid');

/**
 * Provides new UUID -v4
 */
class UuidProvider {
    getNew() {
        return uuid.v4()
    }
}

/**
 *exports
 * @type {UuidProvider}
 */
module.exports = UuidProvider;
