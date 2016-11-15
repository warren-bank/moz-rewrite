@echo off

set unsigned_xpi=%~dp0.\moz-rewrite-js.xpi

cd /D "%~dp0..\.."

rem :: http://sevenzip.sourceforge.jp/chm/cmdline/commands/add.htm

7z a -tzip -scsUTF-8 "%unsigned_xpi%" ".\chrome.manifest" ".\install.rdf" ".\LICENSE" ".\README.md" "chrome\" "components\04_modular_addon\" "defaults\"
