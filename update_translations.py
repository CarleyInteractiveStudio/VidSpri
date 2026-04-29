import re

history_translations = {
    'ar': 'السجل',
    'de': 'Verlauf',
    'en': 'History',
    'es': 'Historial',
    'fr': 'Historique',
    'hi': 'इतिहास',
    'id': 'Riwayat',
    'it': 'Cronologia',
    'jp': '履歴',
    'ko': '히스토리',
    'ms': 'Sejarah',
    'nl': 'Geschiedenis',
    'pl': 'Historia',
    'pt': 'Histórico',
    'pt_BR': 'Histórico',
    'ru': 'История',
    'th': 'ประวัติ',
    'tr': 'Geçmiş',
    'vi': 'Lịch sử',
    'zh': '历史'
}

with open('translations.js', 'r', encoding='utf-8') as f:
    content = f.read()

for lang, trans in history_translations.items():
    pattern = rf'({lang}:\s*\{{[^}}]*?help_title:\s*"[^"]*",)'
    replacement = rf'\1\n        history: "{trans}",'
    # We need a more robust way to match the language block
    # Let's try matching the language key and then finding help_title inside it

new_content = content
for lang, trans in history_translations.items():
    # Find the start of the language object
    lang_start = new_content.find(f'    {lang}: {{')
    if lang_start == -1:
        lang_start = new_content.find(f'\n    {lang}: {{')

    if lang_start != -1:
        # Find help_title within this block (before the next language or end of object)
        help_title_idx = new_content.find('help_title:', lang_start)
        if help_title_idx != -1:
            # Find the end of the line
            line_end = new_content.find('\n', help_title_idx)
            if line_end != -1:
                # Insert the history key after this line
                insertion = f'\n        history: "{trans}",'
                new_content = new_content[:line_end] + insertion + new_content[line_end:]

with open('translations.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
