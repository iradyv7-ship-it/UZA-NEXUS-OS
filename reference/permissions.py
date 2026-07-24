"""Role, object-level and field-level access control (spec sections 5, 13, I, N)."""
from dataclasses import dataclass, field
import events


class AccessDenied(Exception):
    pass


@dataclass
class Actor:
    user_id: str
    role: str
    name: str
    office: str = "RW"
    scope: dict = field(default_factory=dict)   # e.g. {"customer_id": ..., "shipment_ids": [...]}


# (role -> set of "resource:action") -------------------------------------------------
ROLE_GRANTS = {
    "ceo": {"*:*"},
    "venture_manager": {
        "lead:*", "request:*", "project:*", "task:*", "quotation:*", "order:*",
        "customer:read", "supplier:read", "shipment:read", "shipment:create",
        "package:read", "package:update", "invoice:read", "payment:read",
        "sourcing_task:create",
    },
    "china_sourcing": {
        "supplier:*", "rfq:*", "supplier_quote:*", "po:*", "visit:create",
        "inspection:read", "capa:*", "project:read", "task:read", "package:read",
    },
    "china_warehouse": {
        "visit:read", "visit:accept", "inspection:*", "package:*", "receipt:*",
        "supplier:read", "po:read", "capa:read",
    },
    "front_office": {
        "customer:read", "call:*", "promise:*", "quotation:read", "quotation:draft",
        "project:read", "order:read", "shipment:read", "petty_cash:*",
    },
    "finance": {
        "invoice:*", "payment:*", "po:approve", "margin:read", "commission:*",
        "project:read", "order:read", "supplier:read",
    },
    "sales_agent": {
        "lead:create", "lead:read", "customer:create", "customer:read",
        "request:create", "quotation:read", "order:read", "commission:read",
    },
    "customer": {
        "project:read", "quotation:read", "order:read", "invoice:read",
        "payment:create", "shipment:read", "package:read",
    },
    "logistics_partner": {
        "shipment:read", "package:read", "delivery:*", "customs_doc:*",
    },
}

# Fields nobody outside this set may ever see (spec section I: "Never expose full
# margin calculations to unauthorized users"; section N: Imari sees no costs).
CONFIDENTIAL_FIELDS = {
    "supplier_unit_cost": {"ceo", "china_sourcing", "venture_manager", "finance"},
    "po_total":           {"ceo", "china_sourcing", "venture_manager", "finance"},
    "target_price":       {"ceo", "china_sourcing", "venture_manager", "finance"},
    "walkaway_price":     {"ceo", "china_sourcing", "venture_manager", "finance"},
    "margin_pct":         {"ceo", "venture_manager", "finance"},
    "agent_commission":   {"ceo", "finance", "sales_agent"},
}


def can(actor, resource, action):
    grants = ROLE_GRANTS.get(actor.role, set())
    return any(g in grants for g in ("*:*", f"{resource}:*", f"*:{action}", f"{resource}:{action}"))


def _in_scope(actor, obj):
    """Object-level access: least privilege (spec section 5)."""
    if actor.role in ("ceo", "venture_manager", "finance", "china_sourcing",
                      "china_warehouse", "front_office"):
        return True
    if actor.role == "customer":
        return getattr(obj, "customer_id", None) == actor.scope.get("customer_id")
    if actor.role == "sales_agent":
        return getattr(obj, "agent_id", None) == actor.user_id or \
               getattr(obj, "customer_id", None) in actor.scope.get("customer_ids", [])
    if actor.role == "logistics_partner":
        # A partner is scoped to shipments. The object may BE a shipment, or hang
        # off one (package, delivery, customs doc), so resolve to a shipment ref.
        sid = (getattr(obj, "shipment_ref", None)
               or getattr(obj, "shipment_id", None)
               or (obj.ref if obj.__class__.__name__ == "Shipment" else None))
        return sid in actor.scope.get("shipment_ids", [])
    return False


def authorize(actor, resource, action, obj=None):
    if not can(actor, resource, action):
        events.audit(actor, "ACCESS_DENIED", f"{resource}:{action}", "role grant missing")
        raise AccessDenied(f"{actor.role} may not {action} {resource}")
    if obj is not None and not _in_scope(actor, obj):
        events.audit(actor, "ACCESS_DENIED", f"{resource}:{action}", "object out of scope")
        raise AccessDenied(f"{actor.role} {actor.user_id} is out of scope for that {resource}")
    events.audit(actor, f"{resource}:{action}", getattr(obj, "ref", "-"))
    return True


def project_fields(actor, record: dict) -> dict:
    """Field-level masking applied on read."""
    out = {}
    for k, v in record.items():
        allowed = CONFIDENTIAL_FIELDS.get(k)
        if allowed is None or actor.role in allowed:
            out[k] = v
        else:
            out[k] = "***"
    return out
