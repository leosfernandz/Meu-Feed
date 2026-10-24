import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
import html
import re
import gzip

# Fontes Oficiais RSS
FEEDS = {
    "politica_br": {
        "name": "Política Brasileira",
        "icon": "🏛️",
        "url": "https://g1.globo.com/rss/g1/politica/"
    },
    "politica_int": {
        "name": "Política Internacional",
        "icon": "🌐",
        "url": "https://g1.globo.com/rss/g1/mundo/"
    },
    "economia": {
        "name": "Economia & Negócios",
        "icon": "📈",
        "url": "https://g1.globo.com/rss/g1/economia/"
    },
    "futebol_br": {
        "name": "Futebol Brasileiro",
        "icon": "⚽",
        "url": "https://ge.globo.com/rss/ge/futebol/"
    },
    "inter": {
        "name": "Sport Club Internacional",
        "icon": "🇦🇹",
        "url": "https://ge.globo.com/rss/ge/futebol/times/internacional/"
    },
    "lutas": {
        "name": "UFC & Lutas",
        "icon": "🥊",
        "url": "https://ge.globo.com/rss/ge/combate/"
    },
    "tecnologia": {
        "name": "Tecnologia & Inovação",
        "icon": "💻",
        "url": "https://g1.globo.com/rss/g1/tecnologia/"
    }
}

def clean_text(text):
    if not text:
        return ""
    clean = re.sub(r'<[^>]+>', '', text)
    return html.unescape(clean).strip()

def extract_image(item_xml):
    for child in item_xml:
        if 'content' in child.tag or 'thumbnail' in child.tag:
            url = child.attrib.get('url')
            if url and url.startswith('http'):
                return url
        if child.tag == 'enclosure':
            url = child.attrib.get('url')
            if url and url.startswith('http'):
                return url

    desc = item_xml.findtext('description') or ''
    img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', desc, re.IGNORECASE)
    if img_match:
        return img_match.group(1)
    
    return None

def main():
    result_data = {}
    
    for cat_key, cat_info in FEEDS.items():
        articles = []
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept-Encoding': 'gzip, deflate'
            }
            req = urllib.request.Request(cat_info['url'], headers=headers)
            
            with urllib.request.urlopen(req, timeout=10) as response:
                content = response.read()
                
                # Se vier compactado em gzip, descompacta
                if response.info().get('Content-Encoding') == 'gzip':
                    content = gzip.decompress(content)
                
                # Decodifica garantindo utf-8 e ignorando caracteres inválidos
                xml_string = content.decode('utf-8', errors='ignore')
                root = ET.fromstring(xml_string)
                
                channel = root.find('channel')
                if channel is not None:
                    for item in channel.findall('item'):
                        title = clean_text(item.findtext('title'))
                        link = item.findtext('link') or ''
                        pub_date = item.findtext('pubDate') or ''
                        description = clean_text(item.findtext('description'))
                        img_url = extract_image(item)

                        if title and link:
                            articles.append({
                                "id": link,
                                "title": title,
                                "link": link,
                                "imageUrl": img_url,
                                "pubDate": pub_date,
                                "description": description,
                                "categoryKey": cat_key,
                                "categoryName": cat_info['name'],
                                "categoryIcon": cat_info['icon']
                            })
        except Exception as e:
            print(f"Erro ao buscar feed {cat_key}: {e}")
        
        result_data[cat_key] = articles

    output = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "feeds": FEEDS,
        "data": result_data
    }

    with open('feed.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("feed.json gerado com sucesso!")

if __name__ == '__main__':
    main()