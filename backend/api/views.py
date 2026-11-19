import os
import uuid
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Medicine, Sale
from .serializers import MedicineSerializer, SaleRequestSerializer


class MedicineList(ListCreateAPIView):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer


class MedicineDetail(RetrieveUpdateDestroyAPIView):
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
    def post(self, request):
        serializer = SaleRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data["items"]

        seller_id = os.environ["TEMP_SELLER_ID"]  # replaced by the real user at login
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