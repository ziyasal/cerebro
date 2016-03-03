'use strict';

var chai = require("chai");
var MedianCalculator = require("../../lib/median-calculator");

var should = chai.should();

describe("MedianCalculator:", function () {
    let sut;

    beforeEach(function () {
        sut = new MedianCalculator();
    });

    describe("#ctor", function () {

        it("should create instance.", function () {
            (!!sut).should.be.equal(true);
        });
    });

    describe("#calculate", function () {

        it("should throw `Error` when values(Array) parameter is invalid.", () => {
            try {
                sut.calculate('TEST');
            } catch (err) {
                err.should.be.instanceOf(Error);
                err.message.should.be.equal('`values` should be an Array.');
            }
        });

        it("should throw `Error` when isSorted(boolean) parameter is invalid.", () => {
            try {
                sut.calculate([1, 2, 3], 'TEST');
            } catch (err) {
                err.should.be.instanceOf(Error);
                err.message.should.be.equal('`isSorted` should be boolean.');
            }
        });

        it("should throw `Error` when given array is empty.", () => {
            try {
                sut.calculate([], true);
            } catch (err) {
                err.should.be.instanceOf(Error);
                err.message.should.be.equal('`values` array should contain items');
            }
        });

        it("should sort before when given array not sorted", () => {
            let median = sut.calculate([1, 4, 2], false);
            median.should.be.equal(2);
        });

        it("should return median for given array", () => {
            let median = sut.calculate([1, 2, 3], true);
            median.should.be.equal(2);
        });

        it("should return mid two numbers average as median given array length is even", () => {
            let median = sut.calculate([1, 2, 3, 4], true);
            median.should.be.equal(2.5);
        });
    });
});