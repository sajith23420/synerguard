"""
Shared data loading and feature construction for the severity experiments.

All three experiment scripts import from here so that they are provably running
the same pipeline — a baseline is only meaningful if the thing it is compared
against was built identically.

The one rule that governs this file: a row must never be able to see its own
label. Drug severity profiles are therefore always passed the label set they are
allowed to learn from, and training rows have their own contribution subtracted
back out (leave-one-out).
"""

import json
import re
import collections
import numpy as np

DATA = r"../server/src/data/interactions.json"
CLASSES = ["Major", "Moderate", "Minor"]
SEED = 42


def load(path=None):
    """Read the newline-delimited interaction file. Returns (all, labelled, unlabelled)."""
    import os
    path = path or os.path.join(os.path.dirname(__file__), DATA)
    records = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    labelled = [r for r in records if r["severity"] in CLASSES]
    unlabelled = [r for r in records if r["severity"] == "Unknown"]
    return records, labelled, unlabelled


def template_of(rec):
    """
    Masked description. The source descriptions are templated — 187 distinct
    forms cover the whole corpus — so stripping the two drug names turns free
    text into a categorical 'mechanism type' feature. Calling this NLP would
    overstate it; it is a lookup with extra steps, and it is reported as such.
    """
    desc = rec.get("description")
    if not desc:
        return "<none>"
    desc = re.sub(re.escape(rec["drugA"]), "<A>", desc, flags=re.I)
    desc = re.sub(re.escape(rec["drugB"]), "<B>", desc, flags=re.I)
    return desc


def build_adjacency(records):
    """
    Neighbour sets over the interaction graph. This encodes only *whether* two
    drugs interact, never how severely, so building it over every record —
    including test rows — leaks nothing about the label being predicted.
    """
    adjacency = collections.defaultdict(set)
    for rec in records:
        adjacency[rec["drugALower"]].add(rec["drugBLower"])
        adjacency[rec["drugBLower"]].add(rec["drugALower"])
    return adjacency


class FeatureBuilder:
    """
    Fitted on a training split, then applied to any rows.

    `fit` sees training labels; `transform` never does, except to perform the
    leave-one-out subtraction for rows that were part of the fit.
    """

    def __init__(self, adjacency):
        self.adjacency = adjacency

    def fit(self, rows, labels):
        self.profile = collections.defaultdict(lambda: np.zeros(len(CLASSES)))
        for rec, label in zip(rows, labels):
            k = CLASSES.index(label)
            self.profile[rec["drugALower"]][k] += 1
            self.profile[rec["drugBLower"]][k] += 1

        self.prior = np.array([np.sum(np.asarray(labels) == c) for c in CLASSES], float)
        self.prior /= self.prior.sum()

        vocab = sorted({template_of(r) for r in rows})
        self.template_id = {t: i for i, t in enumerate(vocab)}
        return self

    def _drug_vector(self, name, own_label_idx):
        counts = self.profile.get(name)
        counts = np.zeros(len(CLASSES)) if counts is None else counts.copy()
        if own_label_idx is not None:
            counts[own_label_idx] -= 1
        total = counts.sum()
        if total <= 0:
            # No labelled history: fall back to the class prior and flag it with
            # a zero count, which is what makes cold drugs identifiable to the model.
            return np.concatenate([self.prior, [0.0]])
        return np.concatenate([counts / total, [total]])

    def transform(self, rows, labels=None):
        """Pass `labels` only for rows that were in `fit`, to leave them out."""
        out = []
        for i, rec in enumerate(rows):
            own = CLASSES.index(labels[i]) if labels is not None else None
            va = self._drug_vector(rec["drugALower"], own)
            vb = self._drug_vector(rec["drugBLower"], own)
            fa, fb, na, nb = va[:3], vb[:3], va[3], vb[3]

            # Which drug is 'A' is an artefact of alphabetical sorting, so every
            # feature below is symmetric in the two drugs.
            nbr_a = self.adjacency[rec["drugALower"]]
            nbr_b = self.adjacency[rec["drugBLower"]]
            shared = len(nbr_a & nbr_b)
            union = len(nbr_a | nbr_b) or 1

            out.append(np.concatenate([
                np.minimum(fa, fb),
                np.maximum(fa, fb),
                (fa + fb) / 2,
                [min(na, nb), max(na, nb)],
                [min(len(nbr_a), len(nbr_b)), max(len(nbr_a), len(nbr_b))],
                [shared, shared / union],
                [self.template_id.get(template_of(rec), -1)],
            ]))
        return np.asarray(out, dtype=np.float32)

    @staticmethod
    def categorical_columns(n_features):
        """Index of the mechanism-template column, which is categorical not ordinal."""
        return [n_features - 1]
