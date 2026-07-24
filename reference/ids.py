"""Readable internal identifiers (spec section 4) layered over UUID primary keys."""
import uuid
from collections import defaultdict

_counters = defaultdict(int)

# Registry of spec-defined ID shapes. {seq} is zero-padded to {pad}.
PATTERNS = {
    "customer":   ("CUS-{country}-{seq}", 6),
    "agent":      ("AGT-{office}-{seq}", 4),
    "lead":       ("LED-{year}-{seq}", 4),
    "request":    ("REQ-{venture}-{year}-{seq}", 4),
    "project":    ("PRJ-{venture}-{year}-{seq}", 4),
    "task":       ("TSK-{venture}-{year}-{seq}", 4),
    "quotation":  ("QUO-{venture}-{year}-{seq}", 4),
    "order":      ("ORD-{venture}-{year}-{seq}", 4),
    "po":         ("PO-{country}-{year}-{seq}", 4),
    "lot":        ("LOT-{parent}-{seq}", 2),
    "package":    ("PKG-{parent}-{seq}", 3),
    "visit":      ("VIS-{country}-{year}-{seq}", 4),
    "inspection": ("INS-{country}-{year}-{seq}", 4),
    "capa":       ("CAPA-{country}-{year}-{seq}", 4),
    "shipment":   ("SHP-{year}-{seq}", 4),
    "delivery":   ("DLV-{office}-{year}-{seq}", 4),
    "call":       ("CALL-{year}-{seq}", 5),
    "invoice":    ("INV-{venture}-{year}-{seq}", 4),
    "payment":    ("PAY-{year}-{seq}", 4),
}


def make(kind, **kw):
    tpl, pad = PATTERNS[kind]
    scope = f"{kind}:{kw.get('venture','')}:{kw.get('country','')}:{kw.get('parent','')}:{kw.get('year','')}"
    _counters[scope] += 1
    seq = str(_counters[scope]).zfill(pad)
    return tpl.format(seq=seq, **kw)


def uid():
    return str(uuid.uuid4())
