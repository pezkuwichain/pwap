import os
import sys

# HARİÇ TUTULACAK KLASÖRLER
EXCLUDE_DIRS = {'crate_placeholders', '.git', 'target', 'node_modules', '__pycache__'}

# Düzeltilecek Kalıplar ve Yerine Geçecek Değerler
# Tekrar eden önekleri temizler.
REPLACEMENT_MAP = {
    "pezpez": "pez",
    "Pezpez": "Pez",
    "PEZPEZ": "PEZ",
    "PeZPeZ": "PeZ",
    "pezPez": "pez",
    "PEZpez": "PEZ",
}

def is_path_excluded(path):
    """Verilen yolun yasaklı bir klasörün içinde olup olmadığını kontrol eder."""
    parts = path.split(os.sep)
    return any(excluded in parts for excluded in EXCLUDE_DIRS)

def fix_double_prefix(text):
    """Metin içindeki çift PEZ öneklerini tek PEZ önekiyle değiştirir."""
    for old_prefix, new_prefix in REPLACEMENT_MAP.items():
        text = text.replace(old_prefix, new_prefix)
    return text

def process_content_updates(root_dir):
    """Belirtilen dizin altındaki tüm hedef dosyaların içeriğini günceller."""
    # Sadece .rs ve .toml gibi kod dosyalarını hedefleyelim.
    TARGET_EXTENSIONS = ('.rs', '.toml', '.md', '.txt', '.yml', '.yaml', '.json', '.py')

    print("--- Adım 1: Dosya İçeriklerinde Çift Önek Düzeltme ---")
    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=True):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        if is_path_excluded(dirpath):
            continue

        for filename in filenames:
            if filename.endswith(TARGET_EXTENSIONS) or filename == 'Cargo.lock':
                filepath = os.path.join(dirpath, filename)

                if os.path.basename(filepath) == os.path.basename(sys.argv[0]):
                    continue

                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()

                    original_content = content
                    content = fix_double_prefix(content)

                    if content != original_content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"  [İÇERİK DÜZELTİLDİ] Dosya içeriği: {filepath}")

                except Exception as e:
                    print(f"  [HATA] İçerik düzeltilirken: {filepath} -> {e}")

def rename_pezpez_paths(root_dir):
    """Dosya ve klasör adlarında geçen 'pezpez' önekini 'pez' olarak düzeltir (bottom-up)."""
    
    # 2. Klasör İsimlerini Düzelt (topdown=False, en alttan yukarı güvenli işlem)
    print("\n--- Adım 2: Klasör İsimlerinin Düzeltilmesi (pezpez -> pez) ---")
    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=False):
        
        if any(excluded in dirpath.split(os.sep) for excluded in EXCLUDE_DIRS):
            continue

        dirname = os.path.basename(dirpath)
        original_dirname = dirname
        new_dirname = fix_double_prefix(dirname)
        
        if new_dirname != original_dirname:
            old_path = dirpath
            new_path = os.path.join(os.path.dirname(dirpath), new_dirname)
            
            if os.path.exists(old_path) and not os.path.exists(new_path):
                try:
                    os.rename(old_path, new_path)
                    print(f"  [RENAME-DIR] {original_dirname} -> {new_dirname}")
                except OSError as e:
                    print(f"  [HATA] Klasör adlandırılamadı {original_dirname}: {e}")

    # 3. Dosya İsimlerini Düzelt (topdown=True, kökten aşağı)
    print("\n--- Adım 3: Dosya İsimlerinin Düzeltilmesi (pezpez -> pez) ---")
    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=True):
        
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        if is_path_excluded(dirpath):
            continue
            
        for filename in filenames:
            original_filename = filename
            new_filename = fix_double_prefix(filename)
            
            if new_filename != original_filename:
                old_path = os.path.join(dirpath, original_filename)
                new_path = os.path.join(dirpath, new_filename)
                
                if os.path.exists(old_path) and not os.path.exists(new_path):
                    try:
                        os.rename(old_path, new_path)
                        print(f"  [RENAME-FILE] {original_filename} -> {new_filename}")
                    except OSError as e:
                        print(f"  [HATA] Dosya adlandırılamadı {original_filename}: {e}")


def main():
    root_dir = os.getcwd()
    print("==================================================")
    print(f"🔧 PEZPEZ DÜZELTME (İçerik ve Ad) İşlemi Başlatılıyor...")
    print(f"⚠️ Çalışma Dizini: {root_dir}")
    print("==================================================")
    
    # Önce içerikleri düzelt (dosya yolları değişmeden)
    process_content_updates(root_dir)
    
    # Ardından dosya ve klasör adlarını düzelt
    rename_pezpez_paths(root_dir)
    
    print("\n✅ PEZPEZ Düzeltme işlemi tamamlandı.")

if __name__ == "__main__":
    main()