[
    {
        "url" : new RegExp('^https?://search\\.yahoo\\.com/.*$', 'i'),
        "headers" : function(){
            var search_term, string_url;

            search_term     = ( /(?:^|&)p=(.*?)(?:&|$)/i ).exec( request.uri.query );
            if (search_term === null){return {};}

            search_term     = search_term[1];
            string_url      = 'https://www.google.com/search?q=' + search_term;

            self.log('redirecting to: ' + string_url);
            redirectTo(string_url);
            return {};
        }
    }
]
