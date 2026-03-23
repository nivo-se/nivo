"""Tests for screening campaign relevance policies."""

from __future__ import annotations

from backend.services.screening_orchestrator.policies import (
    layer1_web_retrieval_enabled,
    relevance_eligible_for_fit,
    relevance_eligible_for_shortlist,
    uncertain_relevance_mode,
)


def test_uncertain_default_passes_to_layer2():
    assert uncertain_relevance_mode({}) == "pass_to_layer2"
    assert uncertain_relevance_mode({"policy": {"uncertainRelevance": "reject"}}) == "reject"
    assert uncertain_relevance_mode({"policy": {"uncertain_relevance": "pass_to_layer2"}}) == "pass_to_layer2"


def test_layer1_web_retrieval():
    assert layer1_web_retrieval_enabled({}) is False
    assert layer1_web_retrieval_enabled({"policy": {"layer1WebRetrieval": True}}) is True


def test_fit_eligibility():
    p_reject = {"policy": {"uncertainRelevance": "reject"}}
    p_pass = {"policy": {"uncertainRelevance": "pass_to_layer2"}}
    assert relevance_eligible_for_fit("in_mandate", p_reject) is True
    assert relevance_eligible_for_fit("out_of_mandate", p_reject) is False
    assert relevance_eligible_for_fit("uncertain", p_reject) is False
    assert relevance_eligible_for_fit("uncertain", p_pass) is True


def test_shortlist_eligibility():
    p_reject = {"policy": {"uncertainRelevance": "reject"}}
    p_pass = {"policy": {"uncertainRelevance": "pass_to_layer2"}}
    assert relevance_eligible_for_shortlist("out_of_mandate", p_pass) is False
    assert relevance_eligible_for_shortlist("in_mandate", p_pass) is True
    assert relevance_eligible_for_shortlist("uncertain", p_reject) is False
    assert relevance_eligible_for_shortlist("uncertain", p_pass) is True
