#!/usr/bin/env bash
# Stands in for curl while the tests run. It records every argument it was
# given, one per line, then answers with the canned reply the test arranged.
# bc.sh asks curl to print the status code on a line of its own, so this
# does the same.
#
# A test can queue one more reply in $REPLY_BODY.next and $REPLY_CODE.next.
# After the first answer, those files become the reply for the next call.

printf '%s\n' "$@" >>"$ARGS"

cat "$REPLY_BODY"
printf '\n'
cat "$REPLY_CODE"

if [[ -f "$REPLY_BODY.next" ]]; then
    mv "$REPLY_BODY.next" "$REPLY_BODY"
    mv "$REPLY_CODE.next" "$REPLY_CODE"
fi
