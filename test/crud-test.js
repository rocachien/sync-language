/*jshint globalstrict:true, devel:true */
/*eslint no-var:0 */
/*global require, __dirname, describe, before, it */
"use strict";

var buster       = require('buster');
var sync = require('../lib');

buster.spec.expose();
buster.testRunner.timeout = 500;


describe("CRUD operations", function() {

    before(function(done) {
        done();
    });

    describe('Synchronize language', function() {

        it("Before synchronize language", async (done) => {

            console.log('==========================');
            var result = await sync.start({});
            console.log('============ result:' ,result);
            buster.expect(result).toEqual("done");
            done();

        });
    });
});
