# RAL(P)

## RatRater Analysis Language (Parser)

RALP is a microlib that lets me avoid manually coding flags. It also has other benefits. I thought about multiple possible ways but I eventually came up with this:

match: processed per file, one of

- type: name/contents
  contains: string
- type: name/contents
  regex: [regex, regex flags]
- type: and
  match: array of another match
- type: or
  match: array of another match
