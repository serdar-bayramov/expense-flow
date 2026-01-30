from pydantic import BaseModel


class CheckoutSessionRequest(BaseModel):
    plan: str  # 'professional' or 'pro_plus'


class CheckoutSessionResponse(BaseModel):
    url: str
    message: str | None = None  # Optional message for upgrades/downgrades


class BillingPortalResponse(BaseModel):
    url: str
