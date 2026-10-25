"""Generate iOS AppIcon sizes from app_icon.png and patch Contents.json."""
import os, json
from PIL import Image

src = os.path.join(os.path.dirname(__file__), 'app_icon.png')
iconset = 'ios/App/App/Assets.xcassets/AppIcon.appiconset'
os.makedirs(iconset, exist_ok=True)

img = Image.open(src).convert('RGB')  # iOS icons must not have alpha

# (idiom, scale, size_pt)  ->  actual pixel size = size_pt * scale
specs = [
    ('iphone', 2, 20), ('iphone', 3, 20),
    ('iphone', 2, 29), ('iphone', 3, 29),
    ('iphone', 2, 40), ('iphone', 3, 40),
    ('iphone', 2, 60), ('iphone', 3, 60),
    ('ipad',   1, 20), ('ipad',   2, 20),
    ('ipad',   1, 29), ('ipad',   2, 29),
    ('ipad',   1, 40), ('ipad',   2, 40),
    ('ipad',   1, 76), ('ipad',   2, 76),
    ('ios-marketing', 1, 1024),
]

images = []
seen = set()
for idiom, scale, pt in specs:
    px = int(pt * scale)
    filename = f'Icon-{px}.png'
    if px not in seen:
        img.resize((px, px), Image.LANCZOS).save(os.path.join(iconset, filename))
        seen.add(px)
    entry = {'idiom': idiom, 'scale': f'{scale}x', 'size': f'{pt}x{pt}', 'filename': filename}
    images.append(entry)
    print(f'  {filename} ({idiom} {scale}x)')

contents = {'images': images, 'info': {'author': 'xcode', 'version': 1}}
with open(os.path.join(iconset, 'Contents.json'), 'w') as f:
    json.dump(contents, f, indent=2)

print('iOS icons generated.')
