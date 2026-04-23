"""Unit tests for Attio attribute mapping + push orchestration (no network, no env)."""

from __future__ import annotations

import os
import unittest
from unittest import mock

from backend.services.attio import push
from backend.services.attio.mappings import (
    extract_record_id,
    nivo_company_to_attio_values,
    nivo_contact_to_attio_values,
)


class CompanyMappingTest(unittest.TestCase):
    def test_minimal_with_explicit_domain(self):
        values = nivo_company_to_attio_values({"name": "Acme AB", "domain": "acme.se"})
        self.assertEqual(values["name"], "Acme AB")
        self.assertEqual(values["domains"], [{"domain": "acme.se"}])

    def test_extracts_domain_from_full_url(self):
        values = nivo_company_to_attio_values(
            {"name": "Acme", "website": "https://www.acme.com/about"}
        )
        self.assertEqual(values["domains"], [{"domain": "acme.com"}])

    def test_extracts_domain_from_bare_host(self):
        values = nivo_company_to_attio_values(
            {"name": "Acme", "website": "acme.com"}
        )
        self.assertEqual(values["domains"], [{"domain": "acme.com"}])

    def test_includes_description_when_present(self):
        values = nivo_company_to_attio_values(
            {"name": "Acme", "domain": "acme.com", "description": "Widgets."}
        )
        self.assertEqual(values["description"], "Widgets.")

    def test_omits_description_when_blank(self):
        values = nivo_company_to_attio_values(
            {"name": "Acme", "domain": "acme.com", "description": ""}
        )
        self.assertNotIn("description", values)

    def test_rejects_when_no_name_and_no_domain(self):
        with self.assertRaises(ValueError):
            nivo_company_to_attio_values({"name": "", "website": ""})

    def test_handles_missing_website_gracefully(self):
        values = nivo_company_to_attio_values({"name": "Acme", "website": None})
        self.assertEqual(values, {"name": "Acme"})


class ContactMappingTest(unittest.TestCase):
    def test_requires_email(self):
        with self.assertRaises(ValueError):
            nivo_contact_to_attio_values({"first_name": "Jane"})

    def test_lowercases_email(self):
        values = nivo_contact_to_attio_values({"email": "Jane@Acme.com"})
        self.assertEqual(values["email_addresses"], [{"email_address": "jane@acme.com"}])

    def test_uses_structured_name_when_available(self):
        values = nivo_contact_to_attio_values(
            {"email": "jane@acme.com", "first_name": "Jane", "last_name": "Doe"}
        )
        self.assertEqual(values["name"], [{"first_name": "Jane", "last_name": "Doe"}])

    def test_splits_full_name_when_no_structured_name(self):
        values = nivo_contact_to_attio_values(
            {"email": "jane@acme.com", "full_name": "Jane Doe"}
        )
        self.assertEqual(values["name"], [{"first_name": "Jane", "last_name": "Doe"}])

    def test_single_token_full_name_goes_to_first_name(self):
        values = nivo_contact_to_attio_values(
            {"email": "jane@acme.com", "full_name": "Jane"}
        )
        self.assertEqual(values["name"], [{"first_name": "Jane", "last_name": None}])

    def test_links_company_when_id_supplied(self):
        values = nivo_contact_to_attio_values(
            {"email": "jane@acme.com"}, company_attio_record_id="rec_123"
        )
        self.assertEqual(
            values["company"],
            [{"target_object": "companies", "target_record_id": "rec_123"}],
        )

    def test_includes_optional_fields(self):
        values = nivo_contact_to_attio_values(
            {
                "email": "jane@acme.com",
                "title": "CEO",
                "phone": "+46 70 000 0000",
                "linkedin_url": "https://linkedin.com/in/jane",
            }
        )
        self.assertEqual(values["job_title"], "CEO")
        self.assertEqual(
            values["phone_numbers"], [{"original_phone_number": "+46 70 000 0000"}]
        )
        self.assertEqual(values["linkedin"], "https://linkedin.com/in/jane")


class ExtractRecordIdTest(unittest.TestCase):
    def test_extracts_when_present(self):
        response = {"data": {"id": {"record_id": "rec_abc"}}}
        self.assertEqual(extract_record_id(response), "rec_abc")

    def test_returns_none_for_unexpected_shape(self):
        self.assertIsNone(extract_record_id({}))
        self.assertIsNone(extract_record_id({"data": {}}))
        self.assertIsNone(extract_record_id({"data": {"id": {}}}))


class _FakeClient:
    """Test double matching the surface of AttioClient that push.py uses."""

    def __init__(self, *, company_id="rec_co", person_ids=None, raises_on=None):
        self.company_id = company_id
        self.person_ids = person_ids or {}  # email → record_id
        self.raises_on = set(raises_on or [])
        self.calls: list[tuple] = []

    def _maybe_raise(self, op: str) -> None:
        if op in self.raises_on:
            from backend.services.attio.client import AttioError

            raise AttioError(f"simulated failure: {op}")

    def assert_company(self, *, values, matching_attribute="domains"):
        self.calls.append(("assert_company", values))
        self._maybe_raise("assert_company")
        return {"data": {"id": {"record_id": self.company_id}}}

    def assert_person(self, *, values, matching_attribute="email_addresses"):
        email = values["email_addresses"][0]["email_address"]
        self.calls.append(("assert_person", email))
        self._maybe_raise(f"assert_person:{email}")
        rec_id = self.person_ids.get(email, f"rec_p_{email}")
        return {"data": {"id": {"record_id": rec_id}}}

    def create_note(self, *, parent_object, parent_record_id, title, content_markdown):
        self.calls.append(("create_note", parent_record_id, title))
        self._maybe_raise("create_note")
        return {"data": {"id": {"record_id": "rec_note"}}}

    def close(self):
        pass


class SendCompanyToAttioTest(unittest.TestCase):
    def setUp(self):
        self._env = mock.patch.dict(os.environ, {"ATTIO_SYNC_ENABLED": "true"})
        self._env.start()

    def tearDown(self):
        self._env.stop()

    def test_skipped_when_flag_off(self):
        with mock.patch.dict(os.environ, {"ATTIO_SYNC_ENABLED": "false"}):
            result = push.send_company_to_attio(
                company={"name": "Acme", "domain": "acme.com"},
                client=_FakeClient(),
            )
        self.assertTrue(result.skipped)
        self.assertFalse(result.ok)
        self.assertIsNone(result.company_record_id)

    def test_happy_path_pushes_company_contacts_and_research_note(self):
        client = _FakeClient(company_id="rec_acme")
        result = push.send_company_to_attio(
            company={"name": "Acme", "domain": "acme.com"},
            contacts=[
                {"email": "jane@acme.com", "first_name": "Jane", "last_name": "Doe"},
                {"email": "BOB@acme.com", "first_name": "Bob"},
            ],
            research_summary_markdown="# Notes",
            client=client,
        )
        self.assertTrue(result.ok)
        self.assertEqual(result.company_record_id, "rec_acme")
        self.assertEqual(set(result.contact_record_ids.keys()), {"jane@acme.com", "bob@acme.com"})
        self.assertEqual(len(result.note_record_ids), 1)
        self.assertEqual(result.errors, [])

        ops = [c[0] for c in client.calls]
        self.assertEqual(ops, ["assert_company", "assert_person", "assert_person", "create_note"])

    def test_company_failure_short_circuits(self):
        client = _FakeClient(raises_on={"assert_company"})
        result = push.send_company_to_attio(
            company={"name": "Acme", "domain": "acme.com"},
            contacts=[{"email": "jane@acme.com"}],
            research_summary_markdown="# Notes",
            client=client,
        )
        self.assertFalse(result.ok)
        self.assertIsNone(result.company_record_id)
        self.assertEqual(len(result.errors), 1)
        self.assertEqual([c[0] for c in client.calls], ["assert_company"])

    def test_contact_failure_does_not_abort_other_contacts_or_note(self):
        client = _FakeClient(raises_on={"assert_person:jane@acme.com"})
        result = push.send_company_to_attio(
            company={"name": "Acme", "domain": "acme.com"},
            contacts=[
                {"email": "jane@acme.com"},
                {"email": "bob@acme.com"},
            ],
            research_summary_markdown="# Notes",
            client=client,
        )
        self.assertEqual(result.company_record_id, "rec_co")
        self.assertEqual(set(result.contact_record_ids.keys()), {"bob@acme.com"})
        self.assertEqual(len(result.note_record_ids), 1)
        self.assertEqual(len(result.errors), 1)
        self.assertIn("jane@acme.com", result.errors[0])

    def test_skips_contact_with_blank_email(self):
        client = _FakeClient()
        result = push.send_company_to_attio(
            company={"name": "Acme", "domain": "acme.com"},
            contacts=[{"email": ""}, {"email": "ok@acme.com"}],
            client=client,
        )
        self.assertEqual(set(result.contact_record_ids.keys()), {"ok@acme.com"})
        self.assertEqual(len(result.errors), 1)

    def test_omits_notes_when_no_summary_provided(self):
        client = _FakeClient()
        result = push.send_company_to_attio(
            company={"name": "Acme", "domain": "acme.com"},
            client=client,
        )
        self.assertTrue(result.ok)
        self.assertEqual(result.note_record_ids, [])
        self.assertNotIn("create_note", [c[0] for c in client.calls])


if __name__ == "__main__":
    unittest.main()
