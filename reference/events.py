"""Internal event bus + audit trail (spec section 14, section 13 audit logs)."""
from collections import defaultdict
from datetime import datetime

_handlers = defaultdict(list)
AUDIT = []          # every state change, who did it
EVENT_LOG = []      # every event emitted
GAPS = []           # decisions the master prompt did not specify


def on(event_name):
    def deco(fn):
        _handlers[event_name].append(fn)
        return fn
    return deco


def emit(event_name, actor, **payload):
    EVENT_LOG.append({"event": event_name, "actor": actor.user_id, "payload": payload})
    audit(actor, f"event:{event_name}", payload.get("ref", ""))
    results = []
    for h in _handlers[event_name]:
        results.append(h(actor=actor, **payload))
    return results


def audit(actor, action, ref, detail=""):
    AUDIT.append({
        "ts": datetime.utcnow().isoformat(timespec="seconds"),
        "actor": getattr(actor, "user_id", str(actor)),
        "role": getattr(actor, "role", "-"),
        "action": action,
        "ref": ref,
        "detail": detail,
    })


def gap(area, question, default_taken):
    """Record a place where the spec is silent and the code had to decide."""
    GAPS.append({"area": area, "question": question, "default": default_taken})
