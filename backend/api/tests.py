import uuid
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
from rest_framework.test import APITestCase
from unittest.mock import patch

from .auth import SupabaseAuthentication, SupabaseUser
from .customer_assistant import AssistantConfigurationError
from .models import (
    CustomerOrder,
    Medicine,
    Profile,
    RegistrationSetting,
    Sale,
)
from .supabase_admin import SupabaseAdminError, create_confirmed_user


def make_user(role):
    return SupabaseUser(
        id=str(uuid.uuid4()), email=f"{role}@test.com", role=role
    )


class PharmacyApiTests(APITestCase):
    def setUp(self):
        today = timezone.localdate()
        self.good = Medicine.objects.create(
            name="Paracetamol", price=Decimal("500.00"), stock=10,
            expiry_date=today + timedelta(days=90),
        )
        self.expired = Medicine.objects.create(
            name="Old Syrup", price=Decimal("1200.00"), stock=5,
            expiry_date=today - timedelta(days=1),
        )
        self.empty = Medicine.objects.create(
            name="Amoxicillin", price=Decimal("800.00"), stock=0,
            expiry_date=today + timedelta(days=90),
        )

    def login(self, role):
        self.client.force_authenticate(user=make_user(role))

    def sell(self, items):
        return self.client.post("/api/sales/", {"items": items}, format="json")

    def request_order(self, customer, items=None):
        self.client.force_authenticate(user=customer)
        return self.client.post(
            "/api/customer/orders/",
            {
                "items": items
                or [{"medicine_id": self.good.id, "qty": 2}],
                "customer_note": "Please call before pickup.",
            },
            format="json",
        )

    # 1. Success: a valid sale returns 201, a receipt, and lowers stock
    def test_sale_success(self):
        self.login("pharmacist")
        response = self.sell([{"medicine_id": self.good.id, "qty": 3}])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["total"], "1500.00")
        self.good.refresh_from_db()
        self.assertEqual(self.good.stock, 7)
        self.assertEqual(Sale.objects.count(), 1)

    # 2. Bad input: zero quantity and an empty cart give 400
    def test_sale_bad_input_returns_400(self):
        self.login("pharmacist")
        zero_qty = self.sell([{"medicine_id": self.good.id, "qty": 0}])
        self.assertEqual(zero_qty.status_code, 400)
        empty_cart = self.sell([])
        self.assertEqual(empty_cart.status_code, 400)
        self.assertEqual(Sale.objects.count(), 0)

    # 3. Business rule: an expired medicine cannot be sold
    def test_cannot_sell_expired_medicine(self):
        self.login("pharmacist")
        response = self.sell([{"medicine_id": self.expired.id, "qty": 1}])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["errors"][0]["error"], "expired")
        self.expired.refresh_from_db()
        self.assertEqual(self.expired.stock, 5)
        self.assertEqual(Sale.objects.count(), 0)

    # 4. Business rule: out-of-stock and over-quantity are refused
    def test_cannot_sell_out_of_stock_or_too_many(self):
        self.login("pharmacist")
        out = self.sell([{"medicine_id": self.empty.id, "qty": 1}])
        self.assertEqual(out.status_code, 400)
        self.assertEqual(out.data["errors"][0]["error"], "out of stock")
        too_many = self.sell([{"medicine_id": self.good.id, "qty": 999}])
        self.assertEqual(too_many.status_code, 400)
        self.good.refresh_from_db()
        self.assertEqual(self.good.stock, 10)

    # 5. Missing record: unknown medicine gives 404
    def test_missing_medicine_returns_404(self):
        self.login("pharmacist")
        sale = self.sell([{"medicine_id": 999999, "qty": 1}])
        self.assertEqual(sale.status_code, 404)
        detail = self.client.get("/api/medicines/999999/")
        self.assertEqual(detail.status_code, 404)

    # 6. No login: 401
    def test_no_token_returns_401(self):
        response = self.client.get("/api/medicines/")
        self.assertEqual(response.status_code, 401)
        sale = self.sell([{"medicine_id": self.good.id, "qty": 1}])
        self.assertEqual(sale.status_code, 401)

    # 7. Wrong role: a pharmacist cannot create medicines or see analytics
    def test_pharmacist_cannot_manage_stock_or_analytics(self):
        self.login("pharmacist")
        create = self.client.post(
            "/api/medicines/",
            {"name": "New", "price": "100.00", "stock": 5,
             "expiry_date": "2030-01-01"},
            format="json",
        )
        self.assertEqual(create.status_code, 403)
        self.assertEqual(self.client.get("/api/analytics/").status_code, 403)
        self.assertEqual(self.client.delete(
            f"/api/medicines/{self.good.id}/").status_code, 403)

    # 8. A signed-in user with no role row is refused
    def test_user_without_role_is_forbidden(self):
        self.login(None)
        self.assertEqual(self.client.get("/api/medicines/").status_code, 403)

    # 9. Manager: can create a medicine; bad input gives 400
    def test_manager_can_create_medicine(self):
        self.login("manager")
        ok = self.client.post(
            "/api/medicines/",
            {"name": "Ibuprofen", "price": "300.00", "stock": 20,
             "expiry_date": "2030-01-01"},
            format="json",
        )
        self.assertEqual(ok.status_code, 201)
        bad = self.client.post(
            "/api/medicines/",
            {"name": "Bad", "price": "-5", "stock": -1,
             "expiry_date": "2030-01-01"},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)

    # 10. Manager: analytics shows the sale after it happens
    def test_manager_analytics_after_sale(self):
        self.login("pharmacist")
        self.sell([{"medicine_id": self.good.id, "qty": 2}])
        self.login("manager")
        response = self.client.get("/api/analytics/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["best_sellers"][0]["name"], "Paracetamol")
        self.assertEqual(response.data["best_sellers"][0]["qty_sold"], 2)
        bad = self.client.get("/api/analytics/?days=abc")
        self.assertEqual(bad.status_code, 400)

    def test_manager_sets_registration_code_as_a_hash(self):
        self.login("manager")
        too_short = self.client.put(
            "/api/registration/code/",
            {"code": "too-short"},
            format="json",
        )
        self.assertEqual(too_short.status_code, 400)

        response = self.client.put(
            "/api/registration/code/",
            {"code": "staff-registration-code"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        setting = RegistrationSetting.objects.get(pk=1)
        self.assertTrue(check_password("staff-registration-code", setting.code_hash))
        self.assertNotEqual(setting.code_hash, "staff-registration-code")

    def test_pharmacist_cannot_change_registration_code(self):
        self.login("pharmacist")
        response = self.client.put(
            "/api/registration/code/",
            {"code": "staff-registration-code"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_code_authorizes_registration_and_adds_pharmacist_to_roster(self):
        RegistrationSetting.objects.create(
            id=1,
            code_hash=make_password("staff-registration-code"),
        )
        valid = self.client.post(
            "/api/registration/validate/",
            {"code": "staff-registration-code"},
            format="json",
        )
        invalid = self.client.post(
            "/api/registration/validate/",
            {"code": "incorrect-code"},
            format="json",
        )
        self.assertEqual(valid.status_code, 200)
        self.assertEqual(invalid.status_code, 400)

        user = make_user(None)
        self.client.force_authenticate(user=user)
        activated = self.client.post(
            "/api/registration/activate/",
            {"code": "staff-registration-code", "full_name": "Aline Pharmacist"},
            format="json",
        )
        self.assertEqual(activated.status_code, 201)
        self.assertEqual(activated.data["role"], "pharmacist")
        profile = Profile.objects.get(id=user.id)
        self.assertEqual(profile.email, user.email)
        self.assertEqual(profile.full_name, "Aline Pharmacist")
        duplicate = self.client.post(
            "/api/registration/activate/",
            {"code": "staff-registration-code", "full_name": "Aline Pharmacist"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 409)

        self.login("manager")
        roster = self.client.get("/api/staff/pharmacists/")
        self.assertEqual(roster.status_code, 200)
        self.assertEqual(roster.data[0]["email"], user.email)
        self.assertEqual(roster.data[0]["full_name"], "Aline Pharmacist")
        self.assertTrue(roster.data[0]["is_active"])

    def test_manager_can_deactivate_and_reactivate_pharmacist(self):
        pharmacist_id = uuid.uuid4()
        profile = Profile.objects.create(
            id=pharmacist_id,
            role="pharmacist",
            email="staff@example.com",
            full_name="Staff Member",
        )
        self.login("manager")

        deactivated = self.client.patch(
            f"/api/staff/pharmacists/{pharmacist_id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(deactivated.status_code, 200)
        self.assertFalse(deactivated.data["is_active"])
        profile.refresh_from_db()
        self.assertFalse(profile.is_active)

        roster = self.client.get("/api/staff/pharmacists/")
        self.assertEqual(roster.status_code, 200)
        self.assertEqual(len(roster.data), 1)
        self.assertFalse(roster.data[0]["is_active"])

        reactivated = self.client.patch(
            f"/api/staff/pharmacists/{pharmacist_id}/",
            {"is_active": True},
            format="json",
        )
        self.assertEqual(reactivated.status_code, 200)
        profile.refresh_from_db()
        self.assertTrue(profile.is_active)

    def test_pharmacist_cannot_manage_staff_access(self):
        pharmacist_id = uuid.uuid4()
        Profile.objects.create(
            id=pharmacist_id,
            role="pharmacist",
            email="staff@example.com",
        )
        self.login("pharmacist")
        response = self.client.patch(
            f"/api/staff/pharmacists/{pharmacist_id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get("/api/staff/pharmacists/").status_code, 403)

    def test_inactive_staff_account_cannot_use_staff_endpoints(self):
        user = SupabaseUser(
            id=str(uuid.uuid4()),
            email="inactive@example.com",
            role=None,
            is_active=False,
        )
        self.client.force_authenticate(user=user)

        me = self.client.get("/api/me/")
        self.assertEqual(me.status_code, 200)
        self.assertFalse(me.data["is_active"])
        sale = self.sell([{"medicine_id": self.good.id, "qty": 1}])
        self.assertEqual(sale.status_code, 403)

    def test_staff_can_view_and_update_own_profile(self):
        user = make_user("pharmacist")
        Profile.objects.create(
            id=user.id,
            role="pharmacist",
            email=user.email,
            full_name="Original Name",
        )
        self.client.force_authenticate(user=user)

        profile = self.client.get("/api/profile/")
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data["email"], user.email)
        self.assertEqual(profile.data["role"], "pharmacist")
        self.assertEqual(profile.data["phone"], "")
        self.assertTrue(profile.data["is_active"])

        updated = self.client.patch(
            "/api/profile/",
            {"full_name": "Updated Name", "phone": "+250 790 222 835"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["full_name"], "Updated Name")
        self.assertEqual(updated.data["phone"], "+250 790 222 835")
        stored_profile = Profile.objects.get(id=user.id)
        self.assertEqual(stored_profile.full_name, "Updated Name")
        self.assertEqual(stored_profile.phone, "+250 790 222 835")
        self.assertEqual(stored_profile.role, "pharmacist")

    def test_profile_role_and_email_are_not_editable_through_api(self):
        user = make_user("manager")
        profile = Profile.objects.create(
            id=user.id,
            role="manager",
            email=user.email,
            full_name="Manager",
        )
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            "/api/profile/",
            {"role": "pharmacist", "email": "other@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        profile.refresh_from_db()
        self.assertEqual(profile.role, "manager")
        self.assertEqual(profile.email, user.email)

    def test_profile_requires_staff_authentication(self):
        response = self.client.get("/api/profile/")
        self.assertEqual(response.status_code, 401)

    def test_staff_access_rejects_invalid_status_and_non_pharmacist(self):
        pharmacist_id = uuid.uuid4()
        Profile.objects.create(
            id=pharmacist_id,
            role="pharmacist",
            email="staff@example.com",
        )
        self.login("manager")

        invalid = self.client.patch(
            f"/api/staff/pharmacists/{pharmacist_id}/",
            {"is_active": "false"},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)

        missing = self.client.patch(
            f"/api/staff/pharmacists/{uuid.uuid4()}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(missing.status_code, 404)

    def test_pharmacist_registration_requires_authentication_and_valid_code(self):
        anonymous = self.client.post(
            "/api/registration/activate/",
            {"code": "staff-registration-code", "full_name": "Test Pharmacist"},
            format="json",
        )
        self.assertEqual(anonymous.status_code, 401)

        RegistrationSetting.objects.create(
            id=1,
            code_hash=make_password("staff-registration-code"),
        )
        self.login(None)
        invalid = self.client.post(
            "/api/registration/activate/",
            {"code": "incorrect-code", "full_name": "Test Pharmacist"},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertFalse(Profile.objects.exists())

    @patch("api.views.create_confirmed_user", return_value=str(uuid.uuid4()))
    def test_registration_creates_confirmed_pharmacist_without_email_step(
        self, create_user
    ):
        RegistrationSetting.objects.create(
            id=1,
            code_hash=make_password("staff-registration-code"),
        )
        response = self.client.post(
            "/api/registration/register/",
            {
                "email": "new.pharmacist@example.com",
                "password": "pharmacy-password",
                "full_name": "New Pharmacist",
                "code": "staff-registration-code",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["role"], "pharmacist")
        self.assertEqual(
            response.data["email"], "new.pharmacist@example.com"
        )
        create_user.assert_called_once_with(
            "new.pharmacist@example.com",
            "pharmacy-password",
            "New Pharmacist",
        )
        self.assertTrue(
            Profile.objects.filter(
                email="new.pharmacist@example.com", role="pharmacist"
            ).exists()
        )

    @patch("api.views.create_confirmed_user")
    def test_registration_rejects_wrong_code_without_creating_auth_user(
        self, create_user
    ):
        RegistrationSetting.objects.create(
            id=1,
            code_hash=make_password("staff-registration-code"),
        )
        response = self.client.post(
            "/api/registration/register/",
            {
                "email": "new.pharmacist@example.com",
                "password": "pharmacy-password",
                "full_name": "New Pharmacist",
                "code": "incorrect-code",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        create_user.assert_not_called()

    @patch("api.supabase_admin._admin_request")
    def test_existing_unconfirmed_auth_user_is_confirmed(self, admin_request):
        admin_request.side_effect = [
            SupabaseAdminError(422),
            {
                "users": [
                    {
                        "id": "pending-user-id",
                        "email": "new.pharmacist@example.com",
                        "email_confirmed_at": None,
                    }
                ]
            },
            {"id": "pending-user-id"},
        ]

        user_id = create_confirmed_user(
            "new.pharmacist@example.com",
            "pharmacy-password",
            "New Pharmacist",
        )

        self.assertEqual(user_id, "pending-user-id")
        update_call = admin_request.call_args_list[2]
        self.assertEqual(update_call.args[0], "PUT")
        self.assertEqual(update_call.args[1], "users/pending-user-id")
        self.assertTrue(update_call.args[2]["email_confirm"])
        self.assertEqual(
            update_call.args[2]["password"], "pharmacy-password"
        )

    @patch("api.supabase_admin._admin_request")
    def test_existing_confirmed_auth_user_is_not_taken_over(self, admin_request):
        admin_request.side_effect = [
            SupabaseAdminError(422),
            {
                "users": [
                    {
                        "id": "existing-user-id",
                        "email": "new.pharmacist@example.com",
                        "email_confirmed_at": "2026-01-01T00:00:00Z",
                    }
                ]
            },
        ]

        with self.assertRaises(SupabaseAdminError) as error:
            create_confirmed_user(
                "new.pharmacist@example.com",
                "pharmacy-password",
                "New Pharmacist",
            )

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(admin_request.call_count, 2)

    @patch("api.supabase_admin._admin_request", return_value={"id": "new-user-id"})
    def test_new_supabase_user_is_created_with_email_already_confirmed(
        self, admin_request
    ):
        user_id = create_confirmed_user(
            "new.pharmacist@example.com",
            "pharmacy-password",
            "New Pharmacist",
        )

        self.assertEqual(user_id, "new-user-id")
        payload = admin_request.call_args.args[2]
        self.assertTrue(payload["email_confirm"])
        self.assertEqual(payload["email"], "new.pharmacist@example.com")

    def test_customer_order_is_not_a_sale_until_pickup(self):
        customer = make_user("customer")
        Profile.objects.create(
            id=customer.id,
            role="customer",
            email=customer.email,
            full_name="Customer Name",
            phone="+250700000000",
        )
        response = self.request_order(customer)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "submitted")
        self.assertEqual(response.data["total"], "1000.00")
        self.assertEqual(Sale.objects.count(), 0)
        self.good.refresh_from_db()
        self.assertEqual(self.good.stock, 10)

        self.client.force_authenticate(user=make_user("pharmacist"))
        queue = self.client.get("/api/staff/orders/")
        self.assertEqual(queue.status_code, 200)
        self.assertEqual(queue.data[0]["customer_email"], customer.email)

        order_id = response.data["id"]
        approval_without_review = self.client.patch(
            f"/api/staff/orders/{order_id}/",
            {"action": "approve"},
            format="json",
        )
        self.assertEqual(approval_without_review.status_code, 400)
        self.assertEqual(Sale.objects.count(), 0)

        approved = self.client.patch(
            f"/api/staff/orders/{order_id}/",
            {"action": "approve", "prescription_checked": True},
            format="json",
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.data["status"], "ready_for_pickup")
        self.good.refresh_from_db()
        self.assertEqual(self.good.stock, 8)
        self.assertEqual(Sale.objects.count(), 0)

        completed = self.client.patch(
            f"/api/staff/orders/{order_id}/",
            {"action": "complete"},
            format="json",
        )
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(completed.data["status"], "completed")
        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(Sale.objects.first().qty, 2)

    def test_customer_cannot_access_staff_orders_or_another_customers_order(self):
        customer = make_user("customer")
        other_customer = make_user("customer")
        response = self.request_order(customer)
        self.assertEqual(response.status_code, 201)

        self.client.force_authenticate(user=other_customer)
        own_orders = self.client.get("/api/customer/orders/")
        self.assertEqual(own_orders.status_code, 200)
        self.assertEqual(own_orders.data, [])
        self.assertEqual(self.client.get("/api/staff/orders/").status_code, 403)
        missing = self.client.post(
            f"/api/customer/orders/{response.data['id']}/cancel/",
            format="json",
        )
        self.assertEqual(missing.status_code, 404)

    def test_customer_order_rejects_unavailable_or_duplicate_medicines(self):
        customer = make_user("customer")
        unavailable = self.request_order(
            customer, [{"medicine_id": self.empty.id, "qty": 1}]
        )
        self.assertEqual(unavailable.status_code, 409)

        duplicate = self.client.post(
            "/api/customer/orders/",
            {
                "items": [
                    {"medicine_id": self.good.id, "qty": 1},
                    {"medicine_id": self.good.id, "qty": 1},
                ]
            },
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(CustomerOrder.objects.count(), 0)

    def test_cancelling_approved_order_releases_stock_without_sale(self):
        customer = make_user("customer")
        requested = self.request_order(customer)
        self.assertEqual(requested.status_code, 201)
        order_id = requested.data["id"]

        self.client.force_authenticate(user=make_user("pharmacist"))
        approved = self.client.patch(
            f"/api/staff/orders/{order_id}/",
            {"action": "approve", "prescription_checked": True},
            format="json",
        )
        self.assertEqual(approved.status_code, 200)
        self.good.refresh_from_db()
        self.assertEqual(self.good.stock, 8)

        self.client.force_authenticate(user=customer)
        cancelled = self.client.post(
            f"/api/customer/orders/{order_id}/cancel/",
            format="json",
        )
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(cancelled.data["status"], "cancelled")
        self.good.refresh_from_db()
        self.assertEqual(self.good.stock, 10)
        self.assertEqual(Sale.objects.count(), 0)

    @patch("api.auth._jwks.get_signing_key_from_jwt")
    @patch("api.auth.jwt.decode")
    def test_auth_provisions_customer_but_never_self_assigns_staff_role(
        self, decode, get_signing_key
    ):
        user_id = str(uuid.uuid4())
        get_signing_key.return_value = SimpleNamespace(key="verified-key")
        decode.return_value = {
            "sub": user_id,
            "email": "new.customer@example.com",
            "user_metadata": {
                "account_type": "customer",
                "full_name": "New Customer",
                "phone": "+250700000000",
            },
        }
        request = SimpleNamespace(
            headers={"Authorization": "Bearer verified-token"}
        )

        user, token = SupabaseAuthentication().authenticate(request)

        profile = Profile.objects.get(id=user_id)
        self.assertEqual(token, "verified-token")
        self.assertEqual(user.role, "customer")
        self.assertEqual(profile.email, "new.customer@example.com")
        self.assertEqual(profile.full_name, "New Customer")
        self.assertEqual(profile.phone, "+250700000000")

        privileged_id = str(uuid.uuid4())
        decode.return_value = {
            "sub": privileged_id,
            "email": "untrusted@example.com",
            "user_metadata": {"account_type": "manager"},
        }
        request.headers = {"Authorization": "Bearer another-token"}
        untrusted_user, _ = SupabaseAuthentication().authenticate(request)

        self.assertIsNone(untrusted_user.role)
        self.assertFalse(Profile.objects.filter(id=privileged_id).exists())


class CustomerAssistantTests(APITestCase):
    @patch(
        "api.views.generate_gemini_answer",
        return_value="Pharmacy Desk helps customers.",
    )
    def test_assistant_answers_basic_product_information(self, generate_answer):
        response = self.client.post(
            "/api/customer/assistant/",
            {"message": "What is Pharmacy Desk?", "language": "en"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        generate_answer.assert_called_once_with("about_pharmacy_desk", "en")

    @patch("api.views.generate_gemini_answer", return_value="Open My orders.")
    def test_public_assistant_sends_only_a_topic_to_gemini(self, generate_answer):
        response = self.client.post(
            "/api/customer/assistant/",
            {
                "message": "How can I track my order? My email is private@example.com.",
                "language": "en",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["reply"], "Open My orders.")
        generate_answer.assert_called_once_with("track_customer_order", "en")

    @patch("api.views.generate_gemini_answer")
    def test_health_questions_are_redirected_without_calling_gemini(
        self, generate_answer
    ):
        response = self.client.post(
            "/api/customer/assistant/",
            {
                "message": "What medicine should I take for a fever?",
                "language": "en",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("pharmacist", response.data["reply"])
        generate_answer.assert_not_called()

    @patch("api.views.generate_gemini_answer", return_value="Open My profile.")
    def test_customer_can_use_assistant(self, generate_answer):
        self.client.force_authenticate(user=make_user("customer"))
        response = self.client.post(
            "/api/customer/assistant/",
            {"message": "How do I update my profile?", "language": "en"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        generate_answer.assert_called_once_with("update_profile", "en")

    def test_staff_cannot_use_customer_assistant(self):
        self.client.force_authenticate(user=make_user("pharmacist"))
        response = self.client.post(
            "/api/customer/assistant/",
            {"message": "How do I track my order?", "language": "en"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_assistant_rejects_oversized_messages_and_unknown_languages(self):
        oversized = self.client.post(
            "/api/customer/assistant/",
            {"message": "x" * 501, "language": "en"},
            format="json",
        )
        unknown_language = self.client.post(
            "/api/customer/assistant/",
            {"message": "How do I track my order?", "language": "de"},
            format="json",
        )

        self.assertEqual(oversized.status_code, 400)
        self.assertEqual(unknown_language.status_code, 400)

    @patch(
        "api.views.generate_gemini_answer",
        side_effect=AssistantConfigurationError,
    )
    def test_missing_gemini_configuration_is_reported(self, generate_answer):
        response = self.client.post(
            "/api/customer/assistant/",
            {"message": "How can I track an order?", "language": "en"},
            format="json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertIn("not configured", response.data["detail"])
        generate_answer.assert_called_once_with("track_customer_order", "en")
