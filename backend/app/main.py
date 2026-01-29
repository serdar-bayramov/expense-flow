from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from app.api.v1 import auth, users, receipts, mileage, journey_templates, email, webhooks, stripe as stripe_router

security = HTTPBearer()

app = FastAPI(
    title="Expense Flow API",
    description="Receipt management and OCR processing",
    version="1.0.0"
)

# CORS middleware (allows frontend to call API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://expense-flow-1774ebfyl-serdars-projects-1f40f033.vercel.app",
        "https://expense-flow-flax-ten.vercel.app",
        "https://expense-flow-git-main-serdars-projects-1f40f033.vercel.app",
        "https://expenseflow.co.uk",
        "https://www.expenseflow.co.uk",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include authentication routes
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1") 
app.include_router(receipts.router, prefix="/api/v1")
app.include_router(mileage.router, prefix="/api/v1/mileage", tags=["Mileage"])
app.include_router(journey_templates.router, prefix="/api/v1/mileage", tags=["Journey Templates"])
app.include_router(email.router, prefix="/api/v1/email", tags=["Email"])
app.include_router(stripe_router.router, prefix="/api/v1/stripe", tags=["Stripe"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["Webhooks"])

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Expense Flow API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}