[
    /* **************************************************************
     * notes:
     *   - enables browsing static web pages within a github repo
     *   - static web pages can access assets and resources via relative links within the same repo
     *   - only "raw" static web pages (and assets/resources) are effected
     * considerations:
     *   - "GitHub Pages" (pages.github.com) provides similar functionality,
     *     but it can only serve:
     *       * one specific branch per repo (ie: "gh-pages")
     *       * one specific repo per user   (ie: "username.github.io")
     *     whereas, this solution can be applied to any branch in any repo belonging to any user.
     * **************************************************************
     */
    {
        "url": /^https?:\/\/raw\.githubusercontent\.com\/.*$/,
        "headers": function(){
            var $headers = {};
            var set_type = function(type){
                $headers = {
                    "Content-Type"              : type,
                    "Content-Disposition"       : null,
                    "Content-Security-Policy"   : null,
                    "X-Content-Security-Policy" : null
                };
                response.content_type = type;
            };
            switch( request.uri.file_ext.toLowerCase() ){
                // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types

                // group 1: most common
                case 'html':
                case 'htm':
                    set_type('text/html');
                    break;
                case 'css':
                    set_type('text/css');
                    break;
                case 'js':
                    set_type('application/javascript');
                    break;
                case 'json':
                    set_type('application/json');
                    break;

                // group 2: media formats
                case 'gif':
                    set_type('image/gif');
                    break;
                case 'jpg':
                case 'jpeg':
                    set_type('image/jpeg');
                    break;
                case 'png':
                    set_type('image/png');
                    break;
                case 'svg':
                    set_type('image/svg+xml');
                    break;
                case 'ico':
                    set_type('image/x-icon');
                    break;
                case 'webp':
                    set_type('image/webp');
                    break;
                case 'mp4':
                    set_type('video/mp4');
                    break;
                case 'mpeg':
                    set_type('video/mpeg');
                    break;
                case 'ogv':
                case 'ogg':
                case 'ogm':
                    set_type('video/ogg');
                    break;
                case 'webm':
                    set_type('video/webm');
                    break;
                case 'oga':
                    set_type('audio/ogg');
                    break;
                case 'weba':
                    set_type('audio/webm');
                    break;
                case 'mp3':
                    set_type('audio/mpeg');
                    break;
                case 'wav':
                    set_type('audio/wav');
                    break;

                // group 3: less common
                case 'txt':
                    set_type('text/plain');
                    break;
                case 'csv':
                    set_type('text/csv');
                    break;
                case 'xml':
                    set_type('application/xml');
                    break;
                case 'xhtml':
                    set_type('application/xhtml+xml');
                    break;
                case 'pdf':
                    set_type('application/pdf');
                    break;
                case 'ttf':
                    set_type('font/ttf');
                    break;
                case 'woff':
                    set_type('font/woff');
                    break;
                case 'woff2':
                    set_type('font/woff2');
                    break;
            }
            return $headers;
        }
    }
]
