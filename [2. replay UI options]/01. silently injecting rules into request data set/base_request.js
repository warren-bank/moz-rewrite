[
{
	"url": /^moz-rewrite:/i,
	"headers": function(){
		cancel();
		return {};
	}
},
{
	"url": new RegExp('^moz-rewrite:[/]*print/([^/]+)$', 'i'),
	"headers": function(){
		var matches, format, result;
		// example:
		//     moz-rewrite:/print/wget
		matches		= (new RegExp('^moz-rewrite:[/]*print/([^/]+)$', 'i')).exec(request.uri.href);
		if (matches === null){return {};}
		format		= ( matches[1] ).toLowerCase();
		switch(format){
			case 'wget':
			case 'curl':
				// to do: implement `print(format)`
				/* --------------------
				 * reads all of the saved requests from the persistent log file
				 * removes the final trailing comma
				 * wraps the content in: `[]`
				 * parses the content (as JSON) into a javascript array (of request objects)
				 * passes the array to a format printer, which returns a string (of html?)
				 * returns the string result (for display?)
				 * --------------------
				 */
				result	= print(format);

				// http://en.wikipedia.org/wiki/Data_URI_scheme#HTML
				result	= 'data:text/html;base64,' + base64_encode(result);
				redirectTo(result);
				break;
		}
		return {};
	},
	"stop": true
},
{
	"url": new RegExp('^moz-rewrite:[/]*run/([^/]+)/(\d+)$', 'i'),
	"headers": function(){
		var matches, format, id, callback;
		// example:
		//     moz-rewrite:/run/wget/12345
		matches		= (new RegExp('^moz-rewrite:[/]*run/([^/]+)/(\d+)$', 'i')).exec(request.uri.href);
		if (matches === null){return {};}
		format		= ( matches[1] ).toLowerCase();
		id			= parseInt( matches[2], 10 );
		switch(format){
			case 'wget':
			case 'curl':
				//assuming we can capture stdout..
				callback = function(result){
					// http://en.wikipedia.org/wiki/Data_URI_scheme#HTML
					result	= 'data:text/plain;base64,' + base64_encode(result);
					redirectTo(result);
				};

				// to do: implement `run(format, id, callback)`
				/* --------------------
				 * same initial steps as `print(format)`
				 * once the array of requests is obtained,
				   cherry pick the request having an `id` attribute with a matching value
				 * use this object to construct an API call using: `nsIProcess`
				 * IF POSSIBLE, capture stdout. after the child process completes, pass its captured string output to a callback function.
				   ex: callback(std_output)
				 * --------------------
				 */
				run(format, id, callback);
				break;
		}
		return {};
	},
	"stop": true
}
]