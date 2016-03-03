'use strict';

/**
 * Calculates average of given array
 */
class AverageCalculator {
    calculate(values) {
        if (values && values instanceof Array) {

            var sum = values.reduce(function (a, b) {
                return a + b;
            });

            return sum / values.length
        }
        else throw new Error('`values` should be an Array.');
    }
}

/**
 *  exports
 * @type {AverageCalculator}
 */
module.exports = AverageCalculator;