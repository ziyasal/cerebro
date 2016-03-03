'use strict';

var chai = require("chai");
var AverageCalculator = require("../../lib/average-calculator");

var should = chai.should();

describe("AverageCalculator:", function () {
    let sut;

    beforeEach(function () {
        sut = new AverageCalculator();
    });

    describe("#ctor", function () {

        it("should create instance.", function () {
            (!!sut).should.be.equal(true);
        });
    });

    describe("#calculate", function () {

        it("should throw `Error` when parameter is invalid.", () => {
            try {
                sut.calculate('TEST');
            } catch (err) {
                err.should.be.instanceOf(Error);
                err.message.should.be.equal('`values` should be an Array.');
            }
        });

        it("should return average for given array", () => {
            let avg = sut.calculate([1, 1, 1, 1, 1]);
            avg.should.be.equal(1);
        });
    });
});