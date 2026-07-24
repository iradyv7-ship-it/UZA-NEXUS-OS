"""Event handlers: this is where the modules are supposed to work together."""
import events
from events import on, gap
from domain import DB
import workflow as wf


@on("request_created")
def h_request_created(actor, ref, customer_id, **_):
    wf.notify("badiane", f"New structured request {ref} awaiting project creation", ref)


@on("payment_proof_uploaded")
def h_payment_proof(actor, ref, amount, **_):
    wf.notify("finance", f"Payment proof {ref} (${amount}) needs verification", ref)


COMMISSION_RATE = 0.02


@on("payment_verified")
def h_payment_verified(actor, ref, order_ref, **_):
    order = DB.orders[order_ref]
    wf.notify("cecilia", f"Procurement activated for {order_ref}", order_ref)
    wf.notify(order.customer_id, "Payment confirmed, production will begin", order_ref)
    wf.notify(order.agent_id, "Your client's payment is confirmed", order_ref)
    # Founder decision: agents earn 2% on CONFIRMED orders. Confirmed = deposit
    # received and verified by Finance, not order created.
    if not order.commission_accrued:
        amount = round(order.total_usd * COMMISSION_RATE, 2)
        DB.commissions[order.agent_id] = DB.commissions.get(order.agent_id, 0) + amount
        DB.commission_ledger.append({"agent": order.agent_id, "order": order_ref,
                                     "amount": amount, "type": "accrual"})
        order.commission_accrued = True
        wf.notify(order.agent_id, f"Commission ${amount} accrued on confirmed order", order_ref)


@on("order_cancelled")
def h_order_cancelled(actor, ref, reason, **_):
    """Clawback: commission was paid before goods existed."""
    order = DB.orders[ref]
    if order.commission_accrued:
        amount = round(order.total_usd * COMMISSION_RATE, 2)
        DB.commissions[order.agent_id] = DB.commissions.get(order.agent_id, 0) - amount
        DB.commission_ledger.append({"agent": order.agent_id, "order": ref,
                                     "amount": -amount, "type": "clawback"})
        wf.notify(order.agent_id, f"Commission ${amount} reversed: {reason}", ref)
        wf.notify("finance", f"Clawback ${amount} against {order.agent_id}", ref)


@on("quality_failure")
def h_quality_failure(actor, ref, po_ref, **_):
    insp = DB.inspections[ref]
    capa = wf.open_capa(actor, insp)
    po = DB.pos[po_ref]
    order = DB.orders[po.order_ref]
    proj = DB.projects[DB.quotations[order.quotation_ref].project_ref]
    proj.health = "red"
    for who in ("cecilia", "francois", proj.owner):
        wf.notify(who, f"CRITICAL defect on {po_ref}; release blocked; {capa.ref} opened", capa.ref)
    return capa


@on("warehouse_receipt_uploaded")
def h_receipt(actor, ref, order_ref, variance, discrepancy, hard_stop=False, **k):
    order = DB.orders[order_ref]
    proj = DB.projects[DB.quotations[order.quotation_ref].project_ref]
    if discrepancy:
        wf.create_task(_system(), proj, f"Resolve CBM variance {variance:+.1%} on {order_ref}",
                       accountable=proj.owner, responsible="cecilia")
        wf.notify(proj.owner, f"CBM variance {variance:+.1%} on {order_ref}", order_ref)
        # Declared vs measured is the supplier's problem: it feeds their score.
        po = [p for p in DB.pos.values() if p.order_ref == order_ref][0]
        sup = DB.suppliers[po.supplier_ref]
        sup.score = round(sup.score - min(abs(variance) * 10, 2.0), 2)
    if hard_stop:
        wf.notify(proj.owner, f"LOADING BLOCKED on {order_ref}: variance {variance:+.1%} "
                              f"exceeds {__import__('policy').CBM_HARD_STOP:.0%}", order_ref)
        wf.notify("finance", f"Freight overage decision needed on {order_ref}", order_ref)


@on("container_assigned")
def h_container(actor, ref, packages, **_):
    ship = DB.shipments[ref]
    pkgs = [DB.packages[r] for r in ship.package_refs]
    for c in {p.customer_id for p in pkgs}:
        wf.notify(c, f"Your goods are loaded in container {ship.container}", ref)
    wf.notify(ship.partner_id, f"Shipment {ref} assigned to you", ref)


@on("shipment_delayed")
def h_delayed(actor, ref, old_eta, new_eta, reason, **_):
    ship = DB.shipments[ref]
    pkgs = [DB.packages[r] for r in ship.package_refs]
    affected_orders = {p.order_ref for p in pkgs}
    for o in affected_orders:
        order = DB.orders[o]
        proj = DB.projects[DB.quotations[order.quotation_ref].project_ref]
        proj.health = "amber"
        wf.notify(order.customer_id, f"New ETA {new_eta} ({reason})", ref)
        wf.notify(order.agent_id, f"Client {order.customer_id} delayed to {new_eta}", ref)
        wf.notify(proj.owner, f"Delay on {o}: {reason}", ref)
    wf.notify("adeline", f"Prepare client calls for delayed shipment {ref}", ref)
    wf.notify(ship.partner_id, f"Revised ETA {new_eta}", ref)


@on("delivery_completed")
def h_delivered(actor, ref, order_ref, **_):
    order = DB.orders[order_ref]
    pkgs = [p for p in DB.packages.values() if p.order_ref == order_ref]
    if all(p.delivered for p in pkgs):
        order.status = "delivered"
        wf.notify("adeline", f"Record satisfaction for {order_ref}", order_ref)


class _Sys:
    user_id, role, name = "system", "ceo", "System"
    scope = {}


def _system():
    return _Sys()
