unsigned_xpi=`pwd`'/moz-rewrite-js.xpi'

cd ../..

zip -r "$unsigned_xpi" chrome.manifest install.rdf LICENSE README.md chrome components defaults
