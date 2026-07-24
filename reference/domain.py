"""Domain entities for the UZA Bulk China -> Kigali/Goma corridor."""
from dataclasses import dataclass, field
from typing import Optional, List
import ids


@dataclass
class Base:
    ref: str = ""
    id: str = field(default_factory=ids.uid)


@dataclass
class Customer(Base):
    name: str = ""
    country: str = "CD"
    phone: str = ""
    agent_id: Optional[str] = None
    customer_id: str = ""          # for scope checks


@dataclass
class Lead(Base):
    customer_id: str = ""
    agent_id: str = ""
    raw_text: str = ""
    stage: str = "Awareness"
    clarified: bool = False


@dataclass
class Request(Base):
    customer_id: str = ""
    lead_ref: str = ""
    spec: dict = field(default_factory=dict)
    venture: str = "BULK"


@dataclass
class Project(Base):
    customer_id: str = ""
    agent_id: str = ""
    request_ref: str = ""
    name: str = ""
    owner: str = ""
    stage: str = "Qualification"
    health: str = "green"


@dataclass
class Task(Base):
    project_ref: str = ""
    title: str = ""
    accountable: str = ""
    responsible: str = ""
    status: str = "open"


@dataclass
class Supplier(Base):
    name_en: str = ""
    name_cn: str = ""
    country: str = "CN"
    lifecycle: str = "Discovered"
    score: float = 0.0


@dataclass
class SupplierQuote(Base):
    supplier_ref: str = ""
    project_ref: str = ""
    unit_cost_usd: float = 0.0
    moq: int = 0
    lead_time_days: int = 0
    unit_cbm: float = 0.0
    unit_kg: float = 0.0


@dataclass
class Installment(Base):
    order_ref: str = ""
    trigger: str = ""            # confirmation | pre_loading | pre_release
    pct: float = 0.0
    amount_usd: float = 0.0
    status: str = "due"          # due | paid


@dataclass
class Quotation(Base):
    project_ref: str = ""
    customer_id: str = ""
    agent_id: str = ""
    qty: int = 0
    supplier_unit_cost: float = 0.0
    target_price: float = 0.0
    walkaway_price: float = 0.0
    customer_unit_price: float = 0.0
    freight_share: float = 0.0
    margin_pct: float = 0.0      # quoted margin, locked at approval
    realized_margin: Optional[float] = None
    sell_incoterm: str = "CIF"
    ladder: object = None
    version: int = 1
    status: str = "draft"


@dataclass
class Order(Base):
    project_ref: str = ""
    customer_id: str = ""
    agent_id: str = ""
    quotation_ref: str = ""
    total_usd: float = 0.0
    status: str = "awaiting_payment"
    commission_accrued: bool = False
    tier: str = "new"
    installments: List[str] = field(default_factory=list)


@dataclass
class Invoice(Base):
    order_ref: str = ""
    customer_id: str = ""
    amount_usd: float = 0.0
    status: str = "issued"


@dataclass
class Payment(Base):
    invoice_ref: str = ""
    customer_id: str = ""
    amount_usd: float = 0.0
    status: str = "pending_verification"
    proof: str = ""


@dataclass
class PurchaseOrder(Base):
    supplier_ref: str = ""
    order_ref: str = ""
    qty: int = 0
    unit_cost_usd: float = 0.0
    po_total: float = 0.0
    status: str = "issued"
    declared_cbm: float = 0.0     # what the factory says
    declared_kg: float = 0.0


@dataclass
class Visit(Base):
    po_ref: str = ""
    assigned_to: str = ""
    status: str = "assigned"


@dataclass
class Inspection(Base):
    visit_ref: str = ""
    po_ref: str = ""
    stage: str = "pre_shipment"
    critical: int = 0
    major: int = 0
    minor: int = 0
    result: str = "pending"
    evidence: List[str] = field(default_factory=list)


@dataclass
class CAPA(Base):
    inspection_ref: str = ""
    supplier_ref: str = ""
    status: str = "open"


@dataclass
class Package(Base):
    order_ref: str = ""
    customer_id: str = ""
    lot_ref: str = ""
    kg: float = 0.0
    cbm: float = 0.0
    destination: str = "AWAITING_INSPECTION"
    zone: str = "AWAITING_INSPECTION"
    qc_released: bool = False
    variance_hold: bool = False   # commercial hold, independent of QC state
    shipment_id: Optional[str] = None
    delivered: bool = False


@dataclass
class Shipment(Base):
    container: str = ""
    carrier: str = ""
    etd: str = ""
    eta: str = ""
    status: str = "planned"
    package_refs: List[str] = field(default_factory=list)
    partner_id: Optional[str] = None
    destination: str = ""
    freight_paid_usd: float = 0.0
    billed_rt: float = 0.0        # what the forwarder charged on
    allocations: dict = field(default_factory=dict)


@dataclass
class TrackingEvent(Base):
    shipment_ref: str = ""
    milestone: str = ""
    source: str = "estimated"      # carrier | partner | uza | estimated
    ts: str = ""


@dataclass
class Delivery(Base):
    shipment_ref: str = ""
    package_refs: List[str] = field(default_factory=list)
    customer_id: str = ""
    pod: str = ""
    status: str = "planned"


class Store:
    """Stand-in for PostgreSQL. One dict per aggregate."""
    def __init__(self):
        self.customers, self.leads, self.requests = {}, {}, {}
        self.projects, self.tasks = {}, {}
        self.suppliers, self.supplier_quotes = {}, {}
        self.quotations, self.orders, self.invoices, self.payments = {}, {}, {}, {}
        self.pos, self.visits, self.inspections, self.capas = {}, {}, {}, {}
        self.packages, self.shipments, self.tracking, self.deliveries = {}, {}, {}, {}
        self.commissions = {}
        self.commission_ledger = []
        self.installments = {}
        self.claims = []
        self.notifications = []

    def put(self, bucket, obj):
        getattr(self, bucket)[obj.ref] = obj
        return obj


DB = Store()
