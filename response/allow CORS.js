[
    {
        "url" : /^.*$/,
        "headers" : function(){
            var $headers = {};
            if (
                (request.window_location.protocol.toLowerCase() === 'file:') ||
                (request.window_location.host.toLowerCase() === 'localhost')
            ){
                $headers = {
                    "Access-Control-Allow-Origin"  : "*",
                    "Access-Control-Allow-Methods" : "GET,POST"
                };
            }
            return $headers;
        }
    }
]
