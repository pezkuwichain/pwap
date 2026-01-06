#!/usr/bin/env python3
"""
crates.io İsim Rezervasyon Script'i (Gelişmiş Versiyon)

Özellikler:
- Kaldığı yerden devam etme (--start-from)
- Ayarlanabilir bekleme süresi (--interval)
- Workspace izolasyonu (üst dizindeki Cargo.toml ile çakışmaz)
- "Already exists" durumunu akıllıca yönetir (bekleme yapmaz)
"""

import subprocess
import os
import sys
import json
import time
from pathlib import Path
import argparse

WORKSPACE_ROOT = Path(__file__).parent.resolve()
PLACEHOLDER_DIR = WORKSPACE_ROOT / "crate_placeholders"

# Yeni isim listesi
NEW_CRATE_NAMES = [
    "asset-hub-pezkuwichain-emulated-chain",
    "asset-hub-pezkuwichain-integration-tests",
    "asset-hub-pezkuwichain-runtime",
    "asset-hub-zagros-emulated-chain",
    "asset-hub-zagros-integration-tests",
    "asset-hub-zagros-runtime",
    "asset-test-pezutils",
    "pez-binary-merkle-tree",
    "pez-chain-spec-guide-runtime",
    "collectives-zagros-emulated-chain",
    "collectives-zagros-integration-tests",
    "collectives-zagros-runtime",
    "coretime-pezkuwichain-emulated-chain",
    "coretime-pezkuwichain-integration-tests",
    "coretime-pezkuwichain-runtime",
    "coretime-zagros-emulated-chain",
    "coretime-zagros-integration-tests",
    "coretime-zagros-runtime",
    "emulated-integration-tests-common",
    "pez-equivocation-detector",
    "pez-erasure-coding-fuzzer",
    "pez-ethereum-standards",
    "pez-finality-relay",
    "pez-fork-tree",
    "pezframe-election-solution-type-fuzzer",
    "pezframe-omni-bencher",
    "pezframe-remote-externalities",
    "pezframe-storage-access-test-runtime",
    "pez-generate-bags",
    "glutton-zagros-runtime",
    "governance-zagros-integration-tests",
    "pez-kitchensink-runtime",
    "pez-messages-relay",
    "pez-minimal-template-node",
    "pez-minimal-template-runtime",
    "pez-node-bench",
    "pez-node-primitives",
    "pez-node-rpc",
    "pez-node-runtime-pez-generate-bags",
    "pez-node-template-release",
    "pez-node-testing",
    "pez-penpal-emulated-chain",
    "pez-penpal-runtime",
    "people-pezkuwichain-emulated-chain",
    "people-pezkuwichain-integration-tests",
    "people-pezkuwichain-runtime",
    "people-zagros-emulated-chain",
    "people-zagros-integration-tests",
    "people-zagros-runtime",
    "pezkuwi",
    "pezkuwichain-emulated-chain",
    "pezkuwichain-runtime",
    "pezkuwichain-runtime-constants",
    "pezkuwichain-system-emulated-network",
    "pezkuwichain-teyrchain-runtime",
    "pezkuwichain-zagros-system-emulated-network",
    "relay-bizinikiwi-client",
    "relay-pezutils",
    "pez-remote-ext-tests-bags-list",
    "pez-revive-dev-node",
    "pez-revive-dev-runtime",
    "pez-slot-range-helper",
    "pez-solochain-template-node",
    "pez-solochain-template-runtime",
    "pez-pez_subkey",
    "pez-template-zombienet-tests",
    "peztest-runtime-constants",
    "test-teyrchain-adder",
    "test-teyrchain-adder-collator",
    "test-teyrchain-halt",
    "test-teyrchain-undying",
    "test-teyrchain-undying-collator",
    "testnet-teyrchains-constants",
    "teyrchain-template",
    "teyrchain-template-node",
    "teyrchain-template-runtime",
    "teyrchains-common",
    "teyrchains-relay",
    "teyrchains-runtimes-test-utils",
    "pez-tracing-gum",
    "pez-pez-tracing-gum-proc-macro",
    "yet-another-teyrchain-runtime",
    "zagros-emulated-chain",
    "zagros-runtime",
    "zagros-runtime-constants",
    "zagros-system-emulated-network",
    "pez-zombienet-backchannel",
    "pezassets-common",
    "bp-asset-hub-pezkuwichain",
    "bp-asset-hub-zagros",
    "bp-pezbeefy",
    "bp-bridge-hub-pezcumulus",
    "bp-bridge-hub-pezkuwichain",
    "bp-bridge-hub-zagros",
    "bp-header-pez-chain",
    "bp-pez-messages",
    "bp-pezkuwi-bulletin",
    "bp-pezkuwi-core",
    "bp-pezkuwichain",
    "bp-pez-relayers",
    "pezbp-runtime",
    "bp-test-pezutils",
    "bp-teyrchains",
    "bp-xcm-pezbridge-hub",
    "bp-xcm-pezbridge-hub-router",
    "bp-zagros",
    "pezbridge-hub-common",
    "pezbridge-hub-pezkuwichain-emulated-chain",
    "pezbridge-hub-pezkuwichain-integration-tests",
    "pezbridge-hub-pezkuwichain-runtime",
    "pezbridge-hub-test-utils",
    "pezbridge-hub-zagros-emulated-chain",
    "pezbridge-hub-zagros-integration-tests",
    "pezbridge-hub-zagros-runtime",
    "pezbridge-runtime-common",
    "pezmmr-gadget",
    "pezmmr-rpc",
    "pezsnowbridge-beacon-primitives",
    "pezsnowbridge-core",
    "pezsnowbridge-ethereum",
    "pezsnowbridge-inbound-queue-primitives",
    "pezsnowbridge-merkle-tree",
    "pezsnowbridge-outbound-queue-primitives",
    "pezsnowbridge-outbound-queue-runtime-api",
    "pezsnowbridge-outbound-queue-v2-runtime-api",
    "pezsnowbridge-pezpallet-ethereum-client",
    "pezsnowbridge-pezpallet-ethereum-client-fixtures",
    "pezsnowbridge-pezpallet-inbound-queue",
    "pezsnowbridge-pezpallet-inbound-queue-fixtures",
    "pezsnowbridge-pezpallet-inbound-queue-v2",
    "pezsnowbridge-pezpallet-inbound-queue-v2-fixtures",
    "pezsnowbridge-pezpallet-outbound-queue",
    "pezsnowbridge-pezpallet-outbound-queue-v2",
    "pezsnowbridge-pezpallet-system",
    "pezsnowbridge-pezpallet-system-frontend",
    "pezsnowbridge-pezpallet-system-v2",
    "pezsnowpezbridge-runtime-common",
    "pezsnowbridge-runtime-test-common",
    "pezsnowbridge-system-runtime-api",
    "pezsnowbridge-system-v2-runtime-api",
    "pezsnowbridge-test-utils",
    "pezsnowbridge-verification-primitives",
    "xcm-pez-docs",
    "xcm-pez-emulator",
    "xcm-pez-executor-integration-tests",
    "xcm-pez-procedural",
    "xcm-runtime-pezapis",
    "xcm-pez-simulator",
    "xcm-pez-simulator-example",
    "xcm-pez-simulator-fuzzer",
]

def check_crate_available(name: str) -> bool:
    """crates.io'da isim müsait mi kontrol et"""
    result = subprocess.run(
        ["cargo", "search", name, "--limit", "1"],
        capture_output=True, text=True
    )
    return f'{name} = "' not in result.stdout

def create_placeholder(name: str) -> Path:
    """Placeholder crate oluştur"""
    crate_dir = PLACEHOLDER_DIR / name
    crate_dir.mkdir(parents=True, exist_ok=True)
    
    # [workspace] ekleyerek parent workspace ile ilişkisini kesiyoruz
    cargo_toml = f'''[package]
name = "{name}"
version = "0.1.0"
edition = "2021"
description = "PezkuwiChain SDK component - placeholder for name reservation"
license = "Apache-2.0"
repository = "https://github.com/pezkuwichain/pezkuwi-sdk"
homepage = "https://pezkuwichain.io"
documentation = "https://docs.pezkuwichain.io/sdk/"
authors = ["Kurdistan Tech Institute <info@pezkuwichain.io>"]
keywords = ["pezkuwichain", "blockchain", "sdk"]
categories = ["cryptography::cryptocurrencies"]

[workspace]

[dependencies]
'''
    (crate_dir / "Cargo.toml").write_text(cargo_toml)
    
    src_dir = crate_dir / "src"
    src_dir.mkdir(exist_ok=True)
    lib_rs = f'''//! {name}
//! This crate is part of the PezkuwiChain SDK.
//! Full implementation coming soon.
#![doc = include_str!("../README.md")]
'''
    (src_dir / "lib.rs").write_text(lib_rs)
    
    readme = f'''# {name}
Part of [PezkuwiChain SDK](https://github.com/pezkuwichain/pezkuwi-sdk).
## About
This crate is a component of the PezkuwiChain blockchain SDK.
'''
    (crate_dir / "README.md").write_text(readme)
    return crate_dir

def publish_placeholder(crate_dir: Path, dry_run: bool = True):
    """Placeholder'ı crates.io'ya publish et.
    Dönüş: (başarılı_mı, bekleme_gerekli_mi)
    """
    args = ["cargo", "publish"]
    if dry_run:
        args.append("--dry-run")
    args.extend(["--manifest-path", str(crate_dir / "Cargo.toml")])
    
    result = subprocess.run(args, capture_output=True, text=True, cwd=crate_dir)
    
    if result.returncode == 0:
        return True, True # Başarılı, bekleme yap

    # "already exists" hatasını kontrol et
    if "already exists" in result.stderr:
        return True, False # Zaten var, bekleme yapma

    print(f"\n[HATA] {crate_dir.name} publish edilemedi:\n{result.stderr}")
    return False, False

def main():
    parser = argparse.ArgumentParser(description="crates.io isim rezervasyonu")
    parser.add_argument("--list", action="store_true", help="İsimleri listele")
    parser.add_argument("--check", action="store_true", help="crates.io'da müsaitlik kontrol et")
    parser.add_argument("--create", action="store_true", help="Placeholder crate'leri oluştur")
    parser.add_argument("--publish", action="store_true", help="crates.io'ya publish et")
    parser.add_argument("--dry-run", action="store_true", help="Publish dry-run")
    parser.add_argument("--start-from", type=str, help="İşleme bu crate isminden başla (öncekileri atlar)")
    parser.add_argument("--interval", type=int, default=360, help="Publish arası bekleme süresi (saniye). Varsayılan: 360")

    args = parser.parse_args()

    if args.list:
        for name in sorted(NEW_CRATE_NAMES):
            print(f"  {name}")
        return

    # Create/Publish işlemleri
    if args.create or args.publish:
        # Placeholder klasörünü oluştur
        PLACEHOLDER_DIR.mkdir(exist_ok=True)
        
        start_processing = False
        if not args.start_from:
            start_processing = True
        
        print(f"Toplam Crate Sayısı: {len(NEW_CRATE_NAMES)}")
        print(f"Bekleme Süresi: {args.interval} saniye")
        if args.start_from:
            print(f"Başlangıç: {args.start_from} (Öncekiler atlanacak)")

        success = 0
        failed = 0
        skipped = 0

        for i, name in enumerate(NEW_CRATE_NAMES, 1):
            # Resume mantığı
            if not start_processing:
                if name == args.start_from:
                    start_processing = True
                else:
                    skipped += 1
                    continue

            print(f"[{i}/{len(NEW_CRATE_NAMES)}] {name}...", end=" ", flush=True)

            # 1. Create
            crate_dir = create_placeholder(name)
            
            # 2. Publish (Eğer istenmişse)
            if args.publish:
                success_status, needs_wait = publish_placeholder(crate_dir, args.dry_run)
                
                if success_status:
                    if needs_wait:
                        print("✓ PUBLISHED")
                        success += 1
                        if not args.dry_run:
                            print(f"    -> Bekleniyor {args.interval}sn...")
                            time.sleep(args.interval)
                    else:
                        print("✓ ZATEN VAR (Atlandı)")
                        success += 1 
                else:
                    print("✗ FAILED")
                    failed += 1
            else:
                print("✓ CREATED")

        print(f"\nSonuç: {success} başarılı, {failed} başarısız, {skipped} atlandı.")

if __name__ == "__main__":
    main()