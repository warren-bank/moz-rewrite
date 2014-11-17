var EXPORTED_SYMBOLS = [ "test" ];

var x,y;
x = {};
y = 0;

var log = function(s){
	var console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
	console.logStringMessage(s);
};

var test = function(){
	log ('test says: typeof x == ' + (typeof x));
	log ('test says: typeof y == ' + (typeof y));
};
