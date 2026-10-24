-- NOIZYLAB · scripts/notes/export_all_notes.applescript
-- Exports EVERY Apple Note (synced from iPhone via iCloud) to plain files on the Mac.
-- One .html file per note, in a folder per Notes folder. Read-only: nothing in Notes is changed.
-- Run on the Mac:  osascript scripts/notes/export_all_notes.applescript
-- Output:          ~/NOIZYBEAST/notes-export/
-- Locked (password-protected) notes cannot be read and are listed in _skipped.txt.
-- killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

on clean(t)
	set bad to {"/", ":", "\\", "\"", "*", "?", "<", ">", "|", return, linefeed}
	set out to ""
	repeat with c in (characters of t)
		if bad contains (c as text) then
			set out to out & "-"
		else
			set out to out & c
		end if
	end repeat
	if length of out > 80 then set out to text 1 thru 80 of out
	if out is "" then set out to "untitled"
	return out
end clean

on writeText(p, txt)
	set fh to open for access (POSIX file p) with write permission
	set eof of fh to 0
	write txt to fh as «class utf8»
	close access fh
end writeText

set root to (POSIX path of (path to home folder)) & "NOIZYBEAST/notes-export/"
do shell script "mkdir -p " & quoted form of root
set skipped to ""
set total to 0

tell application "Notes"
	repeat with acc in accounts
		set accName to my clean(name of acc as text)
		repeat with f in folders of acc
			set dirPath to root & accName & "/" & my clean(name of f as text) & "/"
			do shell script "mkdir -p " & quoted form of dirPath
			set i to 0
			repeat with n in notes of f
				set i to i + 1
				try
					if password protected of n then error "locked"
					set ttl to name of n as text
					set html to body of n as text
					set made to (creation date of n) as text
					set changed to (modification date of n) as text
					set header to "<!-- title: " & ttl & " | created: " & made & " | modified: " & changed & " -->" & linefeed
					my writeText(dirPath & (i as text) & "-" & my clean(ttl) & ".html", header & html)
					set total to total + 1
				on error
					set skipped to skipped & accName & " / " & (name of f as text) & " / note " & i & linefeed
				end try
			end repeat
		end repeat
	end repeat
end tell

my writeText(root & "_skipped.txt", skipped)
return "Exported " & total & " notes to " & root
