'use strict';

var zmq = require('zmq');

var pullSocket = zmq.socket('pull');
var subSocket = zmq.socket('sub');
var resultPublisherSocket = zmq.socket('push');

var EstimatedMedianState = require('./../lib/median-estimation-state');
var ActionTypes = require('./../lib/actionTypes');

/**
 * Worker
 */
class Worker {
    constructor(averageCalculator, medianCalculator, uuidProvider, configurationProvider, logger) {
        this._averageCalculator = averageCalculator;
        this._medianCalculator = medianCalculator;
        this._configurationProvider = configurationProvider;
        this._logger = logger;
        this._uuidProvider = uuidProvider;
        this._localDataCache = [];
    }

    /**
     * Starts worker and connects to sockets
     */
    start() /* void */ {
        this.name = `WORKER-${this._uuidProvider.getNew()}`;
        this._logger.log(this.name);

        pullSocket.connect(this._configurationProvider.get('zmq:pushPullSocketAddress'));

        //STATS_WORKER_CHANNEL handler
        subSocket.connect(this._configurationProvider.get('zmq:pubSubSocketAddress'));
        subSocket.subscribe('STATS_WORKER_CHANNEL');

        //Result Publisher Socket
        resultPublisherSocket.connect(this._configurationProvider.get('zmq:resultPushPullSocketAddress'));

        this._initSocketEventHandlers();
    }

    /**
     * Dispose resources
     */
    stop(cb) /* void */ {
        try {
            resultPublisherSocket.close();
            subSocket.close();
            pullSocket.close();
            cb(null);
        }
        catch (err) {
            cb(err);
        }
    }

    /**
     * Initializes socket event handlers
     * @private
     */
    _initSocketEventHandlers() {
        pullSocket.on('message', (msg) => {
            var responseStatsArray = JSON.parse(msg.toString());
            //this._logger.log(responseStatsArray);
            this._localDataCache = this._localDataCache.concat(responseStatsArray);
        });

        subSocket.on('message', (topic, message) => {

                var messagePayload = JSON.parse(message.toString());
                //this._logger.log(`Received a message related to:${topic.toString()}, containing message:${message.toString()}`);

                switch (messagePayload.type) {
                    case ActionTypes.SORT:
                    {
                        this._sortHandler(messagePayload);
                        break;
                    }
                    case ActionTypes.GET_MEDIAN:
                    {
                        this._getMedianHandler(messagePayload);
                        break;
                    }
                    case ActionTypes.GET_LOWER_UPPER_COUNTS:
                    {
                        this._getLowerUpperCountsHandler(messagePayload);
                        break;
                    }
                    case ActionTypes.GET_EXACT_MEDIAN:
                    {
                        this._getExactMedianHandler(messagePayload);
                        break;
                    }
                    case ActionTypes.AVERAGE:
                    {
                        this._averageHandler(messagePayload);
                        break;
                    }
                    case ActionTypes.LOG:
                    {
                        this._logger.log(this._localDataCache);
                        break;
                    }
                    case ActionTypes.RESET:
                    {
                        this._localDataCache = [];
                        break;
                    }
                }
            }
        );
    }

    /**
     * Sorts local data
     * @param messagePayload
     * @private
     */
    _sortHandler(messagePayload) {
        this._localDataCache.sort(function (a, b) {
            return a - b;
        });

        resultPublisherSocket.send(JSON.stringify({
            type: messagePayload.type,
            sorted: true
        }));
    }

    /**
     * Calculates median of local data cache and send back it to master
     * @param messagePayload
     * @private
     */
    _getMedianHandler(messagePayload) {
        let median = this._medianCalculator.calculate(this._localDataCache, true);

        this._logger.log(`[MEDIAN] : ${median}`);
        resultPublisherSocket.send(JSON.stringify({
            type: messagePayload.type,
            data: median
        }));
    }

    /**
     * Calculates lower and upper counts by given estimated median
     * @param messagePayload
     * @private
     */
    _getLowerUpperCountsHandler(messagePayload) {
        var lowCount = -1;
        var estimatedMed = messagePayload.estimatedMedian;
        this._localDataCache.every(function (item, index) {
            if (item > estimatedMed) {
                lowCount = index - 1;
                return false;
            }

            return true;
        });

        if (lowCount === -1)
            lowCount = this._localDataCache.length;
        var upperCount = (this._localDataCache.length - lowCount) - 1;

        resultPublisherSocket.send(JSON.stringify({
            type: messagePayload.type,
            data: {lowerCount: lowCount, upperCount: upperCount}
        }));
    }

    /**
     * Try to calculate exact median by given to estimated median
     * @param messagePayload
     * @private
     */
    _getExactMedianHandler(messagePayload) {
        var estimatedMedian = messagePayload.median;
        var data = {first: -1, second: -1};

        switch (messagePayload.returnFor) {
            case EstimatedMedianState.EQUAL:
            {
                this._localDataCache.every((item, index)=> {
                    if (item === estimatedMedian) {
                        data.first = item;
                        return false;
                    }
                    if (item > estimatedMedian) {
                        data.first = this._localDataCache[index - 1];
                        data.second = item;
                        return false;
                    }
                    return true;
                });

                break;
            }
            case EstimatedMedianState.TO_UPPER:
            {
                this._localDataCache.every((item)=> {
                    if (item > estimatedMedian) {
                        data.first = item;
                        return false;
                    }

                    return true;
                });

                break;
            }
            case EstimatedMedianState.TO_LOWER:
            {
                this._localDataCache.every((item, index)=> {
                    if (item > estimatedMedian) {
                        data.first = this._localDataCache[index - 1];
                        return false;
                    }

                    return true;
                });

                break;
            }
        }

        resultPublisherSocket.send(JSON.stringify({
            type: messagePayload.type,
            data: data
        }));
    }

    /**
     * Calculates average of local data cache and send back it to master
     * @param messagePayload
     * @private
     */
    _averageHandler(messagePayload) {
        var avg = this._averageCalculator.calculate(this._localDataCache);

        resultPublisherSocket.send(JSON.stringify({
            type: messagePayload.type,
            data: {len: this._localDataCache.length, avg: avg}
        }));
    }
}

/**
 * exports
 * @type {Worker}
 */
module.exports = Worker;