"""
Normalización léxica, lematización ligera y detector morfológico en español para ÓRBITA.
Preserva 'ñ' para evitar colisiones semánticas (ej. año/ano, muñeca), con fallback opcional.
"""

from __future__ import annotations
import re
import unicodedata

_ACCENT_MAP = str.maketrans("áéíóúüÁÉÍÓÚÜ", "aeiouuAEIOUU")
_VALID_CHARS_RE = re.compile(r"[^a-zñ]")


def normalize_word(raw: str) -> str:
    """Normaliza una palabra española a minúsculas sin tildes diacríticas, conservando 'ñ'."""
    if not raw:
        return ""
    s = raw.strip().lower().translate(_ACCENT_MAP)
    # Normalizar cualquier combinación Unicode restante excepto la virgulilla de la ñ
    s = s.replace("ñ", "\x01")
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.replace("\x01", "ñ")
    return _VALID_CHARS_RE.sub("", s)


def spanish_stem(norm_word: str) -> str:
    """
    Stemmer morfológico español determinista inspirado en Snowball para detectar
    derivados directos de la Palabra Núcleo (ej. reloj -> relojero, relojeria, relojito).
    """
    w = normalize_word(norm_word)
    if len(w) <= 3:
        return w

    # Sufijos derivativos y diminutivos frecuentes en español (ordenados por longitud)
    suffixes = (
        "amientos", "imientos", "aciones", "iciones", "adoras", "adores",
        "amiento", "imiento", "antemente", "mente", "idades", "anzas",
        "acion", "icion", "adora", "ador", "erías", "erias", "eros", "eras",
        "ismos", "istas", "ables", "ibles", "antes", "ientes", "illos", "illas",
        "itos", "itas", "otes", "otas", "azos", "azas", "escos", "escas",
        "eria", "ero", "era", "ismo", "ista", "able", "ible", "idad", "anza",
        "ante", "iente", "illo", "illa", "ito", "ita", "ote", "ota", "azo", "aza",
        "esco", "esca", "oso", "osa", "osos", "osas", "al", "ales", "ar", "er", "ir",
        "ando", "iendo", "ado", "ada", "ados", "adas", "ido", "ida", "idos", "idas",
        "ces", "es", "s", "a", "o", "e"
    )
    for suf in suffixes:
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            stem = w[: -len(suf)]
            if suf == "ces":
                stem += "z"
            return stem
    return w


def generate_inflections(norm_lemma: str) -> set[str]:
    """Genera plurales regulares y variantes ortográficas comunes de un lema español."""
    w = normalize_word(norm_lemma)
    if len(w) < 2:
        return set()
    forms = {w}
    if w.endswith(("a", "e", "i", "o", "u")):
        forms.add(w + "s")
    elif w.endswith("z") and len(w) >= 3:
        forms.add(w[:-1] + "ces")
    elif not w.endswith("s"):
        forms.add(w + "es")

    # Cambio de género adjetival/nominal estándar si termina en o/a
    if w.endswith("o") and len(w) >= 4:
        fem = w[:-1] + "a"
        forms.add(fem)
        forms.add(fem + "s")
    return forms


def is_morphological_derivative(core_word: str, candidate_word: str) -> bool:
    """
    Determina si candidate_word comparte raíz léxica directa con core_word
    (Límite de Roche morfológico), evitando falsos positivos en palabras cortas.
    """
    c_norm = normalize_word(core_word)
    w_norm = normalize_word(candidate_word)
    if not c_norm or not w_norm:
        return False
    if c_norm == w_norm:
        return True

    # Plurales directos de la palabra núcleo
    if w_norm in generate_inflections(c_norm):
        return True

    c_stem = spanish_stem(c_norm)
    w_stem = spanish_stem(w_norm)
    if len(c_stem) >= 4 and c_stem == w_stem:
        return True

    # Prefijo léxico común largo (ej. reloj -> relojero, espej -> espejismo)
    prefix_len = min(len(c_norm), 5) if len(c_norm) >= 5 else len(c_norm)
    if prefix_len >= 4 and w_norm.startswith(c_norm[:prefix_len]):
        # Evitar falsos positivos obvios no relacionados verificando cercanía de longitud o sufijo
        if len(w_norm) <= len(c_norm) + 6:
            return True

    return False
