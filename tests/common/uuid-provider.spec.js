'use strict';

var chai = require("chai");
var validator = require("validator");
var UuidProvider = require("../../lib/uuid-provider");

var should = chai.should();

describe("UuidProvider:", function () {
    let sut;

    beforeEach(function () {
        sut = new UuidProvider();
    });

    describe("#ctor", function () {

        it("should create instance.", function () {
            (!!sut).should.be.equal(true);
        });
    });

    describe("#getNew", function () {

        it("should return valid uuid", () => {
            let uuid = sut.getNew();
            validator.isUUID(uuid, 4).should.be.equal(true);
        });
    });
});