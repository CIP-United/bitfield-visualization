out/bitfield.html: bitfield.html
	perl -pe 'BEGIN {undef $/;} s/<!--external-->.*?<!--external-->//smg' $@
