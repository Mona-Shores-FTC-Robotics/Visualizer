# Auto Builder redesign: mock-up

`tip-mockup.src.html` is the clickable mock-up of the redesigned Auto Builder (the good path in TIP
chapters, one miss open at a time with its ladder of tries, every outcome behind a button, and a
start-from-scratch flow). It is a design prototype, not
app code: one HTML file, no build, with `l-quals`'s spots and steps hard-coded and rough times.

The two field images are placeholders (`__FIELD_LIGHT__`, `__FIELD_DARK__`). To view it, replace
them with data URIs of `public/fields/biobuzz-light.webp` and `biobuzz-dark.webp`:

```
python3 -c "import base64,sys;s=open('docs/redesign/tip-mockup.src.html').read()
for k,f in [('__FIELD_LIGHT__','biobuzz-light'),('__FIELD_DARK__','biobuzz-dark')]:
    s=s.replace(k,'data:image/webp;base64,'+base64.b64encode(open(f'public/fields/{f}.webp','rb').read()).decode())
open('/tmp/tip-mockup.html','w').write(s)"
```

then open `/tmp/tip-mockup.html` in a browser.

The decisions behind it, what's open and what to build next are in the handoff brief
(a shared doc, linked from the redesign issue or ask Dustin).
