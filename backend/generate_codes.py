"""
Script to generate beta invite codes

Usage:
    python generate_codes.py 20  # Generate 20 codes
"""
import sys
import requests

API_URL = "http://localhost:8000/api/v1"

def login():
    """Login with your admin account"""
    email = input("Enter your email: ")
    password = input("Enter your password: ")
    
    response = requests.post(
        f"{API_URL}/auth/login",
        data={"username": email, "password": password}
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.json()}")
        sys.exit(1)
    
    token = response.json()["access_token"]
    print(f"✅ Logged in as {email}\n")
    return token


def generate_codes(token, count=20):
    """Generate invite codes"""
    headers = {"Authorization": f"Bearer {token}"}
    
    codes = []
    for i in range(count):
        response = requests.post(
            f"{API_URL}/invite-codes/generate",
            json={
                "max_uses": 1,
                "expires_in_days": 30,
                "grants_plan": "pro_plus",
                "is_beta_code": True,
                "beta_duration_days": 30,
                "notes": f"Beta tester #{i+1}"
            },
            headers=headers
        )
        
        if response.status_code == 200:
            code = response.json()["code"]
            codes.append(code)
            print(f"✅ Generated: {code}")
        else:
            print(f"❌ Failed: {response.json()}")
    
    return codes


def save_codes(codes):
    """Save codes to a file"""
    with open("beta_codes.txt", "w") as f:
        f.write("BETA INVITE CODES\n")
        f.write("=" * 50 + "\n\n")
        for i, code in enumerate(codes, 1):
            f.write(f"{i}. {code}\n")
            f.write(f"   Signup URL: http://localhost:3000/signup?code={code}\n\n")
    
    print(f"\n✅ Saved {len(codes)} codes to beta_codes.txt")


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    
    print(f"🔑 Generating {count} beta invite codes...\n")
    
    # Login
    token = login()
    
    # Generate codes
    codes = generate_codes(token, count)
    
    # Save to file
    if codes:
        save_codes(codes)
        print(f"\n🎉 Done! Send these codes to your beta testers.")
