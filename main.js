'use strict';

var argv = require('yargs').argv;
var logger = require('tracer').colorConsole();
var configurationProvider = require('nconf');

var AverageCalculator = require('./lib/average-calculator');
var MedianCalculator = require('./lib/median-calculator');
var UuidProvider = require('./lib/uuid-provider');

configurationProvider.argv()
    .env()
    .file({file: __dirname + '/config.json'});

main();

function main() {

    let averageCalculator = new AverageCalculator();
    let medianCalculator = new MedianCalculator();
    let uuidProvider = new UuidProvider();

    switch (argv.role) {
        case 'MASTER':
        {
            require('./master/index')(medianCalculator, configurationProvider, logger);
            logger.log('[MASTER ACTIVATED]');
            break;
        }
        case 'WORKER':
        {
            require('./worker/index')(averageCalculator, medianCalculator, uuidProvider, configurationProvider, logger);
            logger.log('[WORKER ACTIVATED]');
            break;
        }
    }
}