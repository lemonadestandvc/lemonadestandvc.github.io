import pathlib
r=pathlib.Path(__file__).parent/'src'
t=(r/'template.html').read_text()
out=t.replace('/*CSS*/',(r/'style.css').read_text()+(r/'extra.css').read_text()).replace('/*JS*/',(r/'app.js').read_text().replace('/*HOUSE*/',(r/'house.js').read_text()))
(pathlib.Path(__file__).parent/'index.html').write_text(out)
print('built', len(out))
