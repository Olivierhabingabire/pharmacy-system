import logging
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.hashers import check_password, make_password
from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .customer_assistant import (
    AssistantConfigurationError,
    AssistantProviderError,
    classify_customer_question,
    generate_gemini_answer,
    health_reply,
    is_health_question,
    out_of_scope_reply,
)
from .models import (
    CustomerOrder,
    CustomerOrderItem,
    Medicine,
    Profile,
    RegistrationSetting,
    Sale,
)
from .permissions import (
    CustomerAssistantAccess,
    IsAccountUser,
    IsCustomer,
    IsManager,
    IsStaff,
    ManagerCanWrite,
)
from .serializers import (
    ActivatePharmacistSerializer,
    CustomerOrderCreateSerializer,
    MedicineSerializer,
    ProfileUpdateSerializer,
    RegistrationCodeSerializer,
    RegisterPharmacistSerializer,
    SaleRequestSerializer,
    SetRegistrationCodeSerializer,
)
from .supabase_admin import (
    SupabaseAdminConfigurationError,
    SupabaseAdminError,
    SupabaseAdminUnavailable,
    create_confirmed_user,
    delete_user,
)
from .throttles import RegistrationIPThrottle

logger = logging.getLogger(__name__)


class MedicineList(ListCreateAPIView):
    permission_classes = [ManagerCanWrite]
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer


class MedicineDetail(RetrieveUpdateDestroyAPIView):
    permission_classes = [ManagerCanWrite]
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer

    def destroy(self, request, *args, **kwargs):
        medicine = self.get_object()
        try:
            medicine.delete()
        except IntegrityError:
            return Response(
                {"detail": "This medicine has sales and cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class SaleCreate(APIView):
    permission_classes = [IsStaff]

    def post(self, request):
        serializer = SaleRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data["items"]

        seller_id = request.user.id  # the verified Supabase user
        today = timezone.localdate()
        wanted = {item["medicine_id"]: item["qty"] for item in items}

        with transaction.atomic():
            medicines = {
                m.id: m
                for m in Medicine.objects.select_for_update().filter(id__in=wanted)
            }

            missing = sorted(set(wanted) - set(medicines))
            if missing:
                return Response(
                    {"detail": f"Medicine not found: {missing}"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            errors = []
            for medicine_id, qty in wanted.items():
                medicine = medicines[medicine_id]
                if medicine.expiry_date < today:
                    errors.append(
                        {"medicine_id": medicine_id, "name": medicine.name,
                         "error": "expired"}
                    )
                elif medicine.stock == 0:
                    errors.append(
                        {"medicine_id": medicine_id, "name": medicine.name,
                         "error": "out of stock"}
                    )
                elif medicine.stock < qty:
                    errors.append(
                        {"medicine_id": medicine_id, "name": medicine.name,
                         "error": f"only {medicine.stock} in stock"}
                    )
            if errors:
                return Response(
                    {"detail": "Sale refused.", "errors": errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            receipt_id = uuid.uuid4()
            sold_at = timezone.now()
            lines = []
            total = Decimal("0")
            for medicine_id, qty in wanted.items():
                medicine = medicines[medicine_id]
                Sale.objects.create(
                    receipt_id=receipt_id,
                    medicine=medicine,
                    qty=qty,
                    seller_id=seller_id,
                    unit_price=medicine.price,
                    sold_at=sold_at,
                )
                medicine.stock -= qty
                medicine.save(update_fields=["stock"])
                line_total = medicine.price * qty
                total += line_total
                lines.append(
                    {
                        "medicine_id": medicine.id,
                        "name": medicine.name,
                        "qty": qty,
                        "unit_price": str(medicine.price),
                        "line_total": str(line_total),
                    }
                )

        return Response(
            {
                "receipt_id": str(receipt_id),
                "sold_at": sold_at.isoformat(),
                "lines": lines,
                "total": str(total),
            },
            status=status.HTTP_201_CREATED,
        )


class Analytics(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        try:
            days = int(request.query_params.get("days", 7))
            limit = int(request.query_params.get("limit", 5))
        except ValueError:
            return Response(
                {"detail": "days and limit must be whole numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not 1 <= days <= 90 or not 1 <= limit <= 20:
            return Response(
                {"detail": "days must be 1-90 and limit must be 1-20."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.localdate()
        since = today - timedelta(days=days - 1)
        sales = Sale.objects.filter(sold_at__date__gte=since)
        line_total = ExpressionWrapper(
            F("qty") * F("unit_price"),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )

        per_day = {
            row["day"]: row
            for row in sales.annotate(day=TruncDate("sold_at"))
            .values("day")
            .annotate(
                revenue=Sum(line_total),
                items_sold=Sum("qty"),
                receipts=Count("receipt_id", distinct=True),
            )
        }
        daily_revenue = []
        for offset in range(days):
            day = since + timedelta(days=offset)
            row = per_day.get(day)
            daily_revenue.append(
                {
                    "date": day.isoformat(),
                    "revenue": str(row["revenue"]) if row else "0.00",
                    "items_sold": row["items_sold"] if row else 0,
                    "receipts": row["receipts"] if row else 0,
                }
            )

        best_sellers = [
            {
                "medicine_id": row["medicine_id"],
                "name": row["medicine__name"],
                "qty_sold": row["qty_sold"],
                "revenue": str(row["revenue"]),
            }
            for row in sales.values("medicine_id", "medicine__name")
            .annotate(qty_sold=Sum("qty"), revenue=Sum(line_total))
            .order_by("-qty_sold", "medicine_id")[:limit]
        ]

        return Response(
            {
                "from": since.isoformat(),
                "to": today.isoformat(),
                "daily_revenue": daily_revenue,
                "best_sellers": best_sellers,
            }
        )
    

class CustomerAssistant(APIView):
    permission_classes = [CustomerAssistantAccess]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "assistant_chat"

    def post(self, request):
        if not isinstance(request.data, dict):
            return Response(
                {"detail": "Send a message and language."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message = request.data.get("message")
        language = request.data.get("language")
        if not isinstance(message, str) or not 1 <= len(message.strip()) <= 500:
            return Response(
                {"detail": "Message must be between 1 and 500 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(language, str) or language not in {"en", "rw", "fr"}:
            return Response(
                {"detail": "Choose English, Kinyarwanda, or French."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        topic = classify_customer_question(message.strip())
        if topic is None:
            reply = (
                health_reply(language)
                if is_health_question(message.strip())
                else out_of_scope_reply(language)
            )
            return Response({"reply": reply})

        try:
            # Never send the customer's message or chat history to Gemini.
            reply = generate_gemini_answer(topic, language)
        except AssistantConfigurationError:
            return Response(
                {
                    "detail": (
                        "The customer assistant is not configured. Please contact "
                        "Pharmacy Desk support."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AssistantProviderError:
            return Response(
                {
                    "detail": (
                        "The assistant is temporarily unavailable. Please contact "
                        "Pharmacy Desk support."
                    )
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"reply": reply})


class Me(APIView):
    """Who is calling, as proven by the token, and what role they have."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "id": request.user.id,
                "email": request.user.email,
                "role": request.user.role,
                "full_name": request.user.full_name,
                "is_active": request.user.is_active,
                "phone": request.user.phone,
            }
        )


class ProfileView(APIView):
    permission_classes = [IsAccountUser]

    def get(self, request):
        profile = Profile.objects.get(id=request.user.id)
        if profile.email != request.user.email:
            profile.email = request.user.email
            profile.save(update_fields=["email"])
        return Response(
            {
                "id": str(profile.id),
                "email": request.user.email,
                "full_name": profile.full_name,
                "role": profile.role,
                "is_active": profile.is_active,
                "phone": profile.phone,
            }
        )

    def patch(self, request):
        if not hasattr(request.data, "keys"):
            return Response(
                {"detail": "Provide profile fields as a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        editable_fields = {"full_name", "phone"}
        unsupported_fields = set(request.data) - editable_fields
        if unsupported_fields:
            return Response(
                {
                    "detail": (
                        "Only full_name and phone can be updated here. "
                        "Role is managed by your pharmacy manager; change email "
                        "through the account confirmation flow."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = Profile.objects.get(id=request.user.id)
        profile.email = request.user.email
        for field, value in serializer.validated_data.items():
            setattr(profile, field, value)
        profile.save(update_fields=["email", *serializer.validated_data])
        return Response(
            {
                "id": str(profile.id),
                "email": request.user.email,
                "full_name": profile.full_name,
                "role": profile.role,
                "is_active": profile.is_active,
                "phone": profile.phone,
            }
        )


class RegistrationCode(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        return Response(
            {"configured": RegistrationSetting.objects.filter(pk=1).exists()}
        )

    def put(self, request):
        serializer = SetRegistrationCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        RegistrationSetting.objects.update_or_create(
            pk=1,
            defaults={"code_hash": make_password(serializer.validated_data["code"])},
        )
        return Response({"configured": True})


class ValidateRegistrationCode(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegistrationIPThrottle]
    throttle_scope = "public_registration"

    def post(self, request):
        serializer = RegistrationCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        setting = RegistrationSetting.objects.filter(pk=1).first()
        if not setting or not check_password(
            serializer.validated_data["code"], setting.code_hash
        ):
            return Response(
                {"detail": "The pharmacist registration code is not valid."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"valid": True})


class RegisterPharmacist(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegistrationIPThrottle]
    throttle_scope = "public_registration"

    def post(self, request):
        serializer = RegisterPharmacistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        setting = RegistrationSetting.objects.filter(pk=1).first()
        if not setting or not check_password(data["code"], setting.code_hash):
            return Response(
                {"detail": "The pharmacist registration code is not valid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_id = create_confirmed_user(
                data["email"], data["password"], data["full_name"]
            )
        except SupabaseAdminConfigurationError:
            return Response(
                {"detail": "Pharmacist registration is not configured on the server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except SupabaseAdminError as error:
            if error.status_code == 409:
                return Response(
                    {"detail": "An account with this email already exists."},
                    status=status.HTTP_409_CONFLICT,
                )
            if error.status_code in (400, 422):
                return Response(
                    {"detail": "The identity provider rejected these account details."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {"detail": "Could not create the account with the identity provider."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except SupabaseAdminUnavailable:
            return Response(
                {"detail": "The identity provider is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            with transaction.atomic():
                profile = Profile.objects.create(
                    id=user_id,
                    role="pharmacist",
                    email=data["email"],
                    full_name=data["full_name"],
                )
        except IntegrityError:
            try:
                delete_user(user_id)
            except (SupabaseAdminError, SupabaseAdminUnavailable):
                logger.exception(
                    "Could not roll back Supabase user after profile conflict."
                )
            return Response(
                {"detail": "Could not activate this pharmacist account."},
                status=status.HTTP_409_CONFLICT,
            )
        except DatabaseError:
            try:
                delete_user(user_id)
            except (SupabaseAdminError, SupabaseAdminUnavailable):
                logger.exception(
                    "Could not roll back Supabase user after profile database error."
                )
            return Response(
                {"detail": "Could not save the pharmacist account. Try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "id": str(profile.id),
                "email": profile.email,
                "full_name": profile.full_name,
                "role": profile.role,
            },
            status=status.HTTP_201_CREATED,
        )


class ActivatePharmacist(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [RegistrationIPThrottle]
    throttle_scope = "pharmacist_activation"

    def post(self, request):
        if request.user.role is not None:
            return Response(
                {"detail": "This account already has a staff role."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = ActivatePharmacistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        setting = RegistrationSetting.objects.filter(pk=1).first()
        if not setting or not check_password(
            serializer.validated_data["code"], setting.code_hash
        ):
            return Response(
                {"detail": "The pharmacist registration code is not valid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = request.user.email
        full_name = (
            serializer.validated_data["full_name"]
            or request.user.full_name
            or email
        )
        profile, created = Profile.objects.get_or_create(
            id=request.user.id,
            defaults={
                "role": "pharmacist",
                "email": email,
                "full_name": full_name,
            },
        )
        if not created:
            return Response(
                {"detail": "This account already has a staff role."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            {
                "id": str(profile.id),
                "email": profile.email,
                "full_name": profile.full_name,
                "role": profile.role,
            },
            status=status.HTTP_201_CREATED,
        )


class PharmacistList(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        pharmacists = Profile.objects.filter(role="pharmacist").order_by(
            "full_name", "email"
        )
        return Response(
            [
                {
                    "id": str(profile.id),
                    "email": profile.email,
                    "full_name": profile.full_name,
                    "is_active": profile.is_active,
                }
                for profile in pharmacists
            ]
        )


class PharmacistDetail(APIView):
    permission_classes = [IsManager]

    def patch(self, request, pk):
        is_active = request.data.get("is_active")
        if not isinstance(is_active, bool):
            return Response(
                {"detail": "is_active must be a boolean."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = Profile.objects.filter(
            id=pk,
            role="pharmacist",
        ).first()
        if profile is None:
            return Response(
                {"detail": "Pharmacist not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        profile.is_active = is_active
        profile.save(update_fields=["is_active"])
        return Response(
            {
                "id": str(profile.id),
                "email": profile.email,
                "full_name": profile.full_name,
                "is_active": profile.is_active,
            }
        )


def order_payload(order, customer_profile=None):
    items = list(order.items.select_related("medicine").all())
    lines = []
    total = Decimal("0")
    for item in items:
        line_total = item.unit_price * item.qty
        total += line_total
        lines.append(
            {
                "medicine_id": item.medicine_id,
                "name": item.medicine.name,
                "qty": item.qty,
                "unit_price": str(item.unit_price),
                "line_total": str(line_total),
            }
        )
    payload = {
        "id": str(order.id),
        "status": order.status,
        "customer_note": order.customer_note,
        "staff_note": order.staff_note,
        "pharmacist_id": str(order.pharmacist_id) if order.pharmacist_id else None,
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
        "items": lines,
        "total": str(total),
    }
    if customer_profile is not None:
        payload.update(
            {
                "customer_name": customer_profile.full_name,
                "customer_email": customer_profile.email,
                "customer_phone": customer_profile.phone,
            }
        )
    return payload


class CustomerMedicineCatalog(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        medicines = Medicine.objects.filter(
            expiry_date__gte=timezone.localdate(), stock__gt=0
        ).order_by("name")
        return Response(
            [
                {
                    "id": medicine.id,
                    "name": medicine.name,
                    "price": str(medicine.price),
                    "available": True,
                }
                for medicine in medicines
            ]
        )


class CustomerOrderList(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        orders = CustomerOrder.objects.filter(
            customer_id=request.user.id
        ).prefetch_related("items__medicine")
        return Response([order_payload(order) for order in orders])

    def post(self, request):
        serializer = CustomerOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data["items"]
        wanted = {item["medicine_id"]: item["qty"] for item in items}
        today = timezone.localdate()
        now = timezone.now()

        with transaction.atomic():
            medicines = {
                medicine.id: medicine
                for medicine in Medicine.objects.select_for_update().filter(
                    id__in=wanted
                )
            }
            missing = sorted(set(wanted) - set(medicines))
            if missing:
                return Response(
                    {"detail": f"Medicine not found: {missing}"},
                    status=status.HTTP_404_NOT_FOUND,
                )
            unavailable = []
            for medicine_id, qty in wanted.items():
                medicine = medicines[medicine_id]
                if medicine.expiry_date < today:
                    reason = "expired"
                elif medicine.stock < qty:
                    reason = "out of stock" if medicine.stock == 0 else (
                        f"only {medicine.stock} in stock"
                    )
                else:
                    continue
                unavailable.append(
                    {
                        "medicine_id": medicine_id,
                        "name": medicine.name,
                        "error": reason,
                    }
                )
            if unavailable:
                return Response(
                    {"detail": "Some requested medicines are unavailable.",
                     "errors": unavailable},
                    status=status.HTTP_409_CONFLICT,
                )

            order = CustomerOrder.objects.create(
                id=uuid.uuid4(),
                customer_id=request.user.id,
                status="submitted",
                customer_note=serializer.validated_data.get("customer_note", ""),
                created_at=now,
                updated_at=now,
            )
            CustomerOrderItem.objects.bulk_create(
                [
                    CustomerOrderItem(
                        order=order,
                        medicine=medicines[medicine_id],
                        qty=qty,
                        unit_price=medicines[medicine_id].price,
                    )
                    for medicine_id, qty in wanted.items()
                ]
            )

        order = CustomerOrder.objects.prefetch_related("items__medicine").get(
            pk=order.pk
        )
        return Response(order_payload(order), status=status.HTTP_201_CREATED)


class CustomerOrderCancel(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        with transaction.atomic():
            order = (
                CustomerOrder.objects.select_for_update()
                .filter(pk=pk, customer_id=request.user.id)
                .first()
            )
            if order is None:
                return Response(
                    {"detail": "Order not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if order.status not in ("submitted", "ready_for_pickup"):
                return Response(
                    {"detail": "This order can no longer be cancelled."},
                    status=status.HTTP_409_CONFLICT,
                )
            if order.status == "ready_for_pickup":
                items = list(
                    CustomerOrderItem.objects.filter(order=order).order_by(
                        "medicine_id"
                    )
                )
                medicines = {
                    medicine.id: medicine
                    for medicine in Medicine.objects.select_for_update()
                    .filter(id__in=[item.medicine_id for item in items])
                    .order_by("id")
                }
                for item in items:
                    medicine = medicines[item.medicine_id]
                    medicine.stock += item.qty
                    medicine.save(update_fields=["stock"])
            order.status = "cancelled"
            order.updated_at = timezone.now()
            order.save(update_fields=["status", "updated_at"])

        order = CustomerOrder.objects.prefetch_related("items__medicine").get(
            pk=order.pk
        )
        return Response(order_payload(order))


class StaffOrderQueue(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        orders = list(
            CustomerOrder.objects.prefetch_related("items__medicine").all()
        )
        profiles = {
            str(profile.id): profile
            for profile in Profile.objects.filter(
                id__in=[order.customer_id for order in orders]
            )
        }
        return Response(
            [
                order_payload(order, profiles.get(str(order.customer_id)))
                for order in orders
            ]
        )

    def patch(self, request, pk):
        action = request.data.get("action")
        note = request.data.get("note", "")
        if action not in ("approve", "decline", "complete", "cancel"):
            return Response(
                {"detail": "action must be approve, decline, complete, or cancel."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(note, str) or len(note) > 500:
            return Response(
                {"detail": "note must be text of at most 500 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        note = note.strip()
        if action == "approve" and request.data.get("prescription_checked") is not True:
            return Response(
                {"detail": "Confirm the prescription review before approving."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if action == "decline" and not note:
            return Response(
                {"detail": "A reason is required when declining an order."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            order = CustomerOrder.objects.select_for_update().filter(pk=pk).first()
            if order is None:
                return Response(
                    {"detail": "Order not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            now = timezone.now()
            if action in ("approve", "decline"):
                if order.status != "submitted":
                    return Response(
                        {"detail": "Only submitted orders can be reviewed."},
                        status=status.HTTP_409_CONFLICT,
                    )
                if action == "decline":
                    order.status = "declined"
                    order.staff_note = note
                else:
                    items = list(
                        CustomerOrderItem.objects.filter(order=order).order_by(
                            "medicine_id"
                        )
                    )
                    medicines = {
                        medicine.id: medicine
                        for medicine in Medicine.objects.select_for_update()
                        .filter(id__in=[item.medicine_id for item in items])
                        .order_by("id")
                    }
                    unavailable = []
                    for item in items:
                        medicine = medicines[item.medicine_id]
                        if medicine.expiry_date < timezone.localdate():
                            reason = "expired"
                        elif medicine.stock < item.qty:
                            reason = (
                                "out of stock"
                                if medicine.stock == 0
                                else f"only {medicine.stock} in stock"
                            )
                        else:
                            continue
                        unavailable.append(
                            {
                                "medicine_id": medicine.id,
                                "name": medicine.name,
                                "error": reason,
                            }
                        )
                    if unavailable:
                        return Response(
                            {
                                "detail": "The order cannot be approved because "
                                "some requested medicines are unavailable.",
                                "errors": unavailable,
                            },
                            status=status.HTTP_409_CONFLICT,
                        )
                    for item in items:
                        medicine = medicines[item.medicine_id]
                        medicine.stock -= item.qty
                        medicine.save(update_fields=["stock"])
                        item.unit_price = medicine.price
                        item.save(update_fields=["unit_price"])
                    order.status = "ready_for_pickup"
                    order.pharmacist_id = request.user.id
                    order.staff_note = note
            elif action == "complete":
                if order.status != "ready_for_pickup":
                    return Response(
                        {"detail": "Only approved orders can be completed."},
                        status=status.HTTP_409_CONFLICT,
                    )
                items = list(
                    CustomerOrderItem.objects.filter(order=order).select_related(
                        "medicine"
                    )
                )
                receipt_id = uuid.uuid4()
                Sale.objects.bulk_create(
                    [
                        Sale(
                            receipt_id=receipt_id,
                            medicine=item.medicine,
                            qty=item.qty,
                            seller_id=request.user.id,
                            unit_price=item.unit_price,
                            sold_at=now,
                        )
                        for item in items
                    ]
                )
                order.status = "completed"
                if note:
                    order.staff_note = note
            else:
                if order.status not in ("submitted", "ready_for_pickup"):
                    return Response(
                        {"detail": "This order can no longer be cancelled."},
                        status=status.HTTP_409_CONFLICT,
                    )
                if order.status == "ready_for_pickup":
                    items = list(
                        CustomerOrderItem.objects.filter(order=order).order_by(
                            "medicine_id"
                        )
                    )
                    medicines = {
                        medicine.id: medicine
                        for medicine in Medicine.objects.select_for_update()
                        .filter(id__in=[item.medicine_id for item in items])
                        .order_by("id")
                    }
                    for item in items:
                        medicine = medicines[item.medicine_id]
                        medicine.stock += item.qty
                        medicine.save(update_fields=["stock"])
                order.status = "cancelled"
                if note:
                    order.staff_note = note

            order.updated_at = now
            order.save(
                update_fields=[
                    "status",
                    "staff_note",
                    "pharmacist_id",
                    "updated_at",
                ]
            )

        order = CustomerOrder.objects.prefetch_related("items__medicine").get(
            pk=order.pk
        )
        profile = Profile.objects.filter(id=order.customer_id).first()
        return Response(order_payload(order, profile))