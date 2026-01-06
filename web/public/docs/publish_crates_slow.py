#!/usr/bin/env python3
"""
Slow Crate Publisher - 6 dakikada bir 1 crate publish eder
Rate limit'e takilmamak icin yavas yavas publish yapar.

Kullanim:
    nohup python3 publish_crates_slow.py > publish_log.txt 2>&1 &
"""

import subprocess
import os
import time
from datetime import datetime

PLACEHOLDER_DIR = '/home/mamostehp/kurdistan-sdk/crate_placeholders'
LOG_FILE = '/home/mamostehp/kurdistan-sdk/publish_log.txt'
INTERVAL_SECONDS = 360  # 6 dakika

def log(msg):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{timestamp}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')

def is_published(name):
    """crates.io'da mevcut mu kontrol et"""
    result = subprocess.run(
        ['cargo', 'search', name, '--limit', '1'],
        capture_output=True, text=True, timeout=30
    )
    return f'{name} = ' in result.stdout

def publish_crate(name):
    """Tek bir crate publish et"""
    crate_dir = os.path.join(PLACEHOLDER_DIR, name)
    manifest = os.path.join(crate_dir, 'Cargo.toml')

    if not os.path.exists(manifest):
        return False, "Cargo.toml not found"

    result = subprocess.run(
        ['cargo', 'publish', '--manifest-path', manifest],
        capture_output=True, text=True, cwd=crate_dir, timeout=180
    )

    if result.returncode == 0:
        return True, "Success"
    elif 'already uploaded' in result.stderr or 'already exists' in result.stderr:
        return True, "Already exists"
    elif '429' in result.stderr or 'Too Many Requests' in result.stderr:
        return False, "Rate limited"
    else:
        return False, result.stderr[:200]

def get_unpublished_crates():
    """Henuz publish edilmemis crate'leri bul"""
    crates = sorted([d for d in os.listdir(PLACEHOLDER_DIR)
                    if os.path.isdir(os.path.join(PLACEHOLDER_DIR, d))])

    unpublished = []
    for crate in crates:
        if not is_published(crate):
            unpublished.append(crate)
    return unpublished

def main():
    log("=" * 60)
    log("Slow Crate Publisher baslatildi")
    log(f"Interval: {INTERVAL_SECONDS} saniye (6 dakika)")
    log("=" * 60)

    unpublished = get_unpublished_crates()
    total = len(unpublished)
    log(f"Toplam {total} crate publish edilecek")

    success_count = 0
    fail_count = 0

    for i, crate in enumerate(unpublished, 1):
        log(f"[{i}/{total}] Publishing: {crate}")

        success, msg = publish_crate(crate)

        if success:
            log(f"  ✓ {msg}")
            success_count += 1
        else:
            log(f"  ✗ {msg}")
            fail_count += 1

            # Rate limit durumunda ekstra bekle
            if "Rate limited" in msg:
                log("  Rate limited! 10 dakika bekleniyor...")
                time.sleep(600)

        # Sonraki crate icin bekle
        if i < total:
            log(f"  Sonraki crate icin {INTERVAL_SECONDS}s bekleniyor...")
            time.sleep(INTERVAL_SECONDS)

    log("=" * 60)
    log(f"Tamamlandi! Basarili: {success_count}, Basarisiz: {fail_count}")
    log("=" * 60)

if __name__ == "__main__":
    main()
