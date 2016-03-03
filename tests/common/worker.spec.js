'use strict';

/* globals : describe, it*/

var chai = require('chai');
var sinon = require('sinon');
var Worker = require('../../worker/worker');

var zmq = require('zmq');

var pubSocket = zmq.socket('pub');
var pullSocket = zmq.socket('pull');
var pushSocket = zmq.socket('push');

var ActionTypes = require('./../../lib/actionTypes');
var EstimationState = require('./../../lib/median-estimation-state');

var should = chai.should();
var async = require('async');
var portfinder = require('portfinder');


describe('Worker (Average):', function () {
    let sut;

    let averageCalculator = {
            calculate: (arr)=> {
            }
        },
        medianCalculator = {
            calculate: (arr, isSorted)=> {
            }
        },
        uuidProvider = {
            getNew: ()=> {
            }
        }, configurationProvider = {
            get: (key)=> {
            }
        },
        logger = {
            log: (message)=> {
            }
        }, loggerMock, uuidProviderMock, averageCalculatorMock, medianCalculatorMock, configurationProviderMock,
        config = {
            "resultPushPullSocketAddress": "tcp://127.0.0.1:",
            "pushPullSocketAddress": "tcp://127.0.0.1:",
            "pubSubSocketAddress": "tcp://127.0.0.1:"
        };

    before((done)=> {
        portfinder.basePort = 3010;
        async.parallel({
            one: callback=> {
                portfinder.getPort((err, port)=> {
                    if (err) return callback(err);

                    callback(null, port);
                });

            }, two: callback=> {
                portfinder.getPort((err, port)=> {
                    if (err) return callback(err);

                    callback(null, port);
                });
            }, three: callback=> {
                portfinder.getPort((err, port)=> {
                    if (err) return callback(err);

                    callback(null, port);
                });
            }
        }, (err, results)=> {
            if (err) return done(err);

            pubSocket.bindSync(`${config.pubSubSocketAddress}${results.one}`);
            config.pubSubSocketAddress = `${config.pubSubSocketAddress}${results.one}`;

            pushSocket.bindSync(`${config.pushPullSocketAddress}${results.two}`);
            config.pushPullSocketAddress = `${config.pushPullSocketAddress}${results.two}`;

            pullSocket.bindSync(`${config.resultPushPullSocketAddress}${results.three}`);
            config.resultPushPullSocketAddress = `${config.resultPushPullSocketAddress}${results.three}`;

            done();

        });
    });

    beforeEach(() => {

        averageCalculatorMock = sinon.mock(averageCalculator);
        medianCalculatorMock = sinon.mock(medianCalculator);
        uuidProviderMock = sinon.mock(uuidProvider);
        loggerMock = sinon.mock(logger);
        configurationProviderMock = sinon.mock(configurationProvider);

        sut = new Worker(averageCalculator, medianCalculator, uuidProvider, configurationProvider, logger);
    });

    describe("#ctor", () => {

        it("should create instance.", ()=> {
            (!!sut).should.be.equal(true);
        });
    });

    describe("#EVT calculate average", () => {

        it("should calculate average", (done)=> {
            //https://github.com/mochajs/mocha/issues/1066
            // Workaround "done() called multiple times"
            var doneCalled = false;

            averageCalculatorMock.expects('calculate').returns(1);

            setupMocks(config, ActionTypes.AVERAGE);
            sut.start();

            pullSocket.on('message', function (message) {
                var messagePayload = JSON.parse(message.toString());

                if (messagePayload.type === ActionTypes.AVERAGE)
                    messagePayload.data.avg.should.be.equal(1);

                if (!doneCalled) {
                    done();
                    doneCalled = true;
                }
            });

            pushSocket.send(JSON.stringify([1, 1, 1, 1, 1]));

            setTimeout(()=> {
                pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({type: ActionTypes.AVERAGE})]);
            }, 100);
        });
    });


    describe("#EVT calculate median", () => {
        it("should calculate median", (done)=> {
            //https://github.com/mochajs/mocha/issues/1066
            // Workaround "done() called multiple times"
            var doneCalled = false;

            let expectedMedian = 3;

            medianCalculatorMock.expects('calculate').returns(3).atLeast(1);

            setupMocks(config, ActionTypes.GET_MEDIAN);

            loggerMock.expects('log').withExactArgs(`[MEDIAN] : ${expectedMedian}`).atLeast(1);

            sut.start();

            pullSocket.on('message', function (message) {
                var messagePayload = JSON.parse(message.toString());

                if (messagePayload.type === ActionTypes.GET_MEDIAN)
                    messagePayload.data.should.be.equal(expectedMedian);

                if (!doneCalled) {
                    done();
                    doneCalled = true;
                }
            });

            pushSocket.send(JSON.stringify([1, 2, 3, 4, 5]));

            setTimeout(()=> {
                pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({type: ActionTypes.GET_MEDIAN})]);
            }, 100);
        });
    });

    describe("#EVT lower and upper counts", () => {
        it("should return lower and upper counts regarding to given estimated median", (done)=> {
            //https://github.com/mochajs/mocha/issues/1066
            // Workaround "done() called multiple times"
            var doneCalled = false;
            setupMocks(config, ActionTypes.GET_LOWER_UPPER_COUNTS);

            sut.start();

            pullSocket.on('message', function (message) {
                var messagePayload = JSON.parse(message.toString());

                if (messagePayload.type === ActionTypes.GET_LOWER_UPPER_COUNTS) {
                    messagePayload.data.lowerCount.should.be.equal(2);
                    messagePayload.data.upperCount.should.be.equal(4);
                }

                if (!doneCalled) {
                    done();
                    doneCalled = true;
                }
            });

            pushSocket.send(JSON.stringify([1, 2, 3, 4, 5, 6, 7]));

            setTimeout(()=> {
                pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({
                    type: ActionTypes.GET_LOWER_UPPER_COUNTS,
                    estimatedMedian: 3
                })]);
            }, 200);
        });
    });

    describe("#EVT log", () => {
        it("should log local cache", (done)=> {

            setupMocks(config, ActionTypes.LOG);
            loggerMock.expects('log').withExactArgs([1, 2, 3]).atLeast(1);

            sut.start();

            pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({type: ActionTypes.RESET})]);
            pushSocket.send(JSON.stringify([1, 2, 3]));

            setTimeout(()=> {
                pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({
                    type: ActionTypes.LOG
                })]);

                setTimeout(()=> {
                    done();
                }, 100);

            }, 300);
        });
    });

    describe("#EVT sort", () => {
        it("should sort local cache", (done)=> {
            //https://github.com/mochajs/mocha/issues/1066
            // Workaround "done() called multiple times"
            var doneCalled = false;

            setupMocks(config, ActionTypes.SORT);

            sut.start();

            pushSocket.send(JSON.stringify([1, 3, 2]));

            pullSocket.on('message', function (message) {
                var messagePayload = JSON.parse(message.toString());

                if (messagePayload.type === ActionTypes.SORT) {
                    messagePayload.sorted.should.be.equal(true);
                }

                if (!doneCalled) {
                    done();
                    doneCalled = true;
                }
            });

            setTimeout(()=> {
                pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({
                    type: ActionTypes.SORT
                })]);
            }, 300);
        });
    });

    describe('#EVT get exact median', () => {
        it('should return exact median regarding to given estimated median when EstimationState.TO_UPPER', (done)=> {

            setupEstimationStateTests(/*first*/4, /*second*/ -1, ActionTypes.GET_EXACT_MEDIAN, done);

            setTimeout(()=> {
                pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({
                    type: ActionTypes.GET_EXACT_MEDIAN,
                    median: 3,
                    returnFor: EstimationState.TO_UPPER
                })]);
            }, 200);
        });

        it('should return exact median regarding to given estimated median when EstimationState.TO_LOWER', (done)=> {

            setupEstimationStateTests(/*first*/3, /*second*/ -1, ActionTypes.GET_EXACT_MEDIAN, done);

            setTimeout(()=> {
                pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({
                    type: ActionTypes.GET_EXACT_MEDIAN,
                    median: 5,
                    returnFor: EstimationState.TO_LOWER
                })]);
            }, 200);
        });

        it('should return exact median regarding to given estimated median when EstimationState.EQUAL', (done)=> {

            setupEstimationStateTests(/*first*/4, /*second*/ -1, ActionTypes.GET_EXACT_MEDIAN, done);

            setTimeout(()=> {
                pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({
                    type: ActionTypes.GET_EXACT_MEDIAN,
                    median: 4,
                    returnFor: EstimationState.EQUAL
                })]);
            }, 200);
        });
    });

    describe("#stop", () => {

        it("should stop", (done)=> {
            sut.stop(err=> {
                (err === null).should.be.equal(true);

                done();
            });
        });
    });

    function setupEstimationStateTests(first, second, messageType, done) {
        //https://github.com/mochajs/mocha/issues/1066
        // Workaround "done() called multiple times"
        var doneCalled = false;
        setupMocks(config, messageType);

        sut.start();

        pullSocket.on('message', function (message) {
            var messagePayload = JSON.parse(message.toString());

            if (messagePayload.type === ActionTypes.GET_LOWER_UPPER_COUNTS) {
                messagePayload.data.first.should.be.equal(first);
                messagePayload.data.second.should.be.equal(second);
            }

            if (!doneCalled) {
                done();
                doneCalled = true;
            }
        });

        pushSocket.send(JSON.stringify([1, 2, 3, 4, 5, 6, 7]));
    }

    afterEach(()=> {
        pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({type: ActionTypes.RESET})]);

        averageCalculatorMock.verify();
        medianCalculatorMock.verify();
        uuidProviderMock.verify();
        configurationProviderMock.verify();
        loggerMock.verify();
    });

    after(()=> {
        pubSocket.close();
        pushSocket.close();
        pullSocket.close();
    });

    function setupMocks(cfg, messageType) {
        uuidProviderMock.expects('getNew').returns('TEST-UUID');
        loggerMock.expects('log').withExactArgs(`WORKER-TEST-UUID`).once();
        //loggerMock.expects('log').withExactArgs(`Received a message related to:STATS_WORKER_CHANNEL, containing message:${messageType}`).once();

        configurationProviderMock.expects('get').withArgs('zmq:pushPullSocketAddress')
            .returns(cfg.pushPullSocketAddress).once();
        configurationProviderMock.expects('get').withArgs('zmq:pubSubSocketAddress')
            .returns(cfg.pubSubSocketAddress).once();
        configurationProviderMock.expects('get').withArgs('zmq:resultPushPullSocketAddress')
            .returns(cfg.resultPushPullSocketAddress).once();
    }
});