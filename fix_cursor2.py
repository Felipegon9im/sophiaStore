import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove cursor CSS properties
content = re.sub(r'cursor:\s*none;?', '', content)

# Remove style blocks for cursor
content = re.sub(r'#cursor\s*\{[^}]+\}', '', content)
content = re.sub(r'#cursor-ring\s*\{[^}]+\}', '', content)
content = re.sub(r'a:hover ~ #cursor, button:hover ~ #cursor\s*\{[^}]+\}', '', content)

# Remove DOM elements
content = re.sub(r'<div id=\"cursor\"></div>', '', content)
content = re.sub(r'<div id=\"cursor-ring\"></div>', '', content)

# Remove main JS block
pattern_main_js = r'// -- CURSOR --\s*const cursor = document\.getElementById\(\'cursor\'\).*?\}\);(?:[ \t]*\n)*'
content = re.sub(pattern_main_js, '', content, flags=re.DOTALL)

# Remove recalculate JS block inside openProductDetail
pattern_recalc = r'// Recalculate custom cursor bindings.*?\}\);\s*\}\);'
content = re.sub(pattern_recalc, '', content, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
