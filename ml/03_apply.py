"""
Experiment 3 — how many of the 183,598 gaps can responsibly be filled?

Test-set accuracy only transfers to the unlabelled pairs if those pairs resemble
the test set. Experiment 2 showed the model is close to useless once a drug has
no labelled history, so the deployability question is not "how accurate is it"
but "how many unlabelled pairs involve drugs it has actually seen".

Run:  python 03_apply.py
"""

import collections
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier

from features import CLASSES, SEED, load, build_adjacency, FeatureBuilder

MIN_HISTORY = 5   # labelled interactions a drug needs before we trust its profile

records, labelled, unlabelled = load()
adjacency = build_adjacency(records)
print(f"labelled {len(labelled):,} · unlabelled {len(unlabelled):,}")

history = collections.Counter()
for r in labelled:
    history[r["drugALower"]] += 1
    history[r["drugBLower"]] += 1

buckets = collections.Counter()
for r in unlabelled:
    a, b = history[r["drugALower"]], history[r["drugBLower"]]
    if a == 0 or b == 0:
        buckets["cold — one drug has no labelled interactions at all"] += 1
    elif a < MIN_HISTORY or b < MIN_HISTORY:
        buckets[f"thin — one drug has fewer than {MIN_HISTORY} labelled"] += 1
    else:
        buckets["warm — both drugs well covered"] += 1

print("\napplicability of the unlabelled pairs:")
for label, n in buckets.most_common():
    print(f"  {n:>7,}  {n/len(unlabelled):>6.1%}  {label}")

# Train on everything labelled, then predict the gaps.
y = np.array([r["severity"] for r in labelled])
fb = FeatureBuilder(adjacency).fit(labelled, y)
X = fb.transform(labelled, labels=y)
model = HistGradientBoostingClassifier(
    max_iter=400, random_state=SEED,
    categorical_features=FeatureBuilder.categorical_columns(X.shape[1]),
)
model.fit(X, y)

Xu = fb.transform(unlabelled)
proba = model.predict_proba(Xu)
pred = model.classes_[proba.argmax(axis=1)]
conf = proba.max(axis=1)

print("\npredicted severity across all unlabelled pairs:")
for c, n in collections.Counter(pred).most_common():
    print(f"  {n:>7,}  {n/len(pred):>6.1%}  {c}")

warm = np.array([
    history[r["drugALower"]] >= MIN_HISTORY and history[r["drugBLower"]] >= MIN_HISTORY
    for r in unlabelled
])
for t in (0.8, 0.9):
    keep = warm & (conf >= t)
    print(f"\nwarm AND confidence >= {t} — {keep.sum():,} pairs "
          f"({keep.mean():.1%} of unlabelled):")
    for c, n in collections.Counter(pred[keep]).most_common():
        print(f"  {n:>7,}  {c}")

# Face validity: the pairs the model is surest about should be recognisable to a
# clinician. If these look arbitrary, the metrics above are not to be trusted.
print("\nhighest-confidence Major predictions (clinical sanity check):")
major = np.where(pred == "Major")[0]
for i in major[np.argsort(-conf[major])][:10]:
    r = unlabelled[i]
    print(f"  {conf[i]:.3f}  {r['drugA']} + {r['drugB']}")
