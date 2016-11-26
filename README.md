# [moz-rewrite](https://github.com/warren-bank/moz-rewrite)

Firefox add-on that functions as a light-weight (pseudo) rules-engine for easily modifying HTTP headers in either direction

## Summary

* Swiss Army knife for anyone interested in writing rules to intercept and conditionally modify HTTP traffic
* a distinct set of rules are written for each:
  * (outbound) requests
  * (inbound) responses
* all data sets use file-based persistence
* rules can:
  * add/edit/remove HTTP headers
  * cancel the request
  * redirect the request
  * save a record of the request
* saved requests can:
  * be _replayed_ using (supported) external download tools.<br>
    _replayed_ requests include all the HTTP headers and POST data in the original/saved request.

## Video Tutorial

[2+ hour long screencast](https://www.youtube.com/watch?v=l8uIiiVo1yw) that is a detailed walk-through of installation, configuration and usage

## Features

* regex patterns are used to match rules against the requested URL
* rules are applied incrementally, until either:
  * all rules have been processed
  * a rule is marked as being final
* rules are declared within a well-defined data structure.<br>
  this data isn't JSON; it is evaluated as javascript.<br>
  as such:
  * all javascript data types are supported,<br>
    including those that aren't representable using JSON.<br>
    for example:
    * comments
    * regex patterns
      * literal <sub>(ie: perl)</sub> notation: `//`
      * object constructor: `new RegExp('')`
    * functions
  * the declaration for the data structure can contain inline code,<br>
    which is interpolated only once during evaluation,<br>
    immediately after the data file is initially read from disk.<br>
    for example:
    * storing the output of a helper function as (part of) a static value
    * calling an "immediately-invoked function expression" (aka: "self-executing anonymous function"), and storing its output as (part of) a static value
* where a function is present, it will be called each time the rule is evaluated.
  * rules are evaluated for every request and/or response.
  * when functions are called, there will be contextual variables as well as helper functions in scope.
  * the contextual variables will allow the function to return a value that is dependent upon the state of the request/response.
  * the helper functions provide a library to perform tasks that:
    * are commonly used to generate HTTP header values
    * provide enhanced capabilities, unrelated to modifying HTTP header values
* where inline javascript code is present, the javascript will only be evaluated once.
  * this occurs when the rules are read from an external file and evaluated into a javascript array of rule objects.
  * when this evaluation occurs, there is no contextual request or response.. so there are no contextual variables in scope.
  * however, the same helper functions that are always available to functions (that are defined within the rules data set) will also be available at the time that the rules data set is initialized/evaluated.

## Contextual Variables <sub>(in scope when functions are called)</sub>

  * _both requests and responses_
    * `request.window_location` = {}<br>
      keys:
      * `href`: [string] full URI
      * `protocol`: [string]<br>
        for example:
        * `http:`
        * `https:`
        * `file:`
      * `username`: [string]
      * `password`: [string]
      * `host`: [string]
      * `port`: [string]
      * `path`: [string]
      * `query`: [string]
      * `hash`: [string]
      * `file_ext`: [string]
    * `request.uri` = {}

        >  <sub>same keys as: `request.window_location`</sub>
    * `request.original_uri` = {}

        >  <sub>same keys as: `request.window_location`</sub>
    * `request.referrer` = {}

        >  <sub>same keys as: `request.window_location`</sub>
    * `request.method` [string]
    * `request.headers` = {}
    * `request.headers.unmodified` = {}<br>
      hash of all HTTP headers in original/unmodified request
    * `request.headers.updated` = {}<br>
      hash of all HTTP headers that the rules array data set (for requests) has incrementally modified at the current point of rules processing.
      * this hash is empty before any rules are processed.
      * as rules are processed in sequential order, any rule that matches the requested URL may specify updated HTTP headers which will be applied to this hash object.
      * when rule processing is completed, the final state of this hash will be applied to the HTTP request.
        * a `string` value will set/update the HTTP header corresponding to its hash key.
        * a `boolean` __false__ value will be ignored.
        * a __null__ value will remove the HTTP header corresponding to its hash key (if originally present).

  * _request only_

  * _response only_
    * `response.headers` = {}
    * `response.headers.unmodified` = {}<br>
      hash of all HTTP headers in original/unmodified response
    * `response.headers.updated` = {}<br>
      hash of all HTTP headers that the rules array data set (for responses) has incrementally modified at the current point of rules processing.

        >  <sub>see additional notes under: `request.headers.updated`</sub>
    * `response.status_code` [integer]
    * `response.charset` [string]
    * `response.content_length` [integer]
    * `response.content_type` [string]

## Helper Functions <sub>(in scope when functions are called)</sub>

  * _always available_
    * `atob(string_base64_encoded)`<br>
      decodes a string of data which has been encoded using base-64 encoding.

    * `base64_decode(string_base64_encoded)`

        >  <sub>alias for: `atob`</sub>

    * `btoa(string_value)`<br>
      creates a base-64 encoded ASCII string from a "string" of binary data.

    * `base64_encode(string_value)`

        >  <sub>alias for: `btoa`</sub>

    * `md2(string_value)`<br>
      returns the result of hashing the input string using the `md2` crypto hash function

    * `md5(string_value)`<br>
      returns the result of hashing the input string using the `md5` crypto hash function

    * `sha1(string_value)`<br>
      returns the result of hashing the input string using the `sha1` crypto hash function

    * `sha256(string_value)`<br>
      returns the result of hashing the input string using the `sha256` crypto hash function

    * `sha384(string_value)`<br>
      returns the result of hashing the input string using the `sha384` crypto hash function

    * `sha512(string_value)`<br>
      returns the result of hashing the input string using the `sha512` crypto hash function

    * `format_date(Date | parsable_date_string)`<br>
      returns the date as a UTC formatted string

    * `format_date(null, 1)`<br>
      returns the __current__ date as a UTC formatted string

    * `log()`<br>
      for all usage patterns, refer to [_docs_](https://developer.mozilla.org/en-US/docs/Web/API/Console/log)<br>
      _helpful tip:_ configure the javascript console to __"enable persistent logs"__

  * _both requests and responses_
    * `save()`<br>
      prepends a record of the current request to the `Output File`.<br>
      this record will be available for _replay_ via the ___view/replay saved requests___ dialog window.

* _request only_
    * `redirectTo(string_URI)`<br>
      HTTP redirection works for any matching request URL.<br>
      When the matching request URL is the top-level page loading in a browser tab,<br>
      * the HTTP request is cancelled
      * `window.location = string_URI`

      When the matching request URL is a page resource that's referenced by a top-level page loading in a browser tab,<br>
      * the HTTP request is redirected and the alternate resource is loaded in its place

      For an example of top-level page redirection,<br>check out the [recipe: `redirect search engine queries from Yahoo to Google`](https://github.com/warren-bank/moz-rewrite/blob/js/data/recipe-book/request/redirect%20search%20engine%20queries%20from%20Yahoo%20to%20Google.js)

      For an example that illustrates both top-level as well as resource redirection,<br>check out the [recipe: `redirect Google favicon`](https://github.com/warren-bank/moz-rewrite/blob/js/data/recipe-book/request/redirect%20Google%20favicon.js)

    * `cancel()`<br>
      completely cancels the HTTP request.

      For an example,<br>check out the [recipe: `light weight ad-blocker`](https://github.com/warren-bank/moz-rewrite/blob/js/data/recipe-book/request/light%20weight%20ad-blocker.js)

  * _response only_

## Data Structure

* the same data structure (schema) applies to both requests and responses
* request and response data are defined separately
* the data structure is an array of objects, where each object represents a rule.
* each rule can have the following attributes:
  * `url` (required, `RegExp`)
  * `headers` (required, `object` or `function`):
    * key = name of HTTP header
    * value = determines what action to take
      * [`string`]:<br>
        new value of HTTP header
      * [`boolean`, value === __false__]:<br>
        ignore all previous rules for this HTTP header,<br>
        and leave the original value unmodified
      * [`object`, value === __null__]:<br>
        remove HTTP header from request/response
  * `stop` (optional, `boolean` or `function`):<br>
    when:
    * the `url` pattern of this rule matches the requested URL, _and_
    * processing of this rule is complete

    then:
    * [__false__, default]: process next rule (in array)
    * [__true__]: do not process any additional rules
* while each request/response is processed by its corresponding rules data set,<br>
  when a `url` pattern match occurs for a rule,<br>
  when either the `headers` or `stop` attribute of the matching rule object is declared as a javascript function:
  * contextual variables will be constructed and made availabe to the function that will convey information about the particular request/response being processed.
  * the function is expected to return the proper data type; otherwise, its output will be ignored.
* while rules are being processed, an internal list of updates is being created and incrementally updated.
* when the processing of rules is complete, this internal list of updates are applied to the request/response.

## Simple Examples

* sample _request_ rule(s):

```javascript
[
    /* ****************************************************
     * all requests: add 3 custom headers
     * ****************************************************
     */
    {
        "url" : /^.*$/,
        "headers" : {
            "X-Custom-Sample-Header-01" : "Foo",
            "X-Custom-Sample-Header-02" : "Bar",
            "X-Custom-Sample-Header-03" : "Baz"
        }
    },
    /* ****************************************************
     * secure requests: cancel the 3 custom headers, and stop processing rules
     * ****************************************************
     */
    {
        "url" : /^https/i,
        "headers" : {
            "X-Custom-Sample-Header-01" : false,
            "X-Custom-Sample-Header-02" : false,
            "X-Custom-Sample-Header-03" : false
        },
        "stop": true
    },
    /* ****************************************************
     * all requests: update 1st custom header, cancel 3rd custom header
     * ****************************************************
     */
    {
        "url" : /^.*$/,
        "headers" : {
            "X-Custom-Sample-Header-01" : "Hello",
            "X-Custom-Sample-Header-03" : false
        }
    }
    /* ****************************************************
     * assertion #1: non-secure URL request
     * expected result:
     *     X-Custom-Sample-Header-01: Hello
     *     X-Custom-Sample-Header-02: Bar
     * ****************************************************
     */
]
```

* sample _response_ rule(s):

```javascript
[
    /* ****************************************************
     * purpose: map an applicable 'content-type' to a finite set of resources
     *          as identified by file extension, when loaded from local hard disk.
     * ****************************************************
     */
    {
        "url" : new RegExp('^file://', 'i'),
        "headers" : function(){
            var $headers = {};
            switch( request.uri.file_ext.toLowerCase() ){
                case 'txt':
                    $headers['content-type'] = 'text/plain';
                    break;
                case 'css':
                    $headers['content-type'] = 'text/css';
                    break;
                case 'js':
                    $headers['content-type'] = 'application/javascript';
                    break;
                case 'json':
                    $headers['content-type'] = 'application/json';
                    break;
            }
            if ( $headers['content-type'] ){
                response.content_type = $headers['content-type'];
            }
            return $headers;
        },
        "stop": true
    }
]
```

## More Complicated Examples

* a collection of various interesting rules and useful examples has been dubbed the _recipe book_
* it can be found in its own branch of this repo, named: [_js/data/recipe-book_](https://github.com/warren-bank/moz-rewrite/tree/js/data/recipe-book)
* users are encouraged to contribute (via push request) additional _recipe_ examples

## User Preferences

  * __input: rules data__
    * _HTTP Requests (outbound)_:
      * Enabled
        > default: on

        on/off toggle
        * on:<br>intercept _HTTP Requests_ and apply its corresponding set of rules
        * off:<br>disable this feature entirely

      * Path to Rules File
        > default: ''

        >  <sub>refer to __Comments / Implementation Notes__ for advanced usage</sub>

      * Watch Interval (ms, 0 to disable)
        > default: `0` (off)

        useful while writing/testing new rules.<br>
        this feature will watch the rules file for changes, and reload its contents as needed.

    * _HTTP Responses (inbound)_:
      * Enabled
        > default: on

        on/off toggle
        * on:<br>intercept _HTTP Responses_ and apply its corresponding set of rules
        * off:<br>disable this feature entirely

      * Path to Rules File
        > default: ''

        >  <sub>refer to __Comments / Implementation Notes__ for advanced usage</sub>

      * Watch Interval (ms, 0 to disable)
        > default: `0` (off)

        useful while writing/testing new rules.<br>
        this feature will watch the rules file for changes, and reload its contents as needed.

  * __output: _save()___
    * _HTTP Request Persistence_:
      * Enabled
        > default: on

        on/off toggle
        * on:<br>the `save()` helper function will save a record of the request to `Output File`
        * off:<br>disable this feature entirely

      * Path to Output File
        > default: ''

        >  <sub>refer to __Comments / Implementation Notes__ for advanced usage</sub>

      * Maximum Number of Saved Requests
        > default: `10`

        this feature is intended to prevent the `Output File` from growing too large

        * `> 0`:<br>when a request record is saved to `Output File`, the data is prepended. If after this addition there are more records stored in the file (ie: `N`) than the specified maximum number of records (ie: `X`), then only the first `X` are retained&hellip; and the trailing `(N-X)` are removed.
        * `0`:<br>allow the file to grow without any limitation.

  * __tools to _replay_ saved requests__
    * _common settings_:
      * Path to Download Directory
        > default: `{DfltDwnld}`

        >  <sub>refer to __Comments / Implementation Notes__ for advanced usage</sub>

    * _wget_:
      * Path to `wget` executable
        > default: `/usr/bin/wget`

        >  <sub>refer to __Comments / Implementation Notes__ for advanced usage</sub>

      * Command-Line Options for `wget` executable
        > default: `-c -nd --content-disposition --no-http-keep-alive --no-check-certificate -e robots=off --progress=dot:binary`

    * _curl_:
      > a reference implementation that adds support for this tool exists in a separate branch: [_js/eval/replay/curl_](https://github.com/warren-bank/moz-rewrite/tree/js/eval/replay/curl)

      > this hasn't been merged into the `js/eval/master` branch due to a small incompatability, which is described pretty well across both:
        * the [release notes for: js/eval/v2.00](https://github.com/warren-bank/moz-rewrite/releases/tag/js%2Feval%2Fv2.00)
        * the [commit message for: 32cb770](https://github.com/warren-bank/moz-rewrite/commit/32cb77021d295c8e037381cd6e85df52f9c0f236)

## Hidden Preferences

  * `extensions.Moz-Rewrite.debug`
    > default: `false`

    _boolean_
    * `true`:<br>enables debug log messages to be printed to the `Browser Console`
    * `false`:<br>suppresses these log messages

  * `extensions.Moz-Rewrite.case_sensitive`
    > default: `false`

    _boolean_
    * `true`:<br>the alphabetic case of the URL and its components are preserved
    * `false`:<br>the URL and its components are always normalized to lowercase, which allows regex patterns to be written in lowercase and omit a _case insensitive_ flag

## Dialog Windows

  * `Tools -> moz-rewrite -> user preferences`

    > * same `Options` dialog as:<br>
        * `Tools -> Add-ons`
          * `Extensions`
            * `moz-rewrite -> Options`
    > * provides a graphical interface for the user to apply changes to the values of (non-hidden / user) addon preferences

  * `Tools -> moz-rewrite -> view/replay saved requests`

    > * _saved HTTP Requests_:
        * list of all saved requests.<br>
          for each, a checkbox is followed by the corresponding URL.
    > * common form field controls
    >   * _replay selected requests using.._

    >     > button that displays a list of all supported download tools.<br>
            this list currently contains:
    >     > * wget

    >   * _interactively identify each partial/incomplete download file_

    >     > checkbox that
    >     > * when:
              * one or more _saved HTTP Requests_ are selected
              * a download tool is chosen/activated from the list
    >     > * if `checked`:
              * for each of the selected _saved HTTP Requests_, an interactive `file picker` dialog will open and allow the user to choose the file path for the download.
                * this workflow allows using the external download tool to be used to save data to arbitrary paths within the filesystem,<br>
                  rather than only to the `Download Directory`.
                * this is particularly useful for when the browser begins a download, but fails to complete.<br>
                  in such a case,
                  * if the request was saved&hellip;<br>
                    or if the browser can re-request the download, and this subsequent request is saved&hellip;<br>
                    <sub>without actually saving the file, and certainly __NOT__ over writing the previously downloaded partial/incomplete file</sub>
                  * then the interactive dialog would allow the user to browse for this partial/incomplete file download
    >     > * if not `checked`:
              * for each of the selected _saved HTTP Requests_, the chosen download tool will begin saving/resuming the requested data.
                * this data will be saved to a file in the `Download Directory`
                * the filename will be determined by the external download tool.<br>
                  factors that the tool may take into consideration:
                  * a filename component of the requested URL
                  * a 'content-disposition' header of the response
                  * command-line options for the tool (in addon preferences)

    >   * _fallback behavior when 'cancel' is chosen in interactive dialog_

    >     > checkbox that
    >     > * when:
              * _interactively identify each partial/incomplete download file_ is `checked`
              * an interactive `file picker` dialog is closed by the user without having selected a filepath
                * `cancel` button
                * `close window` (ie: "X") button
    >     > * if `checked`:
              * proceed with download and save to default directory
    >     > * if not `checked`:
              * skip _replay_ of the specific saved request

## Comments / Implementation Notes

  * data sets are stored in external files.<br>
    this allows them to be maintained using any text editor.

  * the addon asks to know the file path to each data set.<br>
    one for requests, one for responses.

  * there are two ways to specify a file path:
    * browse for file, which stores an absolute path.
    * manually enter the path, which is parsed in such a way that portable/relative paths are supported.<br>
      * when this path begins with one of the following special tokens,<br>
        the token will be replaced with the corresponding directory path.
      * the absolute path of these "special directories" may change from FF shutdown to startup,<br>
        but the relative path will remain valid.
      * these "special tokens/directories" include:
        * `{ProfD}`: <br>profile directory
        * `{CurProcD}`: <br>current working directory (usually the application's installation directory)
        * `{ProfDefNoLoc}`: <br>`%installation%/defaults/profile`
        * `{PrfDef}`: <br>`%installation%/defaults/pref`
        * `{Desk}`: <br>user's desktop directory
        * `{Home}`: <br>user's home directory
        * `{DfltDwnld}`: <br>default Downloads directory
        * `{TmpD}`: <br>operating system's temporary files directory
      * sample interpolation values:
        * Windows, [PortableApps](http://portableapps.com/apps/internet/firefox_portable):
          * `{ProfD}`: <br>`C:\PortableApps\Firefox\Data\profile`
          * `{CurProcD}`: <br>`C:\PortableApps\Firefox\App\firefox\browser`
          * `{ProfDefNoLoc}`: <br>`C:\PortableApps\Firefox\App\firefox\browser\defaults\profile`

              >  <sub>_(note: directory does not exist)_</sub>
          * `{PrfDef}`: <br>`C:\PortableApps\Firefox\App\firefox\defaults\pref`
          * `{Desk}`: <br>`REG QUERY "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" /v Desktop`
          * `{Home}`: <br>`%USERPROFILE%`
          * `{DfltDwnld}`: <br>`%USERPROFILE%\Downloads`
          * `{TmpD}`: <br>`%TEMP%`
      * so.. if portability is a concern, then the following file/directory paths should work nicely:
          >  <sub>_(note: the specified paths must already exist; files/directories **won't** be created.)_</sub>

        * `{ProfD}/moz-rewrite/requests.js`
        * `{ProfD}/moz-rewrite/responses.js`
        * `{ProfD}/moz-rewrite/saved_requests.txt`
        * `{ProfD}/moz-rewrite/downloads`

  * when enabled (in addon preferences), the addon will watch input data files for updates.
  * when the path to an input data file is changed (in addon preferences),<br>
    or an input data file having a watched path has been updated (identified by its _last modification date_):
    * the file contents are read into a string
    * the string is evaluated as javascript
    * the return value is validated for having the proper schema
    * the rules array is stored (in memory)
  * when a request/response observer is notified:
    * the corresponding rules array is processed, sequentially until complete
    * the list of updates are applied to the request/response
  * the heavy lifting is converting the javascript entered by the user in the rules files into (in-memory) data objects.
    * this occurs infrequently, only as-needed.
    * the size of the (in-memory) data objects will be very small.
    * the performance cost of calling functions within these data objects is trivial.
    * this cost is farther reduced by using a strategy that counts the number of functions within the rules array data set during its validation.
    * if there are no functions, then there's no need to create the contextual variables that would normally be available (in scope) to functions;
    * when it's appropriate to do so, eliminating this step makes the performance cost (of processing the corresponding rules array data set) extremely low.

## Alternate Implementations / Branches

  * [`js/eval/master`](https://github.com/warren-bank/moz-rewrite/tree/js/eval/master):
    * rule data files contain javascript, and are evaluated using the `eval()` function
    * security context: _system_ principal
      * pros:
        * has the ability to run protected code from within user-defined functions
      * cons:
        * would (most likely) fail AMO review.<br>
          for security related considerations, they have a general policy to disallow any addon that uses the `eval()` function.

  * [`js/Cu.evalInSandbox/master`](https://github.com/warren-bank/moz-rewrite/tree/js/Cu.evalInSandbox/master) (_default, current_):
    * rule data files contain javascript, and are evaluated using the Mozilla `Cu.Sandbox` and `Cu.evalInSandbox` APIs
    * security context: _null_ principal
      * pros:
        * should pass AMO review
      * cons:
        * gives up the ability to run protected code from within user-defined functions

  * [`json/master`](https://github.com/warren-bank/moz-rewrite/tree/json/master):
    * rule data files contain JSON, and are parsed using the native `JSON.parse()` function
      * pros:
        * would pass AMO review
      * cons:
        * gives up the ability to declare user-defined functions within the rules data sets
        * gives up the ability to perform actions:
          * that are conditional on the state of contextual variables
          * that are only available through helper functions

## AMO <sub>(<b>a</b>ddons.<b>m</b>ozilla.<b>o</b>rg)</sub>

  * [v1.03](https://github.com/warren-bank/moz-rewrite/releases/tag/json%2Fv1.03) of the [`json/master`](https://github.com/warren-bank/moz-rewrite/tree/json/master) branch is available on [AMO](https://addons.mozilla.org/en-US/firefox/addon/moz-rewrite-json/)
  * [v1.00](https://github.com/warren-bank/moz-rewrite/releases/tag/js%2FCu.evalInSandbox%2Fv1.00) of the [`js/Cu.evalInSandbox/master`](https://github.com/warren-bank/moz-rewrite/tree/js/Cu.evalInSandbox/master) branch is pending review on [AMO](https://addons.mozilla.org/en-US/firefox/addon/moz-rewrite-js/)

## License
  > [GPLv2](http://www.gnu.org/licenses/gpl-2.0.txt)
  > Copyright (c) 2014, Warren Bank
