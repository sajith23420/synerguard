"""
Experiment 2 — is the result real, and where does it stop working?

  A. label-shuffle control — train the identical pipeline on randomised labels.
     If anything leaks, the model still scores well. It must collapse.
  B. drug-disjoint split   — hold out whole DRUGS rather than pairs. Experiment 1
     left only 23 genuinely-unseen rows, so it could not speak to this at all.
  C. confidence thresholds — a deployed checker need not answer every pair. What
     does staying silent when unsure buy, and what coverage does it cost?

Run:  python 02_experiments.py
"""

import collections
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score, classification_report

from features import CLASSES, SEED, load, build_adjacency, FeatureBuilder

rng = np.random.default_rng(SEED)
records, labelled, _ = load()
adjacency = build_adjacency(records)
print(f"{len(records):,} pairs · {len(labelled):,} labelled")


def fit_predict(train, y_train, test):
    fb = FeatureBuilder(adjacency).fit(train, y_train)
    X_tr = fb.transform(train, labels=y_train)
    X_te = fb.transform(test)
    model = HistGradientBoostingClassifier(
        max_iter=400, random_state=SEED,
        categorical_features=FeatureBuilder.categorical_columns(X_tr.shape[1]),
    )
    model.fit(X_tr, y_train)
    return model.predict(X_te), model.predict_proba(X_te)


def score(tag, truth, pred):
    acc = accuracy_score(truth, pred)
    f1 = f1_score(truth, pred, average="macro", labels=CLASSES, zero_division=0)
    print(f"  {tag:<40} acc {acc:.4f}   macro-F1 {f1:.4f}")
    return acc, f1


y_all = np.array([r["severity"] for r in labelled])
i_tr, i_te = train_test_split(
    np.arange(len(labelled)), test_size=0.2, random_state=SEED, stratify=y_all
)
train = [labelled[i] for i in i_tr]
test = [labelled[i] for i in i_te]
y_tr, y_te = y_all[i_tr], y_all[i_te]

# ------------------------------------------------------------ A. leakage control
print("\n--- A. label-shuffle control (must collapse to the majority baseline) ---")
majority = collections.Counter(y_tr).most_common(1)[0][0]
score("majority baseline", y_te, np.full(len(y_te), majority))

shuffled_pred, _ = fit_predict(train, rng.permutation(y_tr), test)
score("trained on SHUFFLED labels", y_te, shuffled_pred)

pred, proba = fit_predict(train, y_tr, test)
score("trained on real labels", y_te, pred)

# ------------------------------------------------------------ B. unseen drugs
print("\n--- B. drug-disjoint split (medicines the model has never seen) ---")
drugs = sorted({d for r in labelled for d in (r["drugALower"], r["drugBLower"])})
held = set(rng.choice(drugs, size=int(0.15 * len(drugs)), replace=False))

# Strictly disjoint: no training pair may touch a held-out drug, or that drug
# would already have a severity profile and would not be "unseen" at all.
train2 = [r for r in labelled
          if r["drugALower"] not in held and r["drugBLower"] not in held]
test2 = [r for r in labelled
         if r["drugALower"] in held or r["drugBLower"] in held]
y_tr2 = np.array([r["severity"] for r in train2])
y_te2 = np.array([r["severity"] for r in test2])
print(f"  {len(held)} of {len(drugs)} drugs held out · train {len(train2):,} · test {len(test2):,}")

majority2 = collections.Counter(y_tr2).most_common(1)[0][0]
score("majority baseline", y_te2, np.full(len(y_te2), majority2))
pred2, _ = fit_predict(train2, y_tr2, test2)
score("model, at least one drug unseen", y_te2, pred2)

both_unseen = np.array(
    [r["drugALower"] in held and r["drugBLower"] in held for r in test2]
)
print(f"  of which BOTH drugs unseen: {both_unseen.sum():,}")
if both_unseen.sum() > 50:
    score("model, BOTH drugs unseen", y_te2[both_unseen], pred2[both_unseen])
    score("model, exactly one unseen", y_te2[~both_unseen], pred2[~both_unseen])

# ------------------------------------------------------------ C. thresholds
print("\n--- C. confidence thresholds (random split) ---")
conf = proba.max(axis=1)
print(f"  {'threshold':>9} {'coverage':>9} {'accuracy':>9} {'macro-F1':>9}")
for t in (0.0, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95):
    keep = conf >= t
    if not keep.any():
        continue
    print(f"  {t:>9.2f} {keep.mean():>8.1%} "
          f"{accuracy_score(y_te[keep], pred[keep]):>9.4f} "
          f"{f1_score(y_te[keep], pred[keep], average='macro', labels=CLASSES, zero_division=0):>9.4f}")

print("\nper-class detail at threshold 0.80:")
keep = conf >= 0.80
print(classification_report(y_te[keep], pred[keep], labels=CLASSES, zero_division=0))
