"""Spec scenarios plus the four founder decisions, run end to end."""
import events, policy, permissions as perm, workflow as wf, handlers
from permissions import Actor, AccessDenied, authorize, project_fields
from domain import DB

PASS, FAIL = [], []


def check(name, cond, note=""):
    (PASS if cond else FAIL).append(f"{name} {note}".strip())
    print(f"  [{'PASS' if cond else 'FAIL'}] {name} {note}")


def expect_block(name, fn, exc=(PermissionError, ValueError)):
    try:
        fn()
        check(name, False, "NOT blocked")
    except exc as e:
        check(name, True, f"-> {str(e)[:70]}")


ceo      = Actor("kevin", "ceo", "Founder")
badiane  = Actor("badiane", "venture_manager", "Badiane")
cecilia  = Actor("cecilia", "china_sourcing", "Cecilia", office="CN")
francois = Actor("francois", "china_warehouse", "Francois", office="CN")
adeline  = Actor("adeline", "front_office", "Adeline")
finance  = Actor("kagabo", "finance", "Kagabo")
agent    = Actor("AGT-GOM-0021", "sales_agent", "Goma agent", office="GOM")
imari    = Actor("imari", "logistics_partner", "Imari")

print("\n=== SCENARIO 1: Bulk order, China -> Goma, new client ===")
cust = wf.create_customer(agent, "Kivu Hardware SARL", "CD", "+243...", agent_id=agent.user_id)
agent.scope["customer_ids"] = [cust.ref]
customer = Actor("client1", "customer", "Kivu Hardware", scope={"customer_id": cust.ref})

lead = wf.create_lead(agent, cust, "solar panels for shop, 300pcs, urgent")
req  = wf.clarify_lead(badiane, lead, {"product": "solar panel 200W", "qty": 300,
                                       "destination": "Goma", "incoterm": "CIF"})
proj = wf.create_project(badiane, req, "Kivu Hardware solar 200W", owner="badiane")
sup  = wf.register_supplier(cecilia, "Ningbo Solar Co", "Ningbo Solar")
sq   = wf.add_supplier_quote(cecilia, sup, proj, unit_cost=41.0, moq=100,
                             lead_time=25, unit_cbm=0.055, unit_kg=11.5)

print("\n--- DECISION 1: cost ladder, sell at CIF, watch DAP ---")
quote = wf.build_quotation(badiane, proj, sq, qty=300, required_margin=0.18,
                           est_costs={"inland_cn": 1.20, "export_docs": 0.35,
                                      "origin_thc": 0.60, "ocean": 6.50, "insurance": 0.30,
                                      "dest_charges": 1.80, "duty_vat": 4.90,
                                      "inland_dest": 3.40})
print(f"      EXW {quote.ladder.at('EXW'):>7.2f} | FOB {quote.ladder.at('FOB'):>7.2f} | "
      f"CIF {quote.ladder.at('CIF'):>7.2f} | DAP {quote.ladder.at('DAP'):>7.2f}")
print(f"      sell ${quote.customer_unit_price} -> quoted CIF margin {quote.margin_pct:.1%}, "
      f"true DAP margin {wf.dap_margin(quote):.1%}")
check("quoted margin holds at sell incoterm", abs(quote.margin_pct - 0.18) < 0.005)
check("DAP margin is materially lower and visible", wf.dap_margin(quote) < quote.margin_pct - 0.10)
check("freight carries contingency", quote.ladder.lines["ocean"].est > 6.50)

wf.approve_quotation(badiane, quote)
order, inv = wf.create_order(badiane, quote)

print("\n--- DECISION 2: payment schedule by client tier ---")
check("new client gets 50/50", order.tier == "new" and len(order.installments) == 2)
print(f"      {[(DB.installments[r].trigger, f'{DB.installments[r].pct:.0%}') for r in order.installments]}")
expect_block("underpayment rejected, not silently accepted",
             lambda: wf.verify_payment(finance, wf.upload_payment_proof(
                 customer, inv, inv.amount_usd * 0.20, "short.pdf")))

pay1 = wf.upload_payment_proof(customer, inv, inv.amount_usd * 0.50, "slip1.pdf")
try:
    wf.verify_payment(adeline, pay1)
    check("only finance verifies", False)
except AccessDenied:
    check("only finance verifies", True)
wf.verify_payment(finance, pay1)
check("procurement activated on confirmation installment", order.status == "procurement_active")
check("agent 2% accrues at confirmation",
      DB.commissions.get(agent.user_id) == round(order.total_usd * 0.02, 2),
      f"-> ${DB.commissions.get(agent.user_id)}")

po    = wf.create_po(cecilia, order, sup, sq, qty=300)
visit = wf.assign_visit(cecilia, po, "francois")

print("\n=== SCENARIO 4: critical defect blocks release ===")
insp1 = wf.record_inspection(francois, visit, 2, 1, 4, ["frame_crack.jpg"])
capa  = list(DB.capas.values())[0]
check("critical defect fails and opens CAPA", insp1.result == "fail" and capa.status == "open")
insp2 = wf.record_inspection(francois, visit, 0, 1, 2, ["reinspect.jpg"])
wf.close_capa(cecilia, capa, insp2)
check("CAPA closes only on passing reinspection", capa.status == "closed")

print("\n--- DECISION 3: three-way volumetrics, gate before booking ---")
pkgs, rep = wf.receive_packages(francois, order, po, [(11.5 * 25, 0.062 * 25)] * 12)
print(f"      declared {rep['declared_cbm']} cbm | measured {rep['measured_cbm']} cbm "
      f"| {rep['variance']:+.1%} | revenue ton {rep['measured_rt']}")
check("variance beyond hard stop freezes the goods",
      rep["hard_stop"] and all(p.variance_hold for p in pkgs))
check("supplier score takes the hit", sup.score < 0, f"-> {sup.score}")
wf.qc_release(francois, pkgs, insp2)
check("QC release does not clear the commercial hold",
      all(p.qc_released and p.variance_hold for p in pkgs))
wf.allocate_destination(francois, pkgs, "GOMA")
expect_block("gate 1: variance unresolved blocks booking",
             lambda: wf.create_shipment(badiane, pkgs, "MSKU1", "Maersk",
                                        "2026-08-01", "2026-09-12", "imari"))
wf.resolve_variance(badiane, pkgs, "client_pays", "revised freight accepted by client")
expect_block("gate 2: pre-loading installment unpaid blocks booking",
             lambda: wf.create_shipment(badiane, pkgs, "MSKU1", "Maersk",
                                        "2026-08-01", "2026-09-12", "imari"))
pay2 = wf.upload_payment_proof(customer, inv, inv.amount_usd * 0.50, "slip2.pdf")
wf.verify_payment(finance, pay2)

print("\n--- DECISION 4: destination-pure containers ---")
wf.allocate_destination(francois, pkgs[9:], "KIGALI")
expect_block("gate 3: mixed-destination container rejected",
             lambda: wf.create_shipment(badiane, pkgs, "MSKU1", "Maersk",
                                        "2026-08-01", "2026-09-12", "imari"))
wf.allocate_destination(francois, pkgs, "GOMA")
ship = wf.create_shipment(badiane, pkgs, "MSKU1234567", "Maersk", "2026-08-01",
                          "2026-09-12", "imari")
imari.scope["shipment_ids"] = [ship.ref]
check("container books once paid and resolved", ship.status == "in_transit")

measured_rt = wf.record_billed_weight(finance, ship, billed_rt=21.5, freight_paid_usd=1950.0)
check("forwarder over-billing raises a claim, not a client conversation",
      len(DB.claims) == 1, f"-> billed 21.5 RT vs {measured_rt} measured")
alloc = wf.allocate_freight(finance, ship)
print(f"      freight ${alloc['freight_paid']} over {alloc['total_rt']} RT | "
      f"container utilisation {alloc['container_utilisation']:.0%}")
check("freight allocated by revenue ton", alloc["allocations"][order.ref] > 0)

wf.track(badiane, ship, "departed Ningbo", source="carrier")
wf.track(badiane, ship, "expected Dar es Salaam", source="estimated")
check("tracking separates confirmed from estimated",
      {t.source for t in DB.tracking.values()} == {"carrier", "estimated"})

print("\n=== SCENARIO 5: delay fan-out ===")
before = len(DB.notifications)
wf.delay_shipment(badiane, ship, "2026-09-30", "vessel omitted port call")
fan = {n["to"] for n in DB.notifications[before:]}
check("delay reaches client, agent, owner, Adeline, partner",
      {cust.ref, agent.user_id, "badiane", "adeline", "imari"} <= fan)

print("\n=== SCENARIO 7: permissions ===")
expect_block("agent cannot read suppliers", lambda: authorize(agent, "supplier", "read"),
             exc=AccessDenied)
m = project_fields(agent, {"customer_unit_price": quote.customer_unit_price,
                           "supplier_unit_cost": quote.supplier_unit_cost,
                           "margin_pct": quote.margin_pct})
check("agent sees price, never cost or margin",
      m["supplier_unit_cost"] == "***" and m["margin_pct"] == "***" and m["customer_unit_price"] > 0)
check("Imari sees volumetrics, never cost",
      project_fields(imari, {"cbm": pkgs[0].cbm,
                             "supplier_unit_cost": 41.0})["supplier_unit_cost"] == "***")
other = Actor("client2", "customer", "Other", scope={"customer_id": "CUS-RW-000999"})
expect_block("customer cannot read another customer's project",
             lambda: authorize(other, "project", "read", proj), exc=AccessDenied)

print("\n=== delivery, realized margin ===")
d = wf.deliver(imari, ship, pkgs, pod="signed_goma.jpg")
check("release only after full payment", d.status == "delivered")
realized = wf.close_project_costs(badiane, quote,
                                  ocean=round(alloc["allocations"][order.ref] / 300, 2),
                                  duty_vat=5.60, inland_dest=4.10, dest_charges=2.05)
print(f"      quoted CIF {quote.margin_pct:.1%} -> realized DAP {realized:.1%}")
check("realized margin from actuals, quoted left intact",
      quote.realized_margin is not None and abs(quote.margin_pct - 0.18) < 0.001)

print("\n=== SCENARIO 8: order collapses after deposit ===")
c2 = wf.create_customer(agent, "Test Trading", "RW", "+250...", agent_id=agent.user_id)
agent.scope["customer_ids"].append(c2.ref)
a2 = Actor("client3", "customer", "Test", scope={"customer_id": c2.ref})
p2 = wf.create_project(badiane, wf.clarify_lead(badiane, wf.create_lead(agent, c2, "50 pumps"),
                                                {"product": "pump", "qty": 50}),
                       "Test pumps", owner="badiane")
sq2 = wf.add_supplier_quote(cecilia, sup, p2, 88.0, 50, 30, 0.09, 22.0)
q2 = wf.build_quotation(badiane, p2, sq2, qty=50, required_margin=0.18,
                        est_costs={"inland_cn": 2.0, "ocean": 9.0, "duty_vat": 8.0})
wf.approve_quotation(badiane, q2)
o2, i2 = wf.create_order(badiane, q2)
wf.verify_payment(finance, wf.upload_payment_proof(a2, i2, i2.amount_usd * 0.50, "s.pdf"))
earned = DB.commissions[agent.user_id]
wf.cancel_order(badiane, o2, "client withdrew")
check("clawback reverses commission",
      DB.commissions[agent.user_id] == round(earned - o2.total_usd * 0.02, 2))
check("ledger shows every movement",
      [e["type"] for e in DB.commission_ledger] == ["accrual", "accrual", "clawback"])

print("\n--- tier promotion ---")
check("established tier is 30/40/30 after 3 delivered orders",
      policy.schedule_for(3)[0] == "established" and len(policy.schedule_for(3)[1]) == 3)

print("\n" + "=" * 70)
print(f"RESULT: {len(PASS)} passed, {len(FAIL)} failed")
for f in FAIL:
    print("  FAILED:", f)
print(f"\nEvents {len(events.EVENT_LOG)} | Audit {len(events.AUDIT)} | "
      f"Notifications {len(DB.notifications)} | "
      f"Denials {len([a for a in events.AUDIT if a['action']=='ACCESS_DENIED'])}")
open_gaps = {(g["area"], g["question"]) for g in events.GAPS}
print(f"\nOPEN SPEC GAPS: {len(open_gaps) if open_gaps else 'none'}")
for a, q in open_gaps:
    print(f"  - [{a}] {q}")
