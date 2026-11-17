#!/bin/sh
# Runs every program in the report against the Vite server on port 5195 (see the report's last section).
cd "$(dirname "$0")"
r() { echo "== $1"; shift; node run.mjs "$@" 2>&1 | grep -v "SILENT_HOLD\|in <V"; }
B="snap click:go snap click:close snap wait:100 snap wait:300 snap"
C="snap click:next snap click:toggle snap wait:100 snap wait:300 snap"
r "A  a.rx" a snap click:go snap
r "B  b.rx" b $B
r "B  b-no-equation.rx" b-no-equation $B
r "B  solid.html" solid.html $B
r "B  solid.html?lazy" "solid.html?lazy" $B
r "C  b-shown.rx" b-shown $B
r "C  b-shown-onflush.rx" b-shown-onflush snap click:go snap wait:100 snap wait:300 snap
r "C  b-view-reader.rx" b-view-reader $B
r "D  c.rx" c snap click:toggle snap click:toggle snap click:next snap click:toggle snap wait:100 snap wait:300 snap
r "D  c-onflush.rx" c-onflush $C
r "D  c-two-contexts.rx" c-two-contexts $C
r "D  c-closures.rx" c-closures $C
r "D  c-latest.rx" c-latest $C
r "D  c-guess.rx" c-guess $C
r "D  solid-d.html" solid-d.html $C
r "D  solid-d.html?getters" "solid-d.html?getters" $C
r "owner  d.rx" d snap click:pick snap wait:100 snap wait:300 snap
r "owner  d-onflush.rx" d-onflush snap click:pick snap wait:100 snap wait:300 snap
