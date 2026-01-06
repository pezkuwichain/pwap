import os
import sys

# HARİÇ TUTULACAK KLASÖRLER
EXCLUDE_DIRS = {'crate_placeholders', '.git', 'target', 'node_modules', '__pycache__'}

# Yeniden adlandırma haritası (Basit: sadece 'pallet'in önüne 'pez' ekle)
RENAME_MAP = {
    # Tireli (kebab-case) isimlendirmeler için
    "pallet-": "pezpallet-",
    # Alt çizgili (snake_case) isimlendirmeler için
    "pallet_": "pezpallet_",
}

# Not: Bu betik, 'Pallet-' veya 'PALLET-' gibi büyük harf varyasyonlarını dosya sisteminde 
# (çoğunlukla küçük harf veya tireli kullanılan) adreslemeyebilir, ancak en yaygın olanları hedefler.

def is_path_excluded(path):
    """Verilen yolun yasaklı bir klasörün içinde olup olmadığını kontrol eder."""
    parts = path.split(os.sep)
    return any(excluded in parts for excluded in EXCLUDE_DIRS)

def rename_paths(root_dir):
    """
    Dosya ve klasör adlarında geçen 'pallet' önekini 'pezpallet' olarak değiştirir.
    Bottom-up (en alttan yukarı) yaklaşımıyla klasör adlarını güvenli bir şekilde değiştirir.
    """
    
    # Adım 1: Dosya İsimlerini Düzelt (topdown=True, kökten aşağı)
    print("--- Adım 1: Dosya İsimlerinin Güncellenmesi (pallet -> pezpallet) ---")
    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=True):
        
        # Yasaklı klasörleri atla
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        if any(excluded in dirpath.split(os.sep) for excluded in EXCLUDE_DIRS):
            continue
            
        for filename in filenames:
            original_filename = filename
            new_filename = filename
            
            for old_prefix, new_prefix in RENAME_MAP.items():
                if old_prefix in new_filename:
                    # Basit string değiştirme, pez yaratma riskini taşıyoruz.
                    new_filename = new_filename.replace(old_prefix, new_prefix)
            
            if new_filename != original_filename:
                old_path = os.path.join(dirpath, original_filename)
                new_path = os.path.join(dirpath, new_filename)
                
                if os.path.exists(old_path) and not os.path.exists(new_path):
                    try:
                        os.rename(old_path, new_path)
                        print(f"  [RENAME-FILE] {original_filename} -> {new_filename}")
                    except OSError as e:
                        print(f"  [HATA] Dosya adlandırılamadı {original_filename}: {e}")

    # Adım 2: Klasör İsimlerini Düzelt (topdown=False, en alttan yukarı güvenli işlem)
    print("\n--- Adım 2: Klasör İsimlerinin Güncellenmesi (pallet -> pezpallet) ---")
    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=False):
        
        if any(excluded in dirpath.split(os.sep) for excluded in EXCLUDE_DIRS):
            continue

        dirname = os.path.basename(dirpath)
        original_dirname = dirname
        new_dirname = dirname
        
        for old_prefix, new_prefix in RENAME_MAP.items():
            if old_prefix in new_dirname:
                new_dirname = new_dirname.replace(old_prefix, new_prefix)
        
        if new_dirname != original_dirname:
            old_path = dirpath
            new_path = os.path.join(os.path.dirname(dirpath), new_dirname)
            
            if os.path.exists(old_path) and not os.path.exists(new_path):
                try:
                    os.rename(old_path, new_path)
                    print(f"  [RENAME-DIR] {original_dirname} -> {new_dirname}")
                except OSError as e:
                    print(f"  [HATA] Klasör adlandırılamadı {original_dirname}: {e}")

def main():
    root_dir = os.getcwd()
    print("==================================================")
    print(f"🗂️ Dosya Adı Düzeltme İşlemi Başlatılıyor (pallet -> pezpallet)...")
    print(f"⚠️ Çalışma Dizini: {root_dir}")
    print("==================================================")
    
    rename_paths(root_dir)
    
    print("\n✅ Dosya Adları Düzeltme işlemi tamamlandı.")

if __name__ == "__main__":
    main()