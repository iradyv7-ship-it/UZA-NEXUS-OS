"""UZA Bulk commercial policy. Every number a founder should be able to change
without a developer lives here, not scattered through workflow code."""
from dataclasses import dataclass, field
from typing import Optional

# --- payment ------------------------------------------------------------------
# Collection must never sit behind payment to the factory.
PAYMENT_SCHEDULES = {
    "new":         [("confirmation", 0.50), ("pre_loading", 0.50)],
    "established": [("confirmation", 0.30), ("pre_loading", 0.40), ("pre_release", 0.30)],
}
MIN_DEPOSIT = 0.30              # never below this on manufacturing
ESTABLISHED_AFTER_ORDERS = 3    # completed, no late payment

# --- volumetrics --------------------------------------------------------------
CBM_TOLERANCE = 0.05            # declared vs measured: normal factory sloppiness
CBM_HARD_STOP = 0.10            # beyond this, loading stops until someone decides
FREIGHT_CONTINGENCY = 0.09      # built into every quotation

# --- commission ---------------------------------------------------------------
COMMISSION_RATE = 0.02          # on confirmed orders (deposit verified)
LEAD_DECAY_RATE = 0.01          # subsequent orders, same client, within 12 months
LEAD_OWNERSHIP_MONTHS = 12

# --- cost ladder --------------------------------------------------------------
# Order matters: each rung accumulates into the next incoterm.
LADDER = [
    ("exw",         "EXW"),
    ("inland_cn",   "FOB"),
    ("export_docs", "FOB"),
    ("origin_thc",  "FOB"),
    ("ocean",       "CIF"),
    ("insurance",   "CIF"),
    ("dest_charges", "DAP"),
    ("duty_vat",    "DAP"),
    ("inland_dest", "DAP"),
]
INCOTERMS = ["EXW", "FOB", "CIF", "DAP"]


@dataclass
class CostLine:
    est: float = 0.0
    act: Optional[float] = None

    @property
    def value(self):
        return self.act if self.act is not None else self.est

    @property
    def is_actual(self):
        return self.act is not None


@dataclass
class CostLadder:
    """Estimated at quotation, actuals filled in as they land."""
    lines: dict = field(default_factory=lambda: {k: CostLine() for k, _ in LADDER})
    basis: str = "EXW"          # EXW when inland is separable, FOB when supplier won't split
    inland_separable: bool = True

    def set_est(self, **kw):
        for k, v in kw.items():
            self.lines[k].est = v
        return self

    def set_act(self, **kw):
        for k, v in kw.items():
            self.lines[k].act = v
        return self

    def at(self, incoterm):
        """Cumulative cost up to and including the given incoterm."""
        idx = INCOTERMS.index(incoterm)
        return round(sum(self.lines[k].value for k, rung in LADDER
                         if INCOTERMS.index(rung) <= idx), 2)

    def margin(self, sell_price, incoterm):
        c = self.at(incoterm)
        return round((sell_price - c) / sell_price, 4) if sell_price else 0.0

    def actuals_landed(self):
        return all(self.lines[k].is_actual for k, _ in LADDER)


def revenue_ton(cbm, kg):
    """Forwarders bill on the greater of volume or weight."""
    return round(max(cbm, kg / 1000.0), 3)


def schedule_for(completed_orders):
    tier = "established" if completed_orders >= ESTABLISHED_AFTER_ORDERS else "new"
    return tier, PAYMENT_SCHEDULES[tier]
