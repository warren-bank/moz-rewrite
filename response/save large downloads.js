[
    /* **************************************************************
     * notes:
     *   - for efficiency sake,
     *     `threshold` should NOT be calculated within the function.
     *     (as was done here for the purpose of better readability)
     *   - it would be much better to calculate this value ahead of time,
     *     and include a hard-coded integer in the function.
     * **************************************************************
     */
    {
        "url" : /^.*$/,
        "headers" : function(){
            var KB, MB, GB;
            KB = 1024;
            MB = KB * KB;
        //  GB = KB * MB;

            var threshold = 100 * MB;

            if (response.content_length >= threshold){
                save();
            }
            return {};
        }
    }
]
