"""
Generate a realistic synthetic payment fraud dataset.

Produces 20,000 transactions with ~3% fraud rate (highly imbalanced).
Features mimic real payment fraud signals: velocity, amount, time-of-day,
device/IP novelty, chargeback history, failed attempts, geographic distance.

This is SYNTHETIC data — no real customer information is used.
"""

import numpy as np
import pandas as pd
from pathlib import Path

np.random.seed(42)

N_TRANSACTIONS = 20000
FRAUD_RATE = 0.03


def generate_synthetic_transactions(n: int = N_TRANSACTIONS, fraud_rate: float = FRAUD_RATE) -> pd.DataFrame:
    n_fraud = int(n * fraud_rate)
    n_legit = n - n_fraud

    records = []

    # --- Legitimate transactions ---
    # ~8% of legit transactions have some fraud-like characteristics (noise/overlap)
    n_legit_noisy = int(n_legit * 0.08)

    for i in range(n_legit):
        is_noisy = i < n_legit_noisy

        if is_noisy:
            # Legitimate but looks somewhat suspicious
            hour = np.random.choice(range(0, 24))
            amount = np.clip(np.random.lognormal(mean=4.5, sigma=1.1), 10, 8000)
            recent_tx = np.random.poisson(5)
            chargebacks = np.random.poisson(0.3)
            failed_tx = np.random.poisson(2)
            is_new_device = np.random.random() < 0.35
            is_new_ip = np.random.random() < 0.35
            distance_from_home = np.clip(np.random.exponential(200), 10, 2000)
            device_account_count = np.random.poisson(2.5)
            ip_account_count = np.random.poisson(3)
            velocity_1h = np.random.poisson(4)
        else:
            # Normal legitimate transaction
            hour = np.random.choice(range(8, 22), p=_daytime_weights())
            amount = np.clip(np.random.lognormal(mean=3.2, sigma=0.9), 1, 5000)
            recent_tx = np.random.poisson(2)
            chargebacks = np.random.poisson(0.05)
            failed_tx = np.random.poisson(0.3)
            is_new_device = np.random.random() < 0.05
            is_new_ip = np.random.random() < 0.05
            distance_from_home = np.clip(np.random.exponential(50), 0, 2000)
            device_account_count = np.random.poisson(1.2)
            ip_account_count = np.random.poisson(1.5)
            velocity_1h = np.random.poisson(1)

        avg_user_amount = np.clip(np.random.lognormal(3.2, 0.9), 1, 5000)

        records.append({
            "amount": round(amount, 2),
            "hour_of_day": hour,
            "recent_transaction_count": recent_tx,
            "velocity_1h": velocity_1h,
            "previous_chargebacks": chargebacks,
            "failed_transaction_count": failed_tx,
            "is_new_device": int(is_new_device),
            "is_new_ip": int(is_new_ip),
            "distance_from_home": round(distance_from_home, 1),
            "device_account_count": device_account_count,
            "ip_account_count": ip_account_count,
            "avg_user_amount": round(avg_user_amount, 2),
            "is_fraud": 0,
        })

    # --- Fraudulent transactions ---
    # ~15% of fraud transactions look more normal (sophisticated fraud, harder to detect)
    n_fraud_stealthy = int(n_fraud * 0.15)

    for i in range(n_fraud):
        is_stealthy = i < n_fraud_stealthy

        if is_stealthy:
            # Fraud that mimics legitimate behavior (harder to catch)
            hour = np.random.choice(range(8, 22), p=_daytime_weights())
            amount = np.clip(np.random.lognormal(mean=3.5, sigma=0.8), 5, 3000)
            recent_tx = np.random.poisson(3)
            chargebacks = np.random.poisson(0.5)
            failed_tx = np.random.poisson(1)
            is_new_device = np.random.random() < 0.20
            is_new_ip = np.random.random() < 0.20
            distance_from_home = np.clip(np.random.exponential(100), 0, 1500)
            device_account_count = np.random.poisson(1.5)
            ip_account_count = np.random.poisson(2)
            velocity_1h = np.random.poisson(2)
        else:
            # Typical fraud pattern
            hour = np.random.choice(range(0, 24), p=_night_weights())
            amount = np.clip(np.random.lognormal(mean=5.0, sigma=1.0), 10, 10000)
            recent_tx = np.random.poisson(8)
            chargebacks = np.random.poisson(1.5)
            failed_tx = np.random.poisson(4)
            is_new_device = np.random.random() < 0.65
            is_new_ip = np.random.random() < 0.70
            distance_from_home = np.clip(np.random.exponential(400), 50, 3000)
            device_account_count = np.random.poisson(4)
            ip_account_count = np.random.poisson(5)
            velocity_1h = np.random.poisson(6)

        avg_user_amount = np.clip(np.random.lognormal(3.2, 0.9), 1, 5000)

        records.append({
            "amount": round(amount, 2),
            "hour_of_day": hour,
            "recent_transaction_count": recent_tx,
            "velocity_1h": velocity_1h,
            "previous_chargebacks": chargebacks,
            "failed_transaction_count": failed_tx,
            "is_new_device": int(is_new_device),
            "is_new_ip": int(is_new_ip),
            "distance_from_home": round(distance_from_home, 1),
            "device_account_count": device_account_count,
            "ip_account_count": ip_account_count,
            "avg_user_amount": round(avg_user_amount, 2),
            "is_fraud": 1,
        })

    df = pd.DataFrame(records)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df


def _daytime_weights() -> np.ndarray:
    hours = list(range(8, 22))
    w = np.array([1.0] * len(hours), dtype=float)
    w[0] = 0.5
    w[-1] = 0.5
    return w / w.sum()


def _night_weights() -> np.ndarray:
    hours = list(range(0, 24))
    w = np.array([1.0] * 24, dtype=float)
    for h in range(0, 6):
        w[h] = 3.0
    for h in range(22, 24):
        w[h] = 2.5
    return w / w.sum()


if __name__ == "__main__":
    import subprocess
    import sys

    output_dir = Path(__file__).parent / "data"
    output_dir.mkdir(exist_ok=True)

    df_raw = generate_synthetic_transactions()
    raw_path = output_dir / "synthetic_transactions_raw.csv"
    df_raw.to_csv(raw_path, index=False)
    print(f"Saved raw transactions to {raw_path}")

    # Run Node feature engineering script
    script_path = Path(__file__).parent / "engineer_dataset.js"
    cmd = ["node", "--experimental-strip-types", str(script_path)]
    print(f"Running bulk feature engineering via Node: {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("Feature engineering failed!", file=sys.stderr)
        print(res.stderr, file=sys.stderr)
        sys.exit(res.returncode)
    else:
        print(res.stdout)

    # Load engineered dataset to print summary metrics
    output_path = output_dir / "synthetic_transactions.csv"
    df = pd.read_csv(output_path)
    print(f"Generated {len(df)} transactions ({df['is_fraud'].sum()} fraud, {len(df) - df['is_fraud'].sum()} legit)")
    print(f"Fraud rate: {df['is_fraud'].mean():.2%}")
    print(f"Saved to {output_path}")
    print(f"\nFeature columns: {[c for c in df.columns if c != 'is_fraud']}")
    print(f"\nClass balance:\n{df['is_fraud'].value_counts()}")
