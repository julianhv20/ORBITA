"""
Script Maestro ETL de ÓRBITA: Compila la Temporada 1 completa (10 Desafíos Diarios),
el Léxico General Español (lexicon_es.txt) y el Manifiesto Estático (manifest.json)
directamente en web/public/daily/.
"""

from __future__ import annotations
import argparse
import json
import time
from pathlib import Path

from src.puzzles_part1 import PUZZLES_PART_1
from src.puzzles_part2 import PUZZLES_PART_2
from src.embedding_engine import EmbeddingEngine
from src.pack_exporter import compile_daily_pack, expand_puzzle_candidates
from src.lexicon_builder import export_lexicon_file


def build_all(output_dir: Path, backend: str = "manifold") -> dict:
    t0 = time.perf_counter()
    all_puzzles = PUZZLES_PART_1 + PUZZLES_PART_2
    engine = EmbeddingEngine(backend=backend)

    # Recolectar todos los términos de los puzzles para asegurar cobertura 100% en lexicon_es.txt
    extra_vocab: set[str] = set()
    for p in all_puzzles:
        extra_vocab.add(p["core"])
        roche_list, candidates, forms_map = expand_puzzle_candidates(p)
        extra_vocab.update(roche_list)
        extra_vocab.update(forms_map.keys())
        for c in candidates:
            extra_vocab.add(c["norm"])

    output_dir.mkdir(parents=True, exist_ok=True)
    lexicon_path = output_dir / "lexicon_es.txt"
    lexicon_count = export_lexicon_file(lexicon_path, extra_vocab)

    summaries = []
    for p in all_puzzles:
        summary = compile_daily_pack(p, output_dir=output_dir, engine=engine, dim=128)
        summaries.append(summary)
        total_kb = (summary["binBytes"] + summary["jsonBytes"]) / 1024.0
        print(
            f"  [OK] #{summary['id']} {summary['coreWord']:<10} | "
            f"{summary['candidateCount']:3d} nodos | "
            f"S_max={summary['sMax']:4.1f} | "
            f"p50={summary['percentiles']['p50']:4.1f} p90={summary['percentiles']['p90']:4.1f} | "
            f"{total_kb:5.1f} KB"
        )

    manifest = {
        "season": 1,
        "epochDate": "2026-11-17",
        "lexiconFile": "lexicon_es.txt",
        "lexiconCount": lexicon_count,
        "puzzles": summaries,
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    elapsed = time.perf_counter() - t0
    lex_kb = lexicon_path.stat().st_size / 1024.0
    print(f"\nTemporada compilada en {elapsed:.2f}s | Léxico: {lexicon_count} formas ({lex_kb:.1f} KB)")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compilador Offline de Paquetes Diarios ÓRBITA")
    parser.add_argument(
        "--out",
        type=str,
        default=str(Path(__file__).resolve().parent.parent / "web" / "public" / "daily"),
        help="Directorio de salida para los paquetes diarios",
    )
    parser.add_argument(
        "--backend",
        type=str,
        default="manifold",
        choices=["manifold", "transformer"],
        help="Motor de embeddings a utilizar",
    )
    args = parser.parse_args()
    build_all(Path(args.out), backend=args.backend)
