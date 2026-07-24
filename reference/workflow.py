"""Workflow services: the connected record chain from spec section 3."""
import ids, events, policy, permissions as perm
from domain import *
from events import emit, gap
from permissions import authorize

YEAR = "2026"
CBM_TOLERANCE = 0.05   # spec is silent on this


# --- notifications -------------------------------------------------------------
def notify(role_or_user, message, ref=""):
    DB.notifications.append({"to": role_or_user, "msg": message, "ref": ref})


# --- lead -> project -----------------------------------------------------------
def create_customer(actor, name, country, phone, agent_id=None):
    authorize(actor, "customer", "create")
    ref = ids.make("customer", country=country)
    c = Customer(ref=ref, name=name, country=country, phone=phone,
                 agent_id=agent_id, customer_id=ref)
    return DB.put("customers", c)


def create_lead(actor, customer, raw_text):
    authorize(actor, "lead", "create")
    l = Lead(ref=ids.make("lead", year=YEAR), customer_id=customer.ref,
             agent_id=actor.user_id, raw_text=raw_text)
    DB.put("leads", l)
    emit("lead_created", actor, ref=l.ref, customer_id=customer.ref)
    return l


def clarify_lead(actor, lead, structured_spec):
    """AI clarification -> structured request (spec section E)."""
    lead.clarified = True
    lead.stage = "Qualification"
    r = Request(ref=ids.make("request", venture="BULK", year=YEAR),
                customer_id=lead.customer_id, lead_ref=lead.ref, spec=structured_spec)
    DB.put("requests", r)
    emit("request_created", actor, ref=r.ref, customer_id=r.customer_id)
    return r


def create_project(actor, request, name, owner):
    authorize(actor, "project", "create")
    cust = DB.customers[request.customer_id]
    p = Project(ref=ids.make("project", venture="BULK", year=YEAR),
                customer_id=request.customer_id, agent_id=cust.agent_id,
                request_ref=request.ref, name=name, owner=owner)
    DB.put("projects", p)
    notify(owner, f"Project {p.ref} assigned to you", p.ref)
    return p


def create_task(actor, project, title, accountable, responsible):
    authorize(actor, "task", "create")
    t = Task(ref=ids.make("task", venture="BULK", year=YEAR), project_ref=project.ref,
             title=title, accountable=accountable, responsible=responsible)
    DB.put("tasks", t)
    notify(responsible, f"Task: {title}", t.ref)
    return t


# --- sourcing ------------------------------------------------------------------
def register_supplier(actor, name_en, name_cn):
    authorize(actor, "supplier", "create")
    s = Supplier(ref=f"SUP-CN-{len(DB.suppliers)+1:04d}", name_en=name_en, name_cn=name_cn)
    return DB.put("suppliers", s)


def add_supplier_quote(actor, supplier, project, unit_cost, moq, lead_time, unit_cbm, unit_kg):
    authorize(actor, "supplier_quote", "create")
    q = SupplierQuote(ref=f"SQ-{len(DB.supplier_quotes)+1:04d}", supplier_ref=supplier.ref,
                      project_ref=project.ref, unit_cost_usd=unit_cost, moq=moq,
                      lead_time_days=lead_time, unit_cbm=unit_cbm, unit_kg=unit_kg)
    return DB.put("supplier_quotes", q)


def build_quotation(actor, project, chosen_quote, qty, required_margin,
                    est_costs, sell_incoterm="CIF", inland_separable=True):
    """Price off a full cost ladder. est_costs are per-unit estimates."""
    authorize(actor, "quotation", "create")
    ladder = policy.CostLadder(inland_separable=inland_separable,
                               basis="EXW" if inland_separable else "FOB")
    ladder.set_est(exw=chosen_quote.unit_cost_usd, **est_costs)
    # Freight contingency protects against the CBM overage that always comes.
    for k in ("ocean", "inland_dest"):
        ladder.lines[k].est = round(ladder.lines[k].est * (1 + policy.FREIGHT_CONTINGENCY), 2)

    sell_cost = ladder.at(sell_incoterm)
    customer_price = round(sell_cost / (1 - required_margin), 2)
    q = Quotation(ref=ids.make("quotation", venture="BULK", year=YEAR),
                  project_ref=project.ref, customer_id=project.customer_id,
                  agent_id=project.agent_id, qty=qty,
                  supplier_unit_cost=chosen_quote.unit_cost_usd,
                  target_price=round(chosen_quote.unit_cost_usd * 0.92, 2),
                  walkaway_price=round(chosen_quote.unit_cost_usd * 1.05, 2),
                  customer_unit_price=customer_price,
                  freight_share=round(ladder.lines["ocean"].est, 2),
                  sell_incoterm=sell_incoterm, ladder=ladder,
                  margin_pct=ladder.margin(customer_price, sell_incoterm))
    return DB.put("quotations", q)


def dap_margin(quotation):
    """The number that tells the truth, whatever incoterm you sold at."""
    return quotation.ladder.margin(quotation.customer_unit_price, "DAP")


def close_project_costs(actor, quotation, **actuals):
    """Actuals land weeks later. Realized margin is recomputed, never overwritten."""
    quotation.ladder.set_act(**actuals)
    quotation.realized_margin = dap_margin(quotation)
    return quotation.realized_margin


def approve_quotation(actor, quotation):
    authorize(actor, "quotation", "approve")
    quotation.status = "approved"
    return quotation


def create_order(actor, quotation):
    authorize(actor, "order", "create")
    o = Order(ref=ids.make("order", venture="BULK", year=YEAR),
              project_ref=quotation.project_ref, customer_id=quotation.customer_id,
              agent_id=quotation.agent_id, quotation_ref=quotation.ref,
              total_usd=round(quotation.qty * quotation.customer_unit_price, 2))
    o.tier, sched = policy.schedule_for(_completed_orders(o.customer_id))
    for trig, pct in sched:
        inst = Installment(ref=f"{o.ref}-{trig}", order_ref=o.ref, trigger=trig,
                           pct=pct, amount_usd=round(o.total_usd * pct, 2))
        DB.put("installments", inst)
        o.installments.append(inst.ref)
    DB.put("orders", o)
    inv = Invoice(ref=ids.make("invoice", venture="BULK", year=YEAR), order_ref=o.ref,
                  customer_id=o.customer_id, amount_usd=o.total_usd)
    DB.put("invoices", inv)
    return o, inv


def _completed_orders(customer_id):
    return len([o for o in DB.orders.values()
                if o.customer_id == customer_id and o.status == "delivered"])


def next_due(order):
    for r in order.installments:
        if DB.installments[r].status == "due":
            return DB.installments[r]
    return None


def paid_pct(order):
    return round(sum(DB.installments[r].pct for r in order.installments
                     if DB.installments[r].status == "paid"), 4)


# --- payment -------------------------------------------------------------------
def upload_payment_proof(actor, invoice, amount, proof):
    authorize(actor, "payment", "create", invoice)
    p = Payment(ref=ids.make("payment", year=YEAR), invoice_ref=invoice.ref,
                customer_id=invoice.customer_id, amount_usd=amount, proof=proof)
    DB.put("payments", p)
    emit("payment_proof_uploaded", actor, ref=p.ref, amount=amount)
    return p


def verify_payment(actor, payment):
    """Only Finance. Spec section 8: AI may not approve payments."""
    authorize(actor, "payment", "approve")
    inv = DB.invoices[payment.invoice_ref]
    order = DB.orders[inv.order_ref]
    payment.status = "verified"

    inst = next_due(order)
    if inst and payment.amount_usd >= inst.amount_usd - 0.01:
        inst.status = "paid"
    else:
        raise ValueError(f"Payment ${payment.amount_usd} does not settle the next "
                         f"installment (${inst.amount_usd} on {inst.trigger})")

    inv.status = "paid" if paid_pct(order) >= 1.0 else "part_paid"
    if inst.trigger == "confirmation":
        if inst.pct < policy.MIN_DEPOSIT:
            raise ValueError("Deposit below policy minimum")
        order.status = "procurement_active"
        emit("payment_verified", actor, ref=payment.ref, order_ref=order.ref)
    return payment


# --- procurement / production --------------------------------------------------
def create_po(actor, order, supplier, quote, qty):
    authorize(actor, "po", "create")
    po = PurchaseOrder(ref=ids.make("po", country="CN", year=YEAR),
                       supplier_ref=supplier.ref, order_ref=order.ref, qty=qty,
                       unit_cost_usd=quote.unit_cost_usd,
                       po_total=round(qty * quote.unit_cost_usd, 2),
                       declared_cbm=round(qty * quote.unit_cbm, 3),
                       declared_kg=round(qty * quote.unit_kg, 1))
    return DB.put("pos", po)


def assign_visit(actor, po, inspector_id):
    authorize(actor, "visit", "create")
    v = Visit(ref=ids.make("visit", country="CN", year=YEAR), po_ref=po.ref,
              assigned_to=inspector_id)
    DB.put("visits", v)
    notify(inspector_id, f"Factory visit assigned for {po.ref}", v.ref)
    return v


def record_inspection(actor, visit, critical, major, minor, evidence):
    authorize(actor, "inspection", "create")
    i = Inspection(ref=ids.make("inspection", country="CN", year=YEAR),
                   visit_ref=visit.ref, po_ref=visit.po_ref,
                   critical=critical, major=major, minor=minor, evidence=evidence)
    i.result = "fail" if critical > 0 else ("conditional" if major > 2 else "pass")
    DB.put("inspections", i)
    if i.result == "fail":
        emit("quality_failure", actor, ref=i.ref, po_ref=i.po_ref)
    return i


def open_capa(actor, inspection):
    po = DB.pos[inspection.po_ref]
    c = CAPA(ref=ids.make("capa", country="CN", year=YEAR),
             inspection_ref=inspection.ref, supplier_ref=po.supplier_ref)
    return DB.put("capas", c)


def close_capa(actor, capa, reinspection):
    """Spec section L: release only after human review."""
    authorize(actor, "capa", "approve")
    if reinspection.result != "pass":
        raise ValueError("CAPA cannot close on a failed reinspection")
    capa.status = "closed"
    return capa


# --- warehouse -----------------------------------------------------------------
def receive_packages(actor, order, po, package_specs):
    """package_specs: list of (kg, cbm). Returns packages + discrepancy report."""
    authorize(actor, "package", "create")
    made = []
    lot = ids.make("lot", parent=order.ref.replace("ORD-BULK-2026-", "ORD"))
    for kg, cbm in package_specs:
        p = Package(ref=ids.make("package", parent=order.ref.replace("ORD-BULK-2026-", "ORD")),
                    order_ref=order.ref, customer_id=order.customer_id,
                    lot_ref=lot, kg=kg, cbm=cbm)
        DB.put("packages", p)
        made.append(p)
    measured_cbm = round(sum(p.cbm for p in made), 3)
    measured_kg = round(sum(p.kg for p in made), 1)
    variance = (measured_cbm - po.declared_cbm) / po.declared_cbm
    report = {"declared_cbm": po.declared_cbm, "measured_cbm": measured_cbm,
              "measured_kg": measured_kg, "measured_rt": policy.revenue_ton(measured_cbm, measured_kg),
              "variance": round(variance, 4),
              "discrepancy": abs(variance) > policy.CBM_TOLERANCE,
              "hard_stop": variance > policy.CBM_HARD_STOP}
    if report["hard_stop"]:
        for p in made:
            p.variance_hold = True
    emit("warehouse_receipt_uploaded", actor, ref=lot, order_ref=order.ref, **report)
    return made, report


def resolve_variance(actor, packages, decision, approver_note=""):
    """Human decision before booking: client_pays | uza_absorbs | reduce_qty."""
    authorize(actor, "package", "update")
    if decision not in ("client_pays", "uza_absorbs", "reduce_qty"):
        raise ValueError("unknown variance decision")
    for p in packages:
        p.variance_hold = False
    events.audit(actor, "variance_resolved", packages[0].order_ref, f"{decision}: {approver_note}")
    return decision


def record_billed_weight(actor, shipment, billed_rt, freight_paid_usd):
    """What the forwarder actually charged. Measured vs billed is a claim, not a client issue."""
    shipment.billed_rt = billed_rt
    shipment.freight_paid_usd = freight_paid_usd
    pkgs = [DB.packages[r] for r in shipment.package_refs]
    measured_rt = policy.revenue_ton(sum(p.cbm for p in pkgs), sum(p.kg for p in pkgs))
    if billed_rt > measured_rt * 1.02:
        DB.claims.append({"shipment": shipment.ref, "measured_rt": measured_rt,
                          "billed_rt": billed_rt,
                          "over_rt": round(billed_rt - measured_rt, 3)})
        notify("finance", f"Forwarder billed {billed_rt} RT vs {measured_rt} measured "
                          f"on {shipment.ref}", shipment.ref)
    return measured_rt


def allocate_freight(actor, shipment):
    """Pro-rata by revenue ton. Residual is consolidation profit or loss."""
    pkgs = [DB.packages[r] for r in shipment.package_refs]
    by_order = {}
    for p in pkgs:
        by_order.setdefault(p.order_ref, []).append(p)
    total_rt = sum(policy.revenue_ton(sum(p.cbm for p in ps), sum(p.kg for p in ps))
                   for ps in by_order.values())
    for oref, ps in by_order.items():
        rt = policy.revenue_ton(sum(p.cbm for p in ps), sum(p.kg for p in ps))
        shipment.allocations[oref] = round(shipment.freight_paid_usd * rt / total_rt, 2)
    return {"allocations": dict(shipment.allocations),
            "freight_paid": shipment.freight_paid_usd,
            "total_rt": round(total_rt, 3),
            "container_utilisation": round(total_rt / 28.0, 3)}


def qc_release(actor, packages, inspection):
    authorize(actor, "package", "update")
    if inspection.result == "fail":
        raise PermissionError("Release gate: packages cannot be released on a failed inspection")
    for p in packages:
        p.qc_released = True
        p.zone = "READY_FOR_LOADING"
    return packages


def allocate_destination(actor, packages, destination):
    authorize(actor, "package", "update")
    for p in packages:
        p.destination = destination
        p.zone = destination
    return packages


# --- shipment ------------------------------------------------------------------
def create_shipment(actor, packages, container, carrier, etd, eta, partner_id):
    authorize(actor, "shipment", "create") if perm.can(actor, "shipment", "create") else None
    blocked = [p.ref for p in packages if not p.qc_released]
    if blocked:
        raise PermissionError(f"Cannot load unreleased packages: {blocked}")
    if any(p.variance_hold for p in packages):
        raise PermissionError("Loading gate: volumetric variance unresolved")
    order = DB.orders[packages[0].order_ref]
    if any(DB.installments[r].trigger == "pre_loading" and DB.installments[r].status == "due"
           for r in order.installments):
        raise PermissionError(f"Loading gate: pre-loading installment unpaid on {order.ref}")
    dests = {p.destination for p in packages}
    if len(dests) > 1:
        raise ValueError(f"Containers are destination-pure; got {dests}")
    s = Shipment(ref=ids.make("shipment", year=YEAR), container=container, carrier=carrier,
                 etd=etd, eta=eta, package_refs=[p.ref for p in packages],
                 partner_id=partner_id, status="in_transit")
    DB.put("shipments", s)
    for p in packages:
        p.shipment_id = s.ref
    emit("container_assigned", actor, ref=s.ref, packages=len(packages))
    return s


def track(actor, shipment, milestone, source):
    t = TrackingEvent(ref=f"TRK-{len(DB.tracking)+1:04d}", shipment_ref=shipment.ref,
                      milestone=milestone, source=source)
    DB.put("tracking", t)
    return t


def delay_shipment(actor, shipment, new_eta, reason):
    old = shipment.eta
    shipment.eta = new_eta
    shipment.status = "delayed"
    emit("shipment_delayed", actor, ref=shipment.ref, old_eta=old, new_eta=new_eta, reason=reason)
    return shipment


def deliver(actor, shipment, packages, pod):
    authorize(actor, "delivery", "create", shipment)
    order = DB.orders[packages[0].order_ref]
    unpaid = [DB.installments[r] for r in order.installments
              if DB.installments[r].status == "due"]
    if unpaid:
        raise PermissionError(
            f"Release gate: {order.ref} has ${sum(i.amount_usd for i in unpaid):,.2f} "
            f"outstanding. Goods stay in the warehouse.")
    d = Delivery(ref=ids.make("delivery", office="GOM", year=YEAR), shipment_ref=shipment.ref,
                 package_refs=[p.ref for p in packages],
                 customer_id=packages[0].customer_id, pod=pod, status="delivered")
    DB.put("deliveries", d)
    for p in packages:
        p.delivered = True
    emit("delivery_completed", actor, ref=d.ref, order_ref=packages[0].order_ref)
    return d


def cancel_order(actor, order, reason):
    """Order collapses after the deposit. Triggers commission clawback."""
    authorize(actor, "order", "update")
    order.status = "cancelled"
    emit("order_cancelled", actor, ref=order.ref, reason=reason)
    return order
