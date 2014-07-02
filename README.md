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


API
---

* `BDP.job()`
    * Create a new job (instance of BDP.Class.Job).
* `BDP.runner(runnerConstructor, config)`
    * Create a runner factory that can be passed to `Job.run(...)`.
* `BDP.Helper`
    * Namespace for predefined helpers to be used in one of the job stages.
* `BDP.Runner`
    * Namespace for job runners.
        * `BDP.Runner.Sequential`: Local sequential runner.
        * `BDP.Runner.ComputeCluster`: Runner using the Compute-Cluster NPM package to distribute the job among multiple processes.

* `BDP.Class.Job`: Describes the stages of a job that will be executed in order specified. Invoking one of the stage methods will create a duplicated instance of the current job, then modify it and return it.
    * `run(runnerFactory, context, parts, callback)`: Run the job. Parameters:
        * `runnerFactory`: Runner factory created with `BDP.runner(...)`.
        * `context`: Context data passed to the stage functions.
        * `parts`: Integer indicating the number of parts in which the job should be split up.
        * `callback`: Callback function invoked when the job is ready. Will be called with the result as the first parameter.
    * `preProcess(func)`: Set the preprocess function `func` for the job. The function `func` should return the context specific for the indicated part. It will be called for each part with these parameters:
        * `context`: The context data provided to `.run(...)`.
        * `part`: Integer part index of the current part.
        * `parts`: Total number of parts.
    * `retrieve(func)`: TODO
    * `filter(func)`: TODO
    * `map(func)`: TODO
    * `reduce(func, startValue)`: TODO
    * `postProcess(func)`: TODO

