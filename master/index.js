'use strict';

var StatsCollector = require('./stats-collector');
var _ = require('lodash');

function main(medianCalculator, configurationProvider, logger) {

	//NOTE: Use real data for real scenario that comes from any data storage
    let responseTimes = _.range(99000);

    let statsCollector = new StatsCollector(medianCalculator, configurationProvider, logger);

    statsCollector.start(err=> {
        if (err) {
            process.exit(1);
        }

        responseTimes.forEach((element, index) => {
            statsCollector.pushValue(element, (index === responseTimes.length - 1));
        });

        //Send log event to show data that received by workers (debugging purpose only)
        //statsCollector.sendLogEvent();

        setTimeout(()=> {
            statsCollector.getAverage(average => {
                logger.log(`AVERAGE result received: ${average}`);
            });
        }, 3000);

        setTimeout(()=> {
            statsCollector.getMedian(median=> {
                logger.log(`MEDIAN result received: ${median}`);
            });
        }, 3000);
    });

    process.on('SIGINT', () => {
        statsCollector.stop();
    });
}

module.exports = main;