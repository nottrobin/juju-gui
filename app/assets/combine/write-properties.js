// Create the file that contains the "debugMode" flag.
// Call "node merge-files.js true" for "debugMode=true"
var syspath = require('path'),
    fs = require('fs'),
    debugMode = (String(process.argv[2]).toLowerCase() === 'true'),
    outputFile = syspath.join(process.cwd(),
    './app/assets/javascripts/generated/properties.js');
fs.writeFileSync(outputFile, 'exports.debugMode=' + debugMode, 'utf8');
