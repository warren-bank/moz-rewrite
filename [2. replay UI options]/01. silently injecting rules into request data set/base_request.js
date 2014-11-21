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
		var matches, format, callback;
		// example:
		//     moz-rewrite:/print/wget
		matches		= (new RegExp('^moz-rewrite:[/]*print/([^/]+)$', 'i')).exec(request.uri.href);
		if (matches === null){return {};}
		format		= ( matches[1] ).toLowerCase();
		switch(format){
			case 'wget':
			case 'curl':
				// to do: test `print(format, callback)`
				/* --------------------
				 * reads all of the saved requests from the persistent log file
				 * removes the final trailing comma
				 * wraps the content in: `[]`
				 * parses the content (as JSON) into a javascript array (of request objects)
				 * passes the array to a format printer, which returns a string (of html?)
				 * returns the string result (for display?)
				 * --------------------
				 */
				callback = function(result){
					// http://en.wikipedia.org/wiki/Data_URI_scheme#HTML
					result	= 'data:text/html;base64,' + base64_encode(result);
					redirectTo(result);
				};

				print(format, callback);
				break;
		}
		return {};
	},
	"stop": true
},
{
	"url": new RegExp('^moz-rewrite:[/]*run/([^/]+)/(\d+)$', 'i'),
	"headers": function(){
		var matches, format, id;
		// example:
		//     moz-rewrite:/run/wget/12345
		matches		= (new RegExp('^moz-rewrite:[/]*run/([^/]+)/(\d+)$', 'i')).exec(request.uri.href);
		if (matches === null){return {};}
		format		= ( matches[1] ).toLowerCase();
		id			= parseInt( matches[2], 10 );
		switch(format){
			case 'wget':
			case 'curl':
				// to do: test `run(format, id)`
				/* --------------------
				 * same initial steps as `print(format)`
				 * once the array of requests is obtained,
				   cherry pick the request having an `id` attribute with a matching value
				 * use this object to construct an API call using: `nsIProcess`
				 * --------------------
				 */
				run(format, id);
				break;
		}
		return {};
	},
	"stop": true
}
]