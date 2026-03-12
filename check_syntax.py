import sys

try:
    with open('backend/controllers/aiController.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check for backticks
    backticks = [i for i, char in enumerate(content) if char == '`']
    print(f"Total backticks: {len(backticks)}")
    for idx in backticks:
        # Get context
        start = max(0, idx - 20)
        end = min(len(content), idx + 20)
        print(f"Position {idx}: ...{content[start:end]}...")
    
    compile(content, 'backend/controllers/aiController.js', 'exec')
    print("Syntax check passed!")
except Exception as e:
    print(f"Error: {e}")
