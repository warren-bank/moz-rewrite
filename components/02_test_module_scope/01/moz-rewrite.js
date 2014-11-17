// ------------------------------------------------------------------------------------------------ global constant
const Cu = Components.utils;

// ------------------------------------------------------------------------------------------------ global variable
var log = function(s){
	var console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
	console.logStringMessage(s);
};

log ('moz-rewrite says: typeof log == ' + (typeof log));

// ------------------------------------------------------------------------------------------------ library functions and classes packaged/encapsulated into modules
// https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Using
//
// note: external "javascript code module" files NEED to be encoded: "UTF-8 without BOM" or "ANSI"

Cu.import("resource://Moz-Rewrite/test.js");

log ('moz-rewrite says: typeof test == ' + (typeof test));

// ------------------------------------------------------------------------------------------------ test whether library function can see variables declared in this (global) scope
test();

// ------------------------------------------------------------------------------------------------ output:
/*
moz-rewrite says: typeof log == function
moz-rewrite says: typeof test == function
test says: typeof x == object
test says: typeof y == number
*/
