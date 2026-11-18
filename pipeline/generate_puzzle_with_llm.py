"""
Generador Offline Ultra-Optimizado de Nuevos Astros Diarios con Gemini API.
Costo estimado: ~$0.002 USD por día (~$0.75 USD por AÑO completo de 365 puzzles),
manteniendo $0.00 de costo de inferencia en vivo y < 0.05 ms de latencia en los jugadores.

Uso:
  set GEMINI_API_KEY=tu_clave_aqui
  python pipeline/generate_puzzle_with_llm.py --core LABERINTO --id 011
"""

from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import requests
from dotenv import load_dotenv

from src.concept_ontology import DOMAINS
from src.embedding_engine import EmbeddingEngine
from src.pack_exporter import compile_daily_pack


SYSTEM_PROMPT = f"""Eres el arquitecto psicométrico de ÓRBITA (basado en el Divergent Association Task de Harvard).
Dada una Palabra Núcleo en español, genera una definición JSON rica para compilar el paquete binario diario:
1. 'subtitle': frase poética y precisa de máximo 12 palabras.
2. 'hint': pista breve enumerando 5-6 campos diversos que conectan con el núcleo.
3. 'accent': color hexadecimal luminoso acorde al concepto (ej. '#E5A93C').
4. 'core_weights': objeto con 2 o 3 ejes dominantes tomados EXCLUSIVAMENTE de esta lista: {DOMAINS}.
5. 'roche': lista de 20-30 palabras obvias, plurales, derivados o sinónimos triviales que deben incinerarse en el Límite de Roche.
6. 'satellites': lista de al menos 30 conceptos bisociativos brillantes de dominios distintos. Cada elemento es un objeto con:
   - 'display': palabra canónica en MAYÚSCULAS (1 sola palabra en español o referente universal como DALÍ, PROMETEO).
   - 'domain': etiqueta corta de dominio (ej. 'Física Cuántica', 'Arte Surrealista').
   - 'cluster_key': identificador corto de sub-clúster (conceptos muy cercanos comparten clave).
   - 'weights': diccionario con 1 o 2 ejes de {DOMAINS} con pesos entre 0.3 y 1.0.
   - 'target_gravity': número entre 0.45 y 0.80.
   - 'aliases': lista de 2 a 4 palabras hermanas o sinónimos de una palabra del mismo clúster.
   - 'insight': explicación brillante en español (máximo 18 palabras) del puente conceptual con el núcleo.
"""


def generate_and_compile(core_word: str, puzzle_id: str, out_dir: Path) -> None:
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "Define la variable de entorno GEMINI_API_KEY para generar nuevos puzzles asistidos por IA."
        )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={api_key}"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [
            {
                "parts": [
                    {
                        "text": f"Genera el paquete completo para la Palabra Núcleo: {core_word.upper()}"
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.4,
        },
    }

    resp = requests.post(url, json=payload, timeout=60)
    resp.raise_for_status()
    raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    generated = json.loads(raw_text)

    slug = core_word.strip().lower()
    puzzle_def = {
        "id": puzzle_id,
        "slug": slug,
        "core": core_word.strip().upper(),
        "subtitle": generated["subtitle"],
        "hint": generated["hint"],
        "accent": generated.get("accent", "#E5A93C"),
        "core_weights": generated["core_weights"],
        "roche": generated["roche"],
        "satellites": [
            (
                s["display"],
                s["domain"],
                s["cluster_key"],
                s["weights"],
                float(s["target_gravity"]),
                s.get("aliases", []),
                s["insight"],
            )
            for s in generated["satellites"]
        ],
    }

    engine = EmbeddingEngine(backend="manifold")
    summary = compile_daily_pack(puzzle_def, output_dir=out_dir, engine=engine, dim=128)
    print(
        f"[OK] Puzzle #{summary['id']} {summary['coreWord']} compilado -> "
        f"{summary['candidateCount']} nodos | S_max={summary['sMax']}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--core", required=True, help="Palabra núcleo en español")
    parser.add_argument("--id", required=True, help="ID numérico de 3 dígitos, ej. 011")
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent.parent / "web" / "public" / "daily"),
    )
    args = parser.parse_args()
    generate_and_compile(args.core, args.id, Path(args.out))
