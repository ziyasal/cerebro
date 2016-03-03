'use strict';

var zmq = require('zmq');
var _ = require('lodash');

var EstimationState = require('./../lib/median-estimation-state');
var pubSocket = zmq.socket('pub');
var pushSocket = zmq.socket('push');
var resultCollectorSocket = zmq.socket('pull');

var ActionTypes = require('./../lib/actionTypes');

var async = require('async');

/**
 * Collects stats and provides average and median of large data set
 */
class StatsCollector {
    constructor(medianCalculator, configurationProvider, logger) {

        this._configurationProvider = configurationProvider;
        this._medianCalculator = medianCalculator;
        this._logger = logger;

        this._estimationState = EstimationState.NONE;
        this._medianCandidates = [];
        this._localCache = [];
        this._responseCounter = 0;

        this._averageResultCache = {len: 0, avg: 0};
        this._medianResultCache = [];
        this._tmpUpperLowerObject = {lowerCount: 0, upperCount: 0};

        this._tmpMedianObject = {max: 0, min: 0, estimated: 0};

        this._getMedianCallback = null;
        this._getAverageCallback = null;
    }

    /**
     * Start StatsCollector and sockets
     * @param startCallback
     */
    start(startCallback)/*void*/ {

        async.parallel([callback=> {
            pushSocket.bind(this._configurationProvider.get('zmq:pushPullSocketAddress'), (err)=> {
                if (err) return callback(err);

                callback(null);
            });
        }, callback=> {

            pubSocket.bind(this._configurationProvider.get('zmq:pubSubSocketAddress'), (err)=> {
                if (err) return callback(err);

                callback(null);
            });
        }, callback=> {
            resultCollectorSocket.bind(this._configurationProvider.get('zmq:resultPushPullSocketAddress'), (err)=> {
                if (err) {
                    this._logger.log(`ResultCollectorSocket: ${err.message}`);
                    return callback(err);
                }

                resultCollectorSocket.on('message', this._handleResultCollector.bind(this));
                callback(null);
            });
        }], (err)=> {
            if (err) return startCallback(err);

            this._logger.log('Bind operation completed for all sockets');
            startCallback(null);
        });
    }

    /**
     * Pushes response time value to local data cache
     * @param responseTimeMs
     * @param isLastElement
     */
    pushValue(responseTimeMs, isLastElement/*number*/) /*void*/ {
        this._localCache.push(responseTimeMs);

        var batchSize = this._configurationProvider.get('batchSize');
        var workerSize = this._configurationProvider.get('workerSize');

        if (isLastElement || (batchSize * workerSize) === this._localCache.length) {

            var responseChunks = _.chunk(this._localCache, Math.floor(this._localCache.length / workerSize));
            this._localCache = [];
            for (var i = 0; i < responseChunks.length; i++) {
                this._sendToWorker(responseChunks[i]);
            }
        }
    }

    /**
     * Debugging purpose only
     */
    sendLogEvent()/*void*/ {
        pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({type: ActionTypes.LOG})]);
    }

    /**
     * Debugging purpose only
     */
    resetWorkers()/*void*/ {
        pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({type: ActionTypes.RESET})]);
    }

    /**
     * Returns median of pushed values
     * @param cb
     */
    getMedian(cb) /*number*/ {
        this._getMedianCallback = cb;
        this._responseCounter = this._configurationProvider.get('workerSize');
        pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({type: ActionTypes.SORT})]);
    }

    /**
     * Retuns average of pushed values
     * @param cb
     */
    getAverage(cb) /*number*/ {
        this._getAverageCallback = cb;
        this._responseCounter = this._configurationProvider.get('workerSize');
        pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({type: ActionTypes.AVERAGE})]);
    }

    /**
     * Dispose resources
     */
    stop(cb) /*void*/ {

        try {
            pubSocket.close();
            resultCollectorSocket.close();
            pushSocket.close();
            cb(null);
        }
        catch (err) {
            cb(err);
        }
    }

    /**
     * Calls result collector methods by message type
     * @param message
     * @private
     */
    _handleResultCollector(message) {
        var messagePayload = JSON.parse(message.toString());
        //this._logger.log(`Got forwarded message :${ message.toString()}`);

        switch (messagePayload.type) {
            case ActionTypes.SORT:
            {
                this._collectSortValues();
                break;
            }
            case ActionTypes.GET_MEDIAN:
            {
                this._collectMedians(messagePayload.data);
                break;
            }
            case ActionTypes.GET_LOWER_UPPER_COUNTS:
            {
                this._collectLowerUpperCounts(messagePayload.data);
                break;
            }

            case ActionTypes.GET_EXACT_MEDIAN:
            {
                this._collectExactMedian(messagePayload.data);
                break;
            }
            case ActionTypes.AVERAGE:
            {
                this._collectAverageValues(messagePayload.data);
                break;
            }
        }
    }


    /**
     * Sends given data to workers
     * @param data
     * @private
     */
    _sendToWorker(data) {
        setTimeout(function () {
            pushSocket.send(JSON.stringify(data));
        }, 500);
    }

    /**
     *
     * @private
     */
    _collectSortValues() {
        if (--this._responseCounter === 0) {
            this._resetResponseCounter();
            pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({type: ActionTypes.GET_MEDIAN})]);
        }
    }

    /**
     *
     * @param data
     * @private
     */
    _collectMedians(data) {
        this._medianResultCache.push(data);
        if (--this._responseCounter === 0) {
            this._resetResponseCounter();
            this._setMedianObjOfMedians();
            pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({
                type: ActionTypes.GET_LOWER_UPPER_COUNTS,
                estimatedMedian: this._tmpMedianObject.estimated
            })]);
        }
    }

    /**
     *
     * @param data
     * @private
     */
    _collectLowerUpperCounts(data) {
        this._updateUpperLowerObj(data);

        if (--this._responseCounter === 0) {
            this._resetResponseCounter();
            if (!(this._medianFound() || this._tmpUpperLowerObject.upperCount === this._tmpUpperLowerObject.lowerCount)) {

                this._updateTmpMedianObject();//pass data
                this._resetTmpUpperLowerObject();

                pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({
                    type: ActionTypes.GET_LOWER_UPPER_COUNTS,
                    estimatedMedian: this._tmpMedianObject.estimated
                })]);
            }
            else {
                this._estimationState = this._getEstimationDirection();
                var median = this._tmpMedianObject.estimated;

                pubSocket.send(['STATS_WORKER_CHANNEL', JSON.stringify({
                    type: ActionTypes.GET_EXACT_MEDIAN,
                    median: median,
                    returnFor: this._estimationState
                })]);
            }
        }
    }

    /**
     *
     * @returns {number}
     * @private
     */
    _getEstimationDirection() {
        if (this._tmpUpperLowerObject.upperCount === this._tmpUpperLowerObject.lowerCount)
            return EstimationState.EQUAL;
        if ((this._tmpUpperLowerObject.upperCount === this._tmpUpperLowerObject.lowerCount + 1))
            return EstimationState.TO_LOWER;
        if (this._tmpUpperLowerObject.upperCount === this._tmpUpperLowerObject.lowerCount - 1)
            return EstimationState.TO_UPPER;
    }

    /**
     *
     * @param data
     * @private
     */
    _collectExactMedian(data) {
        if (this._estimationState === EstimationState.EQUAL) {
            this._medianCandidates.push(data.first);
            this._medianCandidates.push(data.second);
        }
        else {
            if (data.first > 0)
                this._medianCandidates.push(data.first);
        }
        if (--this._responseCounter === 0) {
            this._medianCandidates.sort(function (a, b) {
                return a - b;
            });

            let calculatedMedianResult = 0;
            if (this._estimationState === EstimationState.EQUAL) {

                for (var i = 0; i < this._medianCandidates.length; i++) {
                    if (this._medianCandidates[i] === this._tmpMedianObject.estimated) {
                        calculatedMedianResult = this._tmpMedianObject.estimated;
                    }
                    else if (this._medianCandidates[i] > this._tmpMedianObject.estimated) {
                        calculatedMedianResult = (this._medianCandidates[i] + this._medianCandidates[i - 1]) / 2.0;
                    }
                }
            }
            else if (this._estimationState === EstimationState.TO_LOWER) {
                calculatedMedianResult = this._medianCandidates[this._medianCandidates.length - 1];
            }
            else if (this._estimationState === EstimationState.TO_UPPER) {
                calculatedMedianResult = this._medianCandidates[0];
            }

            if (this._getMedianCallback && typeof this._getMedianCallback === 'function')
                this._getMedianCallback(calculatedMedianResult);
        }
    }

    /**
     *
     * @param msg
     * @private
     */
    _collectAverageValues(msg) {
        var divider = (this._averageResultCache.len + msg.len);
        if (divider !== 0) {
            this._averageResultCache.avg = ((this._averageResultCache.avg * this._averageResultCache.len) + (msg.avg * msg.len)) / divider;
            this._averageResultCache.len += msg.len;
        }
        else {
            this._averageResultCache.avg = msg.avg;
        }

        if (--this._responseCounter === 0) {
            this._resetResponseCounter();
            if (this._getAverageCallback && typeof this._getAverageCallback === 'function') {
                this._getAverageCallback(this._averageResultCache.avg);
            }
        }
    }

    /**
     *
     * @returns {boolean}
     * @private
     */
    _medianFound() {
        return (this._tmpUpperLowerObject.upperCount === this._tmpUpperLowerObject.lowerCount)
            || (this._tmpUpperLowerObject.upperCount === this._tmpUpperLowerObject.lowerCount + 1)
            || (this._tmpUpperLowerObject.upperCount === this._tmpUpperLowerObject.lowerCount - 1);
    }

    /**
     *
     * @private
     */
    _setMedianObjOfMedians() {
        this._tmpMedianObject.estimated = this._medianCalculator.calculate(this._medianResultCache, false);
        this._tmpMedianObject.max = _.max(this._medianResultCache);
        this._tmpMedianObject.min = _.min(this._medianResultCache);

    }

    /**
     *
     * @private
     */
    _updateTmpMedianObject() {
        if (this._tmpUpperLowerObject.lowerCount > this._tmpUpperLowerObject.upperCount) {
            this._tmpMedianObject.max = this._tmpMedianObject.estimated;
            this._tmpMedianObject.estimated = (this._tmpMedianObject.estimated + this._tmpMedianObject.min) / 2.0;
        }
        else {
            this._tmpMedianObject.min = this._tmpMedianObject.estimated;
            this._tmpMedianObject.estimated = (this._tmpMedianObject.estimated + this._tmpMedianObject.max) / 2.0;
        }
    }

    /**
     *
     * @param data
     * @private
     */
    _updateUpperLowerObj(data) {
        this._tmpUpperLowerObject.lowerCount += data.lowerCount;
        this._tmpUpperLowerObject.upperCount += data.upperCount;
    }

    /**
     *
     * @private
     */
    _resetResponseCounter() {
        this._responseCounter = this._configurationProvider.get('workerSize');
    }

    /**
     *
     * @private
     */
    _resetTmpUpperLowerObject() {
        this._tmpUpperLowerObject.upperCount = 0;
        this._tmpUpperLowerObject.lowerCount = 0;
    }
}

/**
 *exports
 * @type {StatsCollector}
 */
module.exports = StatsCollector;