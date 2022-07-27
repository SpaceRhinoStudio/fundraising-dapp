module.exports = new Promise(resolve => {
    const path = require('path');
    const readline = require("readline");
    var Writable = require('stream').Writable;

    var mutableStdout = new Writable({
        write: function (chunk, encoding, callback) {
            if (!this.muted)
                process.stdout.write(chunk, encoding);
            callback();
        }
    });

    mutableStdout.muted = false;

    var rl = readline.createInterface({
        input: process.stdin,
        output: mutableStdout,
        terminal: true
    });

    let gpg = require('./scripts/gpgRuntime/gpg.js')

    let fPath = path.join(__dirname, `./keyStore.json.gpg`)
    rl.question("please type your encryption key: ", function (password) {
        rl.close();
        gpg.call(password, ['--skip-verify', '--passphrase-fd', '0', '--decrypt', fPath], (err, res) => {
            if (err) {
                console.log("\nerror: decryption failed")
            } else {
                console.log("\ndecryption successful")
                resolve({
                    PRIVATE_KEY: JSON.parse(res.toString('utf8')).key
                })
            }
        });
    });

    mutableStdout.muted = true;
})