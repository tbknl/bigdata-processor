var _ = require('underscore');
var computecluster = require('compute-cluster');

var BDP = {
    VERSION: '1.0.0'
};


BDP.Class = {};


BDP.Class.Chain = (function() {
    function Chain(chain) {
        if (chain) {
            this.requires = _.clone(chain.requires);
            this.preProcess = _.clone(chain.preProcess);
            this.retrieve = _.clone(chain.retrieve);
            this.filter = _.clone(chain.filter);
            this.map = _.clone(chain.map);
            this.reduce = _.clone(chain.reduce);
            this.postProcess = _.clone(chain.postProcess);
        }
        else {
            this.requires = [];
            this.preProcess = {
                func: function(context, part, parts) { return context; }
            };
            this.retrieve = {
                func: function() { return []; }
            };
            this.filter = [];
            this.map = [];
            this.reduce = {
                func: function(imr, item, context, combine) {
                    return imr.concat(combine ? item : [item]);
                },
                startValue: []
            };
            this.postProcess = {
                func: function(result) { return result; }
            };
        }
    }

    Chain.prototype.serialize = function() {
        var serialized = {
            version: BDP.VERSION,
            requires: this.requires,
            preProcess: {func: this.preProcess.func.toString()},
            retrieve: {func: this.retrieve.func.toString()},
            filter: _.map(this.filter, function(item) { return {func: item.func.toString()}; }),
            map: _.map(this.map, function(item) { return {func: item.func.toString()}; }),
            reduce: {func: this.reduce.func.toString(), startValue: this.reduce.startValue},
            postProcess: {func: this.postProcess.func.toString()}
        };
        return serialized;
    };

    Chain.unserialize = function(serialized) {
        if (serialized.version !== BDP.VERSION) {
            throw 'BDP chain version incompatible';
        }

        var chain = {
            requires: serialized.requires,
            preProcess: {func: BDP.Util.unserializeFunction(serialized.preProcess.func)},
            retrieve: {func: BDP.Util.unserializeFunction(serialized.retrieve.func)},
            filter: _.map(serialized.filter, function(item) { return {func: BDP.Util.unserializeFunction(item.func)}; }),
            map: _.map(serialized.map, function(item) { return {func: BDP.Util.unserializeFunction(item.func)}; }),
            reduce: {func: BDP.Util.unserializeFunction(serialized.reduce.func), startValue: serialized.reduce.startValue},
            postProcess: {func: BDP.Util.unserializeFunction(serialized.postProcess.func)}
        };

        return new Chain(chain);
    };

    return Chain;
})();


BDP.Class.Job = (function(BDP) {
    function Job(job) {
        this.chain = new BDP.Class.Chain(job ? job.chain : null);
    }

    Job.prototype.requires = function(moduleList) {
        this.chain.requires.concat(moduleList);
    };

    Job.prototype.preProcess = function(func) {
        var job = new Job(this);
        job.chain.preProcess = {func: func};
        return job;
    };

    Job.prototype.retrieve = function(func) {
        var job = new Job(this);
        job.chain.retrieve = {func: func};
        return job;
    };

    Job.prototype.filter = function(func) {
        var job = new Job(this);
        job.chain.filter.push({func: func});
        return job;
    };

    Job.prototype.map = function(func) {
        var job = new Job(this);
        job.chain.map.push({func: func});
        return job;
    };

    Job.prototype.reduce = function(func, startValue) {
        var job = new Job(this);
        job.chain.reduce = {func: func, startValue: startValue};
        return job;
    };

    Job.prototype.postProcess = function(func) {
        var job = new Job(this);
        job.chain.postProcess = {func: func};
        return job;
    };

    Job.prototype.run = function(runnerFactory, context, parts, callback) {
        if (runnerFactory == null || !_.isFunction(runnerFactory.create)) {
            throw 'BDP runner not found';
        }

        var runner = runnerFactory.create();

        var chain = this.chain;

        var readyParts = [];
        var result = chain.reduce.startValue;

        var partCallback = function(part, imr) {
            readyParts.push(part);

            result = chain.reduce.func(result, imr, context, true);

            if (readyParts.length === parts) {
                runner.cleanup();
                var postProcessedResult = chain.postProcess.func(result, context);
                callback(postProcessedResult);
            }
        };

        for (var part = 0; part < parts; ++part) {
            var partContext = chain.preProcess.func(context, part, parts);
            runner.executePart(chain, partContext, part, parts, partCallback);
        }

        return {}; // TODO????
    };

    return Job;
})(BDP);


BDP.Runner = {};


BDP.Runner.Sequential = (function() {
    function BDP_Runner_Sequential() {
        // empty
    }

    BDP_Runner_Sequential.prototype.executePart = function(chain, context, part, parts, partCallback) {
        // imr: Intermediate result.
        var imr = _.clone(chain.reduce.startValue);

        var retrieveCallback = function(item) {
            if (item === undefined) {
                partCallback(part, imr);
                return;
            }

            var includeItem = true;
            for (var i = 0; i < chain.filter.length && includeItem; ++i) {
                includeItem = chain.filter[i].func(item, context);
            }

            if (includeItem) {
                for (var i = 0; i < chain.map.length; ++i) {
                    item = chain.map[i].func(item, context);
                }

                imr = chain.reduce.func(imr, item, context, false);
            }
        };

        chain.retrieve.func(context, part, parts, retrieveCallback);
    };

    BDP_Runner_Sequential.prototype.cleanup = function() {};

    return BDP_Runner_Sequential;
})();


BDP.Runner.ComputeCluster = (function() {
    function BDP_Runner_ComputeCluster(config) {
        var ccOptions = {
            module: 'node_modules/bigdata-processor/cc_worker.js',
            max_backlog: -1
        };

        if (typeof config === 'object') {
            if (config.max_processes) {
                ccOptions.max_processes = config.max_processes;
            }
        }

        this.cc = new computecluster(ccOptions);

        this.cc.on('error', function(err) {
            console.log('OMG!', err);
        });
    }

    BDP_Runner_ComputeCluster.prototype.executePart = function(chain, context, part, parts, partCallback) {
        var msg = {
            chain: chain.serialize(),
            context: context,
            part: part,
            parts: parts
        };

        this.cc.enqueue(msg, function(err, result) {
            if (err) {
                console.log('An error occurred:', err);
            }

            partCallback(part, result);
        });
    };

    BDP_Runner_ComputeCluster.prototype.cleanup = function() {
        this.cc.exit();
    };

    return BDP_Runner_ComputeCluster;
})();


/// Create a runner factory:
BDP.runner = function(runnerType, config) {
    return {
        create: function() {
            return new runnerType(config);
        }
    };
};


BDP.Util = {};


BDP.Util.serializeFunction = function(fn) {
    return fn.toString();
};


BDP.Util.unserializeFunction = function(serializedFn) {
    'use strict';
    var func = eval('(' + serializedFn + ')');
    return func;
};


BDP.Helper = {
    PreProcess: {},
    Retrieve: {}
};


BDP.Helper.PreProcess.listChunk = function(context, part, parts) {
    var chunkSize = parseInt((context.list.length - 1) / parts, 10) + 1;
    var subList = context.list.slice(chunkSize * part, chunkSize * (part + 1));
    return _.defaults({
        list: subList
    }, context);
};


BDP.Helper.Retrieve.list = function(context, part, parts, callback) {
    var list = context.list;
    var listLength = list.length;
    _.each(list, callback);
    callback(undefined);
};


/// Create a new job:
BDP.job = function() { return new BDP.Class.Job(); };


exports.BDP = BDP;

