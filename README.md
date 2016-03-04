###Finding The Median In Large Sets Of Numbers Split Across N Servers using zeromq and nodejs (experimental)
[![Build Status](https://travis-ci.org/ziyasal/cerebro.svg?branch=master)](https://travis-ci.org/ziyasal/cerebro)  [![Coverage Status](https://coveralls.io/repos/github/ziyasal/cerebro/badge.svg?branch=master)](https://coveralls.io/github/ziyasal/cerebro?branch=master)

- It takes a data and distributes the data equally to workers;
- When StatsCollector's `getMedian` is called, sends `SORT` message to sort data on workers as first step,
- After sort operation confirmed for all workers, master sends `GET_MEDIAN` message to get median for each worker and stores median of medians. This value is likely  to be the median of our data set.
- After this step the `binary search` approach is applied to find exact median.
  - As a first step of this approach, the median estimation which is median of medians which are gathered from workers, will be used as a mid value in binary search.
    By collecting the values which are upper and lower than the estimated median, I updated the estimated median in order to equalize the counts of upper and lower values. 
  - This step works recursively and I converge to the exact median.
  - The recursive step is that the master sends `GET_LOWER_UPPER_COUNTS` message to get lower and upper counts regarding to estimated median.
 
**Improvements**
 - Could be improve design by decouple from ZeroMQ to provide extensibility (e.g MPI).
 - Dynamically manage worker size and data distribution to workers and continuous data processing (streaming)
 - Could be implement multi-core processing using cluster on worker nodes to improve performance
 
**Known issues**
 - It needs refactoring to support duplicate data handling
 - It needs design refactoring
 
 ##Usage
 
 ###Install Dependencies
 
 **On Windows**
 ```sh
 npm install
 ```
 
 **On Linux**
 ```sh
 sudo npm install
 ```

 ### Commands
 
 **Start App**
 ```js
//Start Workers up to size that determined in config file (for example:3)
node main.js --role='WORKER'
node main.js --role='WORKER'
node main.js --role='WORKER'

//Start Master
node main.js --role='MASTER'
 ```
 
 **Test**
 ```sh
 npm test
 ```
 
 **Coverage**
 ```sh
 npm run test-cov
 ```
 
 **ESLint**
 ```sh
 npm run lint
 ```
