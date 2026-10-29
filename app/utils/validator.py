from urllib.parse import urlparse

def validate_and_fix_url(url: str) -> str:
    if not url:
        raise ValueError("URL cannot be empty")
    
    # Hapus spasi
    url = url.strip()
    
    # Tambahkan scheme jika tidak ada
    if not url.startswith(('http://', 'https://')):
        url = f'https://{url}'
    
    parsed = urlparse(url)
    if not parsed.netloc:
         raise ValueError("Invalid URL format")
         
    return url
