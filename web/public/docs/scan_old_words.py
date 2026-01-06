#!/usr/bin/env python3
"""
Eski (rebrand edilmemiş) kelimeleri tarayan script.
Her crate için çalıştırılır ve kalan eski kelimeleri tespit eder.

Kullanım:
    python3 scan_old_words.py <crate_path>
    python3 scan_old_words.py /home/mamostehp/kurdistan-sdk/bizinikiwi/primitives/core
"""

import os
import sys
import re
from pathlib import Path

# Rebrand kuralları: (eski_pattern, yeni_kelime, açıklama)
# Sıralama önemli - daha spesifik olanlar önce
REBRAND_RULES = [
    # Terminoloji
    (r'\bparachain\b', 'teyrchain', 'parachain → teyrchain'),
    (r'\bParachain\b', 'Teyrchain', 'Parachain → Teyrchain'),
    (r'\bPARACHAIN\b', 'TEYRCHAIN', 'PARACHAIN → TEYRCHAIN'),
    (r'\brococo\b', 'pezkuwichain', 'rococo → pezkuwichain'),
    (r'\bRococo\b', 'Pezkuwichain', 'Rococo → Pezkuwichain'),
    (r'\bROCOCO\b', 'PEZKUWICHAIN', 'ROCOCO → PEZKUWICHAIN'),
    (r'\bwestend\b', 'zagros', 'westend → zagros'),
    (r'\bWestend\b', 'Zagros', 'Westend → Zagros'),
    (r'\bWESTEND\b', 'ZAGROS', 'WESTEND → ZAGROS'),
    (r'\bkusama\b', 'zagros', 'kusama → zagros'),
    (r'\bKusama\b', 'Zagros', 'Kusama → Zagros'),
    (r'\bKUSAMA\b', 'ZAGROS', 'KUSAMA → ZAGROS'),

    # Crate prefix'leri (Cargo.toml name ve use statement'larda)
    # Dikkat: Bunlar sadece crate isimlerinde geçerli, rastgele "sp_" değil
    (r'\bsp-core\b', 'pezsp-core', 'sp-core → pezsp-core'),
    (r'\bsp-runtime\b', 'pezsp-runtime', 'sp-runtime → pezsp-runtime'),
    (r'\bsp-io\b', 'pezsp-io', 'sp-io → pezsp-io'),
    (r'\bsp-std\b', 'pezsp-std', 'sp-std → pezsp-std'),
    (r'\bsp-api\b', 'pezsp-api', 'sp-api → pezsp-api'),
    (r'\bsc-client\b', 'pezsc-client', 'sc-client → pezsc-client'),
    (r'\bsc-service\b', 'pezsc-service', 'sc-service → pezsc-service'),
    (r'\bframe-support\b', 'pezframe-support', 'frame-support → pezframe-support'),
    (r'\bframe-system\b', 'pezframe-system', 'frame-system → pezframe-system'),
    (r'\bpallet-balances\b', 'pezpallet-balances', 'pallet-balances → pezpallet-balances'),
    (r'\bcumulus-client\b', 'pezcumulus-client', 'cumulus-client → pezcumulus-client'),
    (r'\bcumulus-primitives\b', 'pezcumulus-primitives', 'cumulus-primitives → pezcumulus-primitives'),

    # Snowbridge (pezsnowbridge-pezpallet önce, sonra genel snowbridge)
    (r'\bsnowbridge-pezpallet-', 'pezsnowbridge-pezpallet-', 'snowbridge-pezpallet- → pezsnowbridge-pezpallet-'),
    (r'\bsnowbridge-pallet-', 'pezsnowbridge-pezpallet-', 'snowbridge-pallet- → pezsnowbridge-pezpallet-'),
    (r'\bsnowbridge-', 'pezsnowbridge-', 'snowbridge- → pezsnowbridge-'),
    (r'\bsnowbridge_pallet_', 'pezsnowbridge_pezpallet_', 'snowbridge_pallet_ → pezsnowbridge_pezpallet_'),
    (r'\bsnowbridge_pezpallet_', 'pezsnowbridge_pezpallet_', 'snowbridge_pezpallet_ → pezsnowbridge_pezpallet_'),

    # Bridge
    (r'\bbridge-hub-rococo\b', 'pezbridge-hub-pezkuwichain', 'bridge-hub-rococo → pezbridge-hub-pezkuwichain'),
    (r'\bbridge-hub-westend\b', 'pezbridge-hub-zagros', 'bridge-hub-westend → pezbridge-hub-zagros'),
    (r'\bbridge-runtime-common\b', 'pezbridge-runtime-common', 'bridge-runtime-common → pezbridge-runtime-common'),

    # MMR
    (r'\bmmr-gadget\b', 'pezmmr-gadget', 'mmr-gadget → pezmmr-gadget'),
    (r'\bmmr-rpc\b', 'pezmmr-rpc', 'mmr-rpc → pezmmr-rpc'),

    # Substrate (dikkatli - sadece proje referanslarında)
    (r'\bsubstrate-wasm-builder\b', 'bizinikiwi-wasm-builder', 'substrate-wasm-builder → bizinikiwi-wasm-builder'),
    (r'\bsubstrate-build-script-utils\b', 'bizinikiwi-build-script-utils', 'substrate-build-script-utils → bizinikiwi-build-script-utils'),

    # Polkadot referansları
    (r'\bpolkadot-sdk\b', 'pezkuwi-sdk', 'polkadot-sdk → pezkuwi-sdk'),
    (r'\bpolkadot-runtime\b', 'pezkuwichain-runtime', 'polkadot-runtime → pezkuwichain-runtime'),
    (r'\bpolkadot-primitives\b', 'pezkuwi-primitives', 'polkadot-primitives → pezkuwi-primitives'),

    # Rust module isimleri (underscore versiyonları)
    (r'\bsp_core\b', 'pezsp_core', 'sp_core → pezsp_core'),
    (r'\bsp_runtime\b', 'pezsp_runtime', 'sp_runtime → pezsp_runtime'),
    (r'\bsp_io\b', 'pezsp_io', 'sp_io → pezsp_io'),
    (r'\bsc_client\b', 'pezsc_client', 'sc_client → pezsc_client'),
    (r'\bframe_support\b', 'pezframe_support', 'frame_support → pezframe_support'),
    (r'\bframe_system\b', 'pezframe_system', 'frame_system → pezframe_system'),
    (r'\bpallet_balances\b', 'pezpallet_balances', 'pallet_balances → pezpallet_balances'),
    (r'\bcumulus_client\b', 'pezcumulus_client', 'cumulus_client → pezcumulus_client'),
    (r'\bcumulus_primitives\b', 'pezcumulus_primitives', 'cumulus_primitives → pezcumulus_primitives'),
]

# Taranacak dosya uzantıları
SCAN_EXTENSIONS = {'.rs', '.toml', '.md', '.json', '.yaml', '.yml'}

# Atlanacak dizinler
SKIP_DIRS = {'target', '.git', 'node_modules', 'crate_placeholders'}


def scan_file(file_path: Path) -> list:
    """Tek bir dosyayı tarar ve bulunan eski kelimeleri döndürür."""
    findings = []

    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
    except Exception as e:
        return [(str(file_path), 0, f"OKUMA HATASI: {e}", "", "")]

    lines = content.split('\n')

    for line_num, line in enumerate(lines, 1):
        for pattern, replacement, description in REBRAND_RULES:
            matches = re.finditer(pattern, line)
            for match in matches:
                findings.append({
                    'file': str(file_path),
                    'line': line_num,
                    'column': match.start() + 1,
                    'found': match.group(),
                    'replacement': replacement,
                    'description': description,
                    'context': line.strip()[:100]
                })

    return findings


def scan_crate(crate_path: str) -> list:
    """Bir crate dizinini tarar."""
    crate_dir = Path(crate_path)

    if not crate_dir.exists():
        print(f"HATA: Dizin bulunamadı: {crate_path}")
        return []

    all_findings = []

    for root, dirs, files in os.walk(crate_dir):
        # Skip directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in files:
            file_path = Path(root) / file

            if file_path.suffix not in SCAN_EXTENSIONS:
                continue

            findings = scan_file(file_path)
            all_findings.extend(findings)

    return all_findings


def print_report(findings: list, crate_path: str):
    """Bulunan eski kelimelerin raporunu yazdırır."""
    print(f"\n{'='*60}")
    print(f"TARAMA RAPORU: {crate_path}")
    print(f"{'='*60}\n")

    if not findings:
        print("✅ ESKİ KELİME BULUNAMADI - Crate temiz!")
        return

    print(f"❌ {len(findings)} adet eski kelime bulundu:\n")

    # Dosyaya göre grupla
    by_file = {}
    for f in findings:
        if f['file'] not in by_file:
            by_file[f['file']] = []
        by_file[f['file']].append(f)

    for file_path, file_findings in sorted(by_file.items()):
        rel_path = file_path.replace(crate_path, '.')
        print(f"\n📄 {rel_path}")
        print(f"   {'-'*50}")

        for finding in file_findings:
            print(f"   Satır {finding['line']}: {finding['found']} → {finding['replacement']}")
            print(f"   Bağlam: {finding['context']}")
            print()


def main():
    if len(sys.argv) < 2:
        print("Kullanım: python3 scan_old_words.py <crate_path>")
        print("Örnek: python3 scan_old_words.py ./bizinikiwi/primitives/core")
        sys.exit(1)

    crate_path = sys.argv[1]

    findings = scan_crate(crate_path)
    print_report(findings, crate_path)

    # Çıkış kodu: bulgu varsa 1, yoksa 0
    sys.exit(1 if findings else 0)


if __name__ == "__main__":
    main()
