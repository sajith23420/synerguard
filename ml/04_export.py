"""
Experiment 4 — export the deployable predictions.

Trains on every labelled pair, predicts the unlabelled ones, then keeps only the
subset experiment 3 showed can be trusted:

  * warm  — both drugs have at least MIN_HISTORY labelled interactions, because
            the drug-disjoint split showed the model is near-useless without
            per-drug history (macro-F1 0.338 with both drugs unseen)
  * sure  — predicted probability >= MIN_CONFIDENCE, which bought 94% accuracy
            at 74% coverage on the held-out split

Writes ../server/src/data/predictions.json as newline-delimited JSON:

    {"pairKey": "aspirin||warfarin", "severity": "Major", "confidence": 0.9612}

The model itself is deliberately NOT serialised. The web app must run on Node
alone — shipping the predictions as data keeps `npm install` the only setup step,
and makes the artefact reviewable in a way a pickle would not be.

Run:  python 04_export.py
"""

import collections
import json
import os
import sys

import numpy as np
import sklearn
from sklearn.ensemble import HistGradientBoostingClassifier

from features import CLASSES, SEED, load, build_adjacency, FeatureBuilder

# Both thresholds are duplicated in server/src/store.js — keep them in step, or
# the app will warn about "too little data" for pairs this script happily
# predicted, and vice versa.
MIN_HISTORY = 5
MIN_CONFIDENCE = 0.90

OUT = os.path.join(os.path.dirname(__file__), "..", "server", "src", "data", "predictions.json")

print(f"python {sys.version.split()[0]} · scikit-learn {sklearn.__version__} · numpy {np.__version__}")

records, labelled, unlabelled = load()
print(f"labelled {len(labelled):,} · unlabelled {len(unlabelled):,}")

history = collections.Counter()
for r in labelled:
    history[r["drugALower"]] += 1
    history[r["drugBLower"]] += 1

adjacency = build_adjacency(records)
y = np.array([r["severity"] for r in labelled])

fb = FeatureBuilder(adjacency).fit(labelled, y)
X = fb.transform(labelled, labels=y)          # leave-one-out on the training rows
model = HistGradientBoostingClassifier(
    max_iter=400, random_state=SEED,
    categorical_features=FeatureBuilder.categorical_columns(X.shape[1]),
)
model.fit(X, y)
print(f"trained on {len(labelled):,} pairs · {X.shape[1]} features")

Xu = fb.transform(unlabelled)
proba = model.predict_proba(Xu)
pred = model.classes_[proba.argmax(axis=1)]
conf = proba.max(axis=1)

warm = np.array([
    history[r["drugALower"]] >= MIN_HISTORY and history[r["drugBLower"]] >= MIN_HISTORY
    for r in unlabelled
])
keep = warm & (conf >= MIN_CONFIDENCE)

print(f"\nwarm {warm.sum():,} · confident {(conf >= MIN_CONFIDENCE).sum():,} "
      f"· both {keep.sum():,} ({keep.mean():.1%} of unlabelled)")
for cls, n in collections.Counter(pred[keep]).most_common():
    print(f"  {n:>7,}  {cls}")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
written = 0
with open(OUT, "w", encoding="utf-8") as fh:
    for i in np.flatnonzero(keep):
        fh.write(json.dumps({
            "pairKey": unlabelled[i]["pairKey"],
            "severity": str(pred[i]),
            "confidence": round(float(conf[i]), 4),
        }) + "\n")
        written += 1

size_mb = os.path.getsize(OUT) / 1024 / 1024
print(f"\nwrote {written:,} predictions to {os.path.normpath(OUT)} ({size_mb:.1f} MB)")
print(f"thresholds: MIN_HISTORY={MIN_HISTORY} MIN_CONFIDENCE={MIN_CONFIDENCE} SEED={SEED}")
print("note: these must match the constants in server/src/store.js")
