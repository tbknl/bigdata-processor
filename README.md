bigdata-processor
=================

Experimental BigData Processing framework for Node.js


Installation
------------

This NPM package is not (yet) inserted in the NPM repositories. You can install this package in your project by linking:

```bash
git clone https://github.com/tbknl/bigdata-processor.git
cd bigdata-processor
sudo npm link
cd <path-to-your-project>
npm link bigdata-processor
```


Example usage
-------------

```javascript
var BDP = require('bigdata-processor').BDP;

var sequentialRunner = BDP.runner(BDP.Runner.Sequential, {});
var computeClusterRunner = BDP.runner(BDP.Runner.ComputeCluster, {max_processes: 4});

var onReady = function(result) { console.log('Result:', result); };

var input = [1,2,3,4,5,6,7,8,9,10];
var square = function(n) { return n * n; };
var add = function(a, b) { return a + b; };

var job = BDP.job()
    .preProcess(BDP.Helper.PreProcess.listChunk)
    .retrieve(BDP.Helper.Retrieve.list)
    .map(square)
    .reduce(add, 0);

job.run(sequentialRunner, {list: input}, 4, onReady);
job.run(computeClusterRunner, {list: input}, 3, onReady);
```
