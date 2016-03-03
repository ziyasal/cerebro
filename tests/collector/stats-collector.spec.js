'use strict';

var chai = require("chai");
var sinon = require("sinon");
var _ = require("lodash");

var StatsCollector = require("../../master/stats-collector");
var Worker = require('../../worker/worker');

var should = chai.should();
var async = require('async');
var portfinder = require('portfinder');

describe("StatsCollector :", () => {
    let sut, worker, workerSize = 1, batchSize = 10,
        averageCalculator = {
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

        medianCalculatorMock = sinon.mock(medianCalculator);
        configurationProviderMock = sinon.mock(configurationProvider);
        loggerMock = sinon.mock(logger);
        averageCalculatorMock = sinon.mock(averageCalculator);
        uuidProviderMock = sinon.mock(uuidProvider);

        portfinder.basePort = 3020;
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

            config.pubSubSocketAddress = `${config.pubSubSocketAddress}${results.one}`;
            config.pushPullSocketAddress = `${config.pushPullSocketAddress}${results.two}`;
            config.resultPushPullSocketAddress = `${config.resultPushPullSocketAddress}${results.three}`;

            setupMocks();

            sut = new StatsCollector(medianCalculator, configurationProvider, logger);
            worker = new Worker(averageCalculator, medianCalculator, uuidProvider, configurationProvider, logger);

            worker.start();

            sut.start((err)=> {
                if (err) return done(err);

                done();
            });
        });
    });

    beforeEach(() => {

    });

    describe("#ctor", () => {

        it("should create instance.", function () {
            (!!sut).should.be.equal(true);
        });

    });

    describe("#getMedian", () => {
        it("should calculate median.", (done)=> {
                var expectedMedian = 4;

                medianCalculatorMock.expects('calculate').returns(expectedMedian).atLeast(1);
                loggerMock.expects('log').withExactArgs(`[MEDIAN] : ${expectedMedian}`).atLeast(1);

                let responseTimes = _.range(1, 8);

                responseTimes.forEach((element, index) => {
                    sut.pushValue(element, (index === responseTimes.length - 1));
                });

                setTimeout(()=> {
                    sut.getMedian((median)=> {
                        median.should.be.equal(4);
                        done();
                    })
                }, 4000);
            }
        );
    });

    describe("#getAverage", () => {
        it("should calculate average.", (done) => {

            let expectedAvg = 1;
            averageCalculatorMock.expects('calculate').returns(expectedAvg).atLeast(1);

            let responseTimes = [1, 1, 1, 1];

            responseTimes.forEach((element, index) => {
                sut.pushValue(element, (index === responseTimes.length - 1));
            });

            setTimeout(()=> {
                sut.getAverage((avg)=> {
                    avg.should.be.equal(expectedAvg);
                    done();
                })
            }, 3000);
        });
    });


    afterEach(()=> {
        sut.resetWorkers();
    });


    after((done)=> {
        loggerMock.verify();
        configurationProviderMock.verify();
        medianCalculatorMock.verify();
        averageCalculatorMock.verify();
        uuidProviderMock.verify();

        async.parallel([callback=> {
            sut.stop((err)=> {
                if (err) return callback(err);

                callback(null);
            });
        }, callback=> {
            worker.stop((err)=> {
                if (err) return callback(err);

                callback(null);
            });
        }], (err)=> {
            if (err) return done(err);

            done();
        });
    });

    function setupMocks() {
        configurationProviderMock.expects('get').withArgs('zmq:pushPullSocketAddress')
            .returns(config.pushPullSocketAddress).atLeast(1);
        configurationProviderMock.expects('get').withArgs('zmq:pubSubSocketAddress')
            .returns(config.pubSubSocketAddress).atLeast(1);

        configurationProviderMock.expects('get').withArgs('zmq:resultPushPullSocketAddress')
            .returns(config.resultPushPullSocketAddress).atLeast(1);
        configurationProviderMock.expects('get').withArgs('workerSize').returns(workerSize).atLeast(1);

        configurationProviderMock.expects('get').withArgs('batchSize').returns(batchSize).atLeast(1);
        uuidProviderMock.expects('getNew').returns('TEST-UUID').atLeast(1);


        loggerMock.expects('log').withExactArgs(`WORKER-TEST-UUID`).once();
        loggerMock.expects('log').withExactArgs('Bind operation completed for all sockets').atLeast(1);
    }
});