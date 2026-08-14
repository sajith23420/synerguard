"""
Experiment 1 — how much of the missing severity is predictable at all?

Compares four models on a random 80/20 split of the 130,470 labelled pairs.
The point of the ladder is to show where the signal actually comes from, which
turns out not to be where the description text is.

Run:  python 01_baseline.py
"""

import collections
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, f1_score, classification_report, confusion_matrix,
)

from features import CLASSES, SEED, load, build_adjacency, FeatureBuilder

records, labelled, _ = load()
print(f"{len(records):,} pairs · {len(labelled):,} labelled")
print("class balance:", dict(collections.Counter(r["severity"] for r in labelled)))

adjacency = build_adjacency(records)
y_all = np.array([r["severity"] for r in labelled])
i_tr, i_te = train_test_split(
    np.arange(len(labelled)), test_size=0.2, random_state=SEED, stratify=y_all
)
train = [labelled[i] for i in i_tr]
test = [labelled[i] for i in i_te]
y_tr, y_te = y_all[i_tr], y_all[i_te]
print(f"train {len(train):,} · test {len(test):,}")

fb = FeatureBuilder(adjacency).fit(train, y_tr)
X_tr = fb.transform(train, labels=y_tr)   # leave-one-out
X_te = fb.transform(test)                 # unseen rows, nothing to leave out
print(f"{len(fb.template_id)} mechanism templates · {X_tr.shape[1]} features")


def report(name, pred, truth=y_te):
    acc = accuracy_score(truth, pred)
    f1 = f1_score(truth, pred, average="macro", labels=CLASSES, zero_division=0)
    print(f"\n=== {name}\n    accuracy {acc:.4f}    macro-F1 {f1:.4f}")
    return acc, f1


results = {}

# 0 — always answer with the commonest class. Accuracy alone looks respectable
#     here purely because 74% of pairs are Moderate; macro-F1 exposes that.
majority = collections.Counter(y_tr).most_common(1)[0][0]
results["majority"] = report(f"0. always predict {majority}", np.full(len(y_te), majority))

# 1 — mechanism template alone
TEMPLATE_COL = X_tr.shape[1] - 1


def onehot(col):
    n = len(fb.template_id)
    m = np.zeros((len(col), n + 1), dtype=np.float32)
    idx = col.astype(int)
    m[np.arange(len(col)), np.where(idx < 0, n, idx)] = 1
    return m


lr = LogisticRegression(max_iter=1000)
lr.fit(onehot(X_tr[:, TEMPLATE_COL]), y_tr)
results["template"] = report(
    "1. mechanism template only", lr.predict(onehot(X_te[:, TEMPLATE_COL]))
)

# 2 — drug severity profile + graph structure, no text
gb = HistGradientBoostingClassifier(max_iter=300, random_state=SEED)
gb.fit(X_tr[:, :TEMPLATE_COL], y_tr)
results["graph"] = report("2. drug profile + graph only", gb.predict(X_te[:, :TEMPLATE_COL]))

# 3 — everything
model = HistGradientBoostingClassifier(
    max_iter=400, random_state=SEED,
    categorical_features=FeatureBuilder.categorical_columns(X_tr.shape[1]),
)
model.fit(X_tr, y_tr)
pred = model.predict(X_te)
results["combined"] = report("3. combined", pred)

print("\n" + classification_report(y_te, pred, labels=CLASSES, zero_division=0))
print("confusion matrix (rows true, cols predicted):", CLASSES)
print(confusion_matrix(y_te, pred, labels=CLASSES))

print("\n--- summary ---")
for name, (acc, f1) in results.items():
    print(f"  {name:>10}   acc {acc:.4f}   macro-F1 {f1:.4f}")
