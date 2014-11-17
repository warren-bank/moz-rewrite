var EXPORTED_SYMBOLS = [ "test" ];

var log = function(s){
	var console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
	console.logStringMessage(s);
};

var test = function(){
	log ('test says: typeof Cu == ' + (typeof Cu));
	log ('test says: typeof num == ' + (typeof num));
};
