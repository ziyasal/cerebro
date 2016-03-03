'use strict';

/**
 * Calculates median of given array
 */
class MedianCalculator {
    calculate(values, isSorted) {

        if (values === undefined || (values instanceof Array) === false) {
            throw new Error('`values` should be an Array.');
        }

        if (values.length === 0) {
            throw  new Error('`values` array should contain items');
        }
        if (isSorted === undefined || typeof(isSorted) !== 'boolean') {
            throw new Error('`isSorted` should be boolean.');
        }

        if (!isSorted) {
            values.sort(function (a, b) {
                return a - b;
            });
        }
        var half = Math.floor(values.length / 2);
        if (values.length % 2)
            return values[half];
        else
            return (values[half - 1] + values[half]) / 2.0;
    }
}

/**
 * exports
 * @type {MedianCalculator}
 */
module.exports = MedianCalculator;