/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// http://ejohn.org/blog/simple-javascript-inheritance/
// Inspired by base2 and Prototype

var EXPORTED_SYMBOLS = [ "Class" ];

var Class = (function(){
	var base_class;
	var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;

	// The base Class implementation (does nothing)
	base_class = function(){};

	// Create a new Class that inherits from this class
	base_class.extend = function(prop) {
		var _super = this.prototype;

		// Instantiate a base class (but only create the instance,
		// don't run the init constructor)
		initializing = true;
		var prototype = new this();
		initializing = false;

		// Copy the properties over onto the new prototype
		for (var name in prop) {
			// Check if we're overwriting an existing function
			prototype[name] = typeof prop[name] == "function" &&
				typeof _super[name] == "function" && fnTest.test(prop[name]) ?
				(function(name, fn){
					return function() {
						var tmp = this._super;

						// Add a new ._super() method that is the same method
						// but on the super-class
						this._super = _super[name];

						// The method only need to be bound temporarily, so we
						// remove it when we're done executing
						var ret = fn.apply(this, arguments);
						this._super = tmp;

						return ret;
					};
				})(name, prop[name]) :
				prop[name];
		}

		// The dummy class constructor
		function Class() {
			// All construction is actually done in the init method
			if ( !initializing && this.init )
				this.init.apply(this, arguments);
		}

		// Populate our constructed prototype object
		Class.prototype = prototype;

		// Enforce the constructor to be what we expect
		Class.prototype.constructor = Class;

		// And make this class extendable
		Class.extend = arguments.callee;

		return Class;
	};
	return base_class;
})();

/*
 * quick test:
 */
(false) && (function(){
	var Person = Class.extend({
		init: function(isDancing){
			this.dancing = isDancing;
		}
	});

	var Ninja = Person.extend({
		init: function(){
			this._super( false );
		}
	});

	var p = new Person(true);
	console.log( 'person is dancing: ' + p.dancing ); // => true

	var n = new Ninja();
	console.log( 'ninja is dancing: ' + n.dancing ); // => false
})();
