import os
import sys

# Rebranding haritası
REBRAND_MAP = [
    ("asset-test-utils", "asset-test-pezutils"),
    ("chain-spec-guide-runtime", "pez-chain-spec-guide-runtime"),
    ("equivocation-detector", "pez-equivocation-detector"),
    ("erasure-coding-fuzzer", "pez-erasure-coding-fuzzer"),
    ("ethereum-standards", "pez-ethereum-standards"),
    ("finality-relay", "pez-finality-relay"),
    ("fork-tree", "pez-fork-tree"),
    ("generate-bags", "pez-generate-bags"),
    ("kitchensink-runtime", "pez-kitchensink-runtime"),
    ("messages-relay", "pez-messages-relay"),
    ("minimal-template-node", "pez-minimal-template-node"),
    ("minimal-template-runtime", "pez-minimal-template-runtime"),
    ("node-bench", "pez-node-bench"),
    ("node-primitives", "pez-node-primitives"),
    ("node-rpc", "pez-node-rpc"),
    ("node-runtime-generate-bags", "pez-node-runtime-generate-bags"),
    ("node-template-release", "pez-node-template-release"),
    ("node-testing", "pez-node-testing"),
    ("penpal-emulated-chain", "pez-penpal-emulated-chain"),
    ("penpal-runtime", "pez-penpal-runtime"),
    ("remote-ext-tests-bags-list", "pez-remote-ext-tests-bags-list"),
    ("revive-dev-node", "pez-revive-dev-node"),
    ("revive-dev-runtime", "pez-revive-dev-runtime"),
    ("slot-range-helper", "pez-slot-range-helper"),
    ("solochain-template-node", "pez-solochain-template-node"),
    ("solochain-template-runtime", "pez-solochain-template-runtime"),
    ("subkey", "pez-subkey"),
    ("template-zombienet-tests", "pez-template-zombienet-tests"),
    ("test-runtime-constants", "peztest-runtime-constants"),
    ("tracing-gum", "pez-tracing-gum"),
    ("tracing-gum-proc-macro", "pez-tracing-gum-proc-macro"),
    ("bp-header-chain", "bp-header-pez-chain"),
    ("bp-runtime", "pezbp-runtime"),
    ("bridge-hub-pezkuwichain-emulated-chain", "pezbridge-hub-pezkuwichain-emulated-chain"),
    ("bridge-hub-pezkuwichain-integration-tests", "pezbridge-hub-pezkuwichain-integration-tests"),
    ("bridge-hub-pezkuwichain-runtime", "pezbridge-hub-pezkuwichain-runtime"),
    ("bridge-hub-test-utils", "pezbridge-hub-test-utils"),
    ("bridge-hub-zagros-emulated-chain", "pezbridge-hub-zagros-emulated-chain"),
    ("bridge-hub-zagros-integration-tests", "pezbridge-hub-zagros-integration-tests"),
    ("bridge-hub-zagros-runtime", "pezbridge-hub-zagros-runtime"),
    ("bridge-runtime-common", "pezbridge-runtime-common"),
    ("mmr-gadget", "pezmmr-gadget"),
    ("mmr-rpc", "pezmmr-rpc"),
    ("snowbridge-beacon-primitives", "pezsnowbridge-beacon-primitives"),
    ("snowbridge-core", "pezsnowbridge-core"),
    ("snowbridge-ethereum", "pezsnowbridge-ethereum"),
    ("snowbridge-inbound-queue-primitives", "pezsnowbridge-inbound-queue-primitives"),
    ("snowbridge-merkle-tree", "pezsnowbridge-merkle-tree"),
    ("snowbridge-outbound-queue-primitives", "pezsnowbridge-outbound-queue-primitives"),
    ("snowbridge-outbound-queue-runtime-api", "pezsnowbridge-outbound-queue-runtime-api"),
    ("snowbridge-outbound-queue-v2-runtime-api", "pezsnowbridge-outbound-queue-v2-runtime-api"),
    ("snowbridge-pezpallet-ethereum-client", "snowbridge-pezpallet-ethereum-client"),
    ("snowbridge-pezpallet-ethereum-client-fixtures", "snowbridge-pezpallet-ethereum-client-fixtures"),
    ("snowbridge-pezpallet-inbound-queue", "snowbridge-pezpallet-inbound-queue"),
    ("snowbridge-pezpallet-inbound-queue-fixtures", "snowbridge-pezpallet-inbound-queue-fixtures"),
    ("snowbridge-pezpallet-inbound-queue-v2", "snowbridge-pezpallet-inbound-queue-v2"),
    ("snowbridge-pezpallet-inbound-queue-v2-fixtures", "snowbridge-pezpallet-inbound-queue-v2-fixtures"),
    ("snowbridge-pezpallet-outbound-queue", "snowbridge-pezpallet-outbound-queue"),
    ("snowbridge-pezpallet-outbound-queue-v2", "snowbridge-pezpallet-outbound-queue-v2"),
    ("snowbridge-pezpallet-system", "snowbridge-pezpallet-system"),
    ("snowbridge-pezpallet-system-frontend", "snowbridge-pezpallet-system-frontend"),
    ("snowbridge-pezpallet-system-v2", "snowbridge-pezpallet-system-v2"),
    ("snowbridge-runtime-common", "pezsnowbridge-runtime-common"),
    ("snowbridge-runtime-test-common", "pezsnowbridge-runtime-test-common"),
    ("snowbridge-system-runtime-api", "pezsnowbridge-system-runtime-api"),
    ("snowbridge-system-v2-runtime-api", "pezsnowbridge-system-v2-runtime-api"),
    ("snowbridge-test-utils", "pezsnowbridge-test-utils"),
    ("snowbridge-verification-primitives", "pezsnowbridge-verification-primitives"),
    ("xcm-docs", "xcm-pez-docs"),
    ("xcm-emulator", "xcm-pez-emulator"),
    ("xcm-executor-integration-tests", "xcm-pez-executor-integration-tests"),
    ("xcm-procedural", "xcm-pez-procedural"),
    ("xcm-runtime-apis", "xcm-runtime-pezapis"),
    ("xcm-simulator", "xcm-pez-simulator"),
    ("xcm-simulator-example", "xcm-pez-simulator-example"),
    ("xcm-simulator-fuzzer", "xcm-pez-simulator-fuzzer"),
]

# Hedef dosya uzantıları
TARGET_EXTENSIONS = ('.rs', '.toml', '.md', '.txt', '.yml', '.yaml', '.json', '.py')

# HARİÇ TUTULACAK KLASÖRLER (KESİN LİSTE)
EXCLUDE_DIRS = {'crate_placeholders', '.git', 'target', 'node_modules', '__pycache__'}

def is_path_excluded(path):
    """Verilen yolun yasaklı bir klasörün içinde olup olmadığını kontrol eder."""
    parts = path.split(os.sep)
    # Eğer path'in herhangi bir parçası EXCLUDE_DIRS içindeyse True döner
    return any(excluded in parts for excluded in EXCLUDE_DIRS)

def replace_in_file(filepath):
    # Kendi kendimizi değiştirmeyelim
    if os.path.basename(filepath) == os.path.basename(__file__):
        return

    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        original_content = content
        
        for old_name, new_name in REBRAND_MAP:
            # 1. Normal (tireli)
            content = content.replace(old_name, new_name)
            # 2. Snake case (alt çizgili)
            old_snake = old_name.replace('-', '_')
            new_snake = new_name.replace('-', '_')
            content = content.replace(old_snake, new_snake)

        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  [GÜNCELLENDİ] Dosya içeriği: {filepath}")
            
    except Exception as e:
        print(f"  [HATA] Dosya okunamadı: {filepath} -> {e}")

def rename_directories_and_files(root_dir):
    # topdown=True kullanarak yukarıdan aşağıya iniyoruz, böylece dirs listesini modifiye edebiliriz
    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=True):
        
        # GÜVENLİK: Yasaklı klasörleri yerinde (in-place) listeden silerek os.walk'un oraya girmesini engelle
        # Bu en güvenli yöntemdir.
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        # Eğer şu anki dizin zaten yasaklı bir yolun altındaysa (üstteki koruma kaçırdıysa) atla
        if is_path_excluded(dirpath):
            continue

        # 1. Dosya isimlerini değiştir
        for filename in filenames:
            if filename == os.path.basename(__file__):
                continue
                
            for old_name, new_name in REBRAND_MAP:
                if old_name in filename:
                    old_file_path = os.path.join(dirpath, filename)
                    new_filename = filename.replace(old_name, new_name)
                    new_file_path = os.path.join(dirpath, new_filename)
                    if os.path.exists(old_file_path):
                        try:
                            os.rename(old_file_path, new_file_path)
                            print(f"  [RENAME] Dosya: {filename} -> {new_filename}")
                        except OSError as e:
                            print(f"  [HATA] Dosya adlandırılamadı {filename}: {e}")
        
        # 2. Klasör isimlerini değiştir
        # Not: dirnames listesi üzerinde iterasyon yapıyoruz ama rename işlemi riskli olabilir
        # O yüzden sadece şu anki seviyedeki klasörleri kontrol ediyoruz
        # Ancak os.walk çalışırken klasör adı değişirse alt dizin taraması sapıtabilir.
        # Bu yüzden klasör yeniden adlandırmayı en sona, ayrı bir "bottom-up" geçişe bırakmak daha iyidir
        # ama basitlik adına burada dikkatli yapıyoruz.
    
    # İkinci Geçiş: Sadece Klasör İsimleri (Bottom-Up)
    # Klasör isimlerini değiştirirken path bozulmasın diye en alttan başlıyoruz
    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=False):
        if is_path_excluded(dirpath):
            continue
            
        for dirname in dirnames:
            if dirname in EXCLUDE_DIRS:
                continue
                
            for old_name, new_name in REBRAND_MAP:
                if old_name == dirname:
                    old_dir_path = os.path.join(dirpath, dirname)
                    new_dir_path = os.path.join(dirpath, new_name)
                    if os.path.exists(old_dir_path):
                        try:
                            os.rename(old_dir_path, new_dir_path)
                            print(f"  [RENAME] Klasör: {dirname} -> {new_name}")
                        except OSError as e:
                            print(f"  [HATA] Klasör adlandırılamadı {dirname}: {e}")

def process_content_updates(root_dir):
    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=True):
        # Yasaklı klasörlere girme
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        
        if is_path_excluded(dirpath):
            continue
            
        for filename in filenames:
            if filename.endswith(TARGET_EXTENSIONS) or filename == 'Cargo.lock':
                filepath = os.path.join(dirpath, filename)
                replace_in_file(filepath)

def main():
    root_dir = os.getcwd()
    print("==================================================")
    print(f"⚠️  DİKKAT: Çalışma dizini: {root_dir}")
    print(f"⚠️  HARİÇ TUTULANLAR: {EXCLUDE_DIRS}")
    print("==================================================")
    
    # Otomatik onay veya soru
    # confirm = input("Emin misin? (evet/hayir): ")
    # if confirm.lower() != "evet": return
    print("İşlem başlatılıyor...")

    print("\n--- Adım 1: Dosya İçeriklerinin Güncellenmesi ---")
    process_content_updates(root_dir)
    
    print("\n--- Adım 2: Klasör ve Dosya İsimlerinin Değiştirilmesi ---")
    rename_directories_and_files(root_dir)
    
    print("\n✅ Rebranding işlemi tamamlandı.")

if __name__ == "__main__":
    main()
