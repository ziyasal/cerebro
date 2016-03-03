'use strict';

var Worker = require('./worker');

function main(averageCalculator, medianCalculator, uuidProvider, configurationProvider, logger) {

    logger.log('[WORKER]');

    let worker = new Worker(averageCalculator, medianCalculator, uuidProvider, configurationProvider, logger);

    worker.start();

    process.on('SIGINT', ()=> {
        worker.stop();
    });
}

module.exports = main;