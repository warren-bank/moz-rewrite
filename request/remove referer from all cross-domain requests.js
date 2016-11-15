[
    {
        "url" : /^.*$/,
        "headers" : function() {
            var headers = {};

            // remove referer from all cross-domain requests
            if ( (request.headers.unmodified.referer) && (request.referrer) && (request.referrer.host !== request.window_location.host) ){
                headers.referer = null;
            }

            return headers;
        }
    }
]
