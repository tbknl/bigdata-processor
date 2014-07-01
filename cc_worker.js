var BDP = require('./bdp').BDP;


var runPart = BDP.Runner.Sequential.prototype.executePart;


process.on('message', function(msg) {
    var chain = BDP.Class.Chain.unserialize(msg.chain);

    runPart(chain, msg.context, msg.part, msg.parts, function(part, result) {
        process.send(result);
    });
});

