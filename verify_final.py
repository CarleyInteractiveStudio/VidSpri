import os

def check_file_contains(filepath, search_string):
    if not os.path.exists(filepath):
        print(f"Error: {filepath} not found")
        return False
    with open(filepath, 'r') as f:
        content = f.read()
        if search_string in content:
            print(f"Found '{search_string}' in {filepath}")
            return True
        else:
            print(f"NOT Found '{search_string}' in {filepath}")
            return False

print("--- Checking Pixel Art Scaling ---")
check_file_contains('styles.css', 'image-rendering: pixelated')
check_file_contains('script-extraer.js', 'imageSmoothingEnabled = false')

print("\n--- Checking UI Defaults ---")
check_file_contains('extraer.html', '<option value="original" selected data-i18n="original">')

print("\n--- Checking History & Export Features in Preview ---")
check_file_contains('previsualizacion.html', 'id="history-section"')
check_file_contains('previsualizacion.html', 'id="export-card"')
check_file_contains('previsualizacion.html', 'function loadHistory()')
check_file_contains('previsualizacion.html', 'function downloadSpriteSheet()')
