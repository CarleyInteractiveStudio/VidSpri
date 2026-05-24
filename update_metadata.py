import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

def update_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already has og:image
    if 'property="og:image"' in content or "property='og:image'" in content:
        print(f"Skipping {filepath} (already has og:image)")
        return

    # Extract title
    title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE | re.DOTALL)
    title = title_match.group(1).strip() if title_match else "VidSpri - Video to Sprite"

    # Extract description
    desc_match = re.search(r'<meta\s+name="description"\s+content="(.*?)"', content, re.IGNORECASE | re.DOTALL)
    if not desc_match:
        desc_match = re.search(r"<meta\s+name='description'\s+content='(.*?)'", content, re.IGNORECASE | re.DOTALL)

    description = desc_match.group(1).strip() if desc_match else "VidSpri: Crea hojas de sprites y animaciones para tus videojuegos en segundos"

    base_url = "https://vidspri.online/"
    og_url = base_url + (filepath if filepath != 'index.html' else '')
    image_url = "https://vidspri.online/logo.png"

    metadata = f"""
    <!-- Social Media Metadata -->
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{image_url}">
    <meta property="og:url" content="{og_url}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{image_url}">
"""

    # Inject before </head>
    if '</head>' in content:
        new_content = content.replace('</head>', metadata + '</head>')
    elif '</HEAD>' in content:
        new_content = content.replace('</HEAD>', metadata + '</HEAD>')
    else:
        print(f"Could not find </head> in {filepath}")
        return

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated {filepath}")

for html_file in html_files:
    update_html(html_file)
