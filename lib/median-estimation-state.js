/**
 * Median Estimation Direction Enum
 * @type {{NONE: number, TO_UPPER: number, TO_LOWER: number, EQUAL: number}}
 */
var upperLowerState = {
    NONE: 0,
    TO_UPPER: 1,
    TO_LOWER: 2,
    EQUAL: 3
};

/**
 * Enum
 * @type {{NONE: number, TO_UPPER: number, TO_LOWER: number, EQUAL: number}}
 */
module.exports = upperLowerState;