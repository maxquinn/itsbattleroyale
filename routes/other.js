var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next) {

    //This is the current file they have requested
    var file = req.params[0];

    //For debugging, we can track what files are requested.
    if (verbose) console.log('\t :: Express :: file requested : ' + file);

    //Send the requesting client the file.
    res.sendfile(__dirname + '/' + file);

});

module.exports = router;