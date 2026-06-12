import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove cursor: none
content = re.sub(r'cursor:\s*none;?', '', content)

# Remove style blocks for cursor
content = re.sub(r'#cursor\s*\{[^}]+\}', '', content)
content = re.sub(r'#cursor-ring\s*\{[^}]+\}', '', content)
content = re.sub(r'a:hover ~ #cursor, button:hover ~ #cursor \{[^}]+\}', '', content)

# Remove DOM elements
content = re.sub(r'<div id=\"cursor\"></div>', '', content)
content = re.sub(r'<div id=\"cursor-ring\"></div>', '', content)

# Remove JS
content = re.sub(r'// -- CURSOR --.*?\}\);', '', content, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
