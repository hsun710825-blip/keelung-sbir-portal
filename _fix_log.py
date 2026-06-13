path = r"C:\Users\User\keelung-sbir-portal\DEPLOY_LOG.txt"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
old = 'git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m'
new = 'git commit -m'
if old in text:
    text = text.replace(old, new, 1)
with open(path, "w", encoding="utf-8") as f:
    f.write(text)
print("done")
