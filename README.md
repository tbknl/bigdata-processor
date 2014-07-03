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
    * Namespace for predefined helpers to be used for one of the job stages.
* `BDP.Runner`
    * Namespace for job runners.
        * `BDP.Runner.Sequential`: Local sequential runner.
        * `BDP.Runner.ComputeCluster`: Runner using the Compute-Cluster NPM package to distribute the job among multiple processes. Please note that this runner works only when you use serializable job stage functions, which are independent of other local functions.

* `BDP.Class.Job`: Describes the stages of a job that will be executed in order specified. Invoking one of the stage methods will create a duplicated instance of the current job, then modify it and return it.
    * `run(runnerFactory, context, parts, callback)`: Run the job. Parameters:
        * `runnerFactory`: Runner factory created with `BDP.runner(...)`.
        * `context`: Context data passed to the job stage functions.
        * `parts`: Integer indicating the number of parts in which the job should be split up.
        * `callback`: Callback function invoked when the job is ready. Will be called with the result as the first parameter.
    * `preProcess(func)`: Set the preprocess function `func` for the job. The function `func` should return the context specific for the indicated part. It will be called for each part with these parameters:
        * `context`: The context data provided to `.run(...)`.
        * `part`: Integer part index of the current part.
        * `parts`: Total number of parts.
    * `retrieve(func)`: Set the data retrieval function `func` for the job. The function `func` should work *asynchronously*, passing each record of data to its callback. Calling the callback with `undefined` indicates the data retrieval is finished. The function `func` will be called for each part with these parameters:
        * `context`: Context data for this part (potentially modified in preProcess stage).
        * `part`: Integer part number.
        * `parts`: Total number of parts.
        * `callback`: Callback function that should be called for each piece of data to be processed in further job stages.
    * `filter(func)`: Add the filter function `func` to the job. Multiple filters can be added, which will execute in order of definition. The function `func` should return a boolean indicating whether to include (`true`) the data record in further processing or to discard it (`false`). It will be called with these parameters:
        * `record`: Data record.
        * `context`: Context data for this part.
    * `map(func)`: Add the map function `func` to the job. Multiple map functions can be added, which will execute in order of definition. The function `func` takes the record data and should transform it to other data which it returns. It will be called with these parameters:
        * `record`: Data record.
        * `context`: Context data for this part.
    * `reduce(func, startValue)`: Set the reduce/aggregation function for the job. It takes the intermediate aggregation result and a transformed data record and should return a new intermediate aggregation result. The value of `startValue` is used as the start value of the intermediate aggregation result. The reduce function is called twice in the process pipeline: first to aggregate the individual data records of one part, and later to combine the the results of all parts. The function `func` will be called with these parameters:
        * `imr`: Intermediate result.
        * `data`: In first reduce stage: (transformed) data record. In second reduce stage: intermediate result of a part.
        * `context`: In first reduce stage: Context data for the current part. In second reduce stage: Non-preprocessed context data.
        * `combine`: Boolean indicating the reduce stage, `false` for the first stage and `true` for second stage.
    * `postProcess(func)`: Set the post-process function for the job. The function `func` should return the final processing result. It will be called with these parameters:
        * `result`: The result of the second reduce stage, where all data is combined.
        * `context`: The non-preprocessed context data.
