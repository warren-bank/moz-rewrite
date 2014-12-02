[
    /* **************************************************************
     * first, the INCREDIBLY INEFFICIENT way.
     * this methodology constructs a RegExp object each time the function is called,
     * which happens A LOT.
     * **************************************************************
     */
    {
        "url" : /^.*$/,
        "headers" : function(){
            var url_patterns = [];
            var pattern;

            // initial 5 patterns in: "EasyList" (01 Dec 2014 21:30 UTC)
            //     https://easylist.adblockplus.org/en/
            //     https://easylist-downloads.adblockplus.org/easylist.txt
            url_patterns.push('&ad_box_');
            url_patterns.push('&ad_channel=');
            url_patterns.push('&ad_classid=');
            url_patterns.push('&ad_height=');
            url_patterns.push('&ad_keyword=');

            pattern = '(?:' + url_patterns.join('|') + ')';
            pattern = new RegExp(pattern, 'i');

            if (pattern.test(request.uri.href)){
                cancel();
            }
            return {};
        }
    },
    /* **************************************************************
     * now, the INCREDIBLY PERFORMANT way.
     * this methodology constructs a RegExp object only once,
     * which happens when the rules file is read from disk.
     * **************************************************************
     * notes:
     *   - same 5 patterns, as copied from EasyList
     *   - this regex could be HIGHLY optimized by compacting common patterns.
     *     there may already exist a library to do this type of optimization.
     *     a quick scan of CPAN found this:
     *       * Regexp::Optimizer
     *         http://search.cpan.org/~dankogai/Regexp-Optimizer-0.15/lib/Regexp/Optimizer.pm
     * **************************************************************
     * assumptions:
     *   - regex pattern is normalized to lowercase
     *   - value of preference `extensions.Moz-Rewrite.case_sensitive` = false
     * benefit:
     *   - it becomes safe to construct the regex object without the `case insensitive` switch.
     *     this makes the pattern matching task simpler for the regex engine and improves performance.
     * **************************************************************
     */
    {
        "url" : new RegExp('(?:&ad_box_|&ad_channel=|&ad_classid=|&ad_height=|&ad_keyword=)'),
        "headers" : function(){
            cancel();
            return {};
        },
        "stop" : true
    }
]
