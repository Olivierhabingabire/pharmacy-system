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
from rest_framework.views import APIView

from .models import Medicine, Profile, RegistrationSetting, Sale
from .permissions import IsManager, IsStaff, ManagerCanWrite
from .serializers import (
    ActivatePharmacistSerializer,
    MedicineSerializer,
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
                }
                for profile in pharmacists
            ]
        )