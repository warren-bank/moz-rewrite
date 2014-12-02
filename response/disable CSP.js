[
    /* **************************************************************
     * notes:
     *   - remove Content Security Policy (CSP) headers
     *     from all responses having a 'content-type' that
     *     is supported by the addon: "JSON-DataView"
     *   - as these are all formats that don't load external resources,
     *     there's really no reason for there to be a CSP applied to them
     * **************************************************************
     * references:
     *     https://developer.mozilla.org/en-US/docs/Web/Security/CSP/Introducing_Content_Security_Policy
     *     https://developer.mozilla.org/en/Security/CSP/Using_Content_Security_Policy
     *     https://developer.mozilla.org/en/Security/CSP/CSP_policy_directives
     * **************************************************************
     * related issue(s):
     *     https://github.com/warren-bank/moz-json-data-view/issues/5
     * **************************************************************
     */
    {
        "url" : /^.*$/,
        "headers" : function(){
            var $headers;
            switch( response.content_type.toLowerCase() ){
                // result of registration by: 'moz-json-data-view'
                // using contract signature: @mozilla.org/streamconv;1?from={$supported_content_type}to=*/*
                case 'application/x-unknown-content-type':

                // fallback..
                case 'application/json':
                case 'text/json':
                case 'text/x-json':
                case 'application/javascript':
                case 'application/x-javascript':
                case 'text/javascript':
                case 'text/plain':
                    $headers = {
                        "Content-Security-Policy"   : null,
                        "X-Content-Security-Policy" : null
                    };
                    break;

                // otherwise, noop
                default:
                    $headers = {};
                    break;
            }
            return $headers;
        }
    },
    /* **************************************************************
     * notes:
     *   - detect "activator hash tokens" as defined by
     *     the "detection methodology" used by the Firefox addons:
     *       * "JSON-DataView"
     *       * "HTTP Archive (.HAR file format) Viewer"
     * **************************************************************
     * references:
     *     https://github.com/warren-bank/moz-json-data-view
     *     https://github.com/warren-bank/moz-harviewer
     * **************************************************************
     * related issue(s):
     *     https://github.com/warren-bank/moz-json-data-view/issues/5
     * **************************************************************
     */
    {
        "url" : /#./,
        "headers": function(){
            var $headers = {};
            var pattern = new RegExp('(^#?|[/,])(JSON-DataView|HTTP-Archive-Viewer)([/,]|$)', 'i');
            if (pattern.test(request.uri.hash)){
                $headers = {
                    "Content-Type"              : "application/json",
                    "Content-Disposition"       : null,
                    "Content-Security-Policy"   : null,
                    "X-Content-Security-Policy" : null
                };
                response.content_type           = $headers['content-type'];
            }
            return $headers;
        }
    },
    /* **************************************************************
     * notes:
     *   - normalize media types using the new "+json" suffix
     * **************************************************************
     * references:
     *     https://tools.ietf.org/html/rfc6839#section-3.1
     * **************************************************************
     * related issue(s):
     *     https://github.com/warren-bank/moz-json-data-view/issues/7
     * **************************************************************
     */
    {
        "url": /^.*$/,
        "headers": function(){
            var $headers = {};
            var pattern = /\+json$/i;
            if (pattern.test(response.content_type)){
                $headers = {
                    "Content-Type"              : "application/json",
                    "Content-Disposition"       : null,
                    "Content-Security-Policy"   : null,
                    "X-Content-Security-Policy" : null
                };
                response.content_type           = $headers['content-type'];
            }
            return $headers;
        }
    }
]
