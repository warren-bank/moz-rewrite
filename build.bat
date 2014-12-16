@echo off

rem :: http://sevenzip.sourceforge.jp/chm/cmdline/commands/add.htm

7z a -tzip -scsUTF-8 "rewrite-http-headers.xpi" ".\chrome.manifest" ".\install.rdf" ".\LICENSE" ".\README.md" "chrome\" "components\04_modular_addon\" "defaults\"
