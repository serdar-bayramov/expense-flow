from pydantic import BaseModel


class CheckoutSessionRequest(BaseModel):
    plan: str  # 'professional' or 'pro_plus'


class CheckoutSessionResponse(BaseModel):
    url: str


class BillingPortalResponse(BaseModel):
    url: str
