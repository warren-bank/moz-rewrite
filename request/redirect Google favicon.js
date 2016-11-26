[
    {
        "url" : new RegExp('^https?://www\.google\.com/images/branding/product/ico/googleg_lodp\.ico$', 'i'),
        "headers" : function(){
            log('redirecting google favicon..');

            // from: https://www.google.com/images/branding/product/ico/googleg_lodp.ico
            // to...

            var string_url = 'https://github.com/fluidicon.png';

            redirectTo(string_url);
        }
    }
]

/* ********************************************************
 * test case #1:
 * =============
 *   load the image as the URL in the browser tab
 *
 * url:
 *   https://www.google.com/images/branding/product/ico/googleg_lodp.ico
 *
 * outcome:
 *   the URL in the browser tab is updated,
 *   and the alternate image loads
 *
 * test case #2:
 * =============
 *   load a web page that uses the image as an embedded resource
 *
 * url:
 *   https://www.google.com/
 *
 * note:
 *   the image appears as the "favicon" on all pages in the "google.com" domain
 *
 * outcome:
 *   google's favicon is swapped for that of github
 *
 * conclusions:
 * ============
 * - appears to be working perfectly
 * ********************************************************
 */
